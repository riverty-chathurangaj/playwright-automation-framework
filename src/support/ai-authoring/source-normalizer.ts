import axios, { AxiosError } from 'axios';
import { config } from '@core/config';
import { logger } from '@core/logger';
import type { NormalizedSource, ParsedSourceInput } from './types';

const ISSUE_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/;
const ENDPOINT_PATTERN = /\/[A-Za-z0-9{}._~-]+(?:\/[A-Za-z0-9{}._~-]+)*(?:\?[A-Za-z0-9=&._~%-]+)?/g;
const ACCEPTANCE_FIELD_NAMES = [
  'acceptance criteria',
  'acceptance criterion',
  'acceptance criteria / conditions of satisfaction',
];

interface JiraIssueResponse {
  id?: string;
  key?: string;
  names?: Record<string, string>;
  fields?: Record<string, unknown>;
}

interface JiraIssueDetails {
  id?: string;
  key?: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  priority?: string;
  issueType?: string;
  labels: string[];
  linkedIssueKeys: string[];
  url?: string;
}

export interface SourceNormalizationResult {
  normalizedSources: NormalizedSource[];
  endpointCandidates: string[];
  warnings: string[];
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tryParseUrl(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

function extractIssueKeyFromUrl(url: URL): string | undefined {
  const raw = `${url.pathname}${url.search}${url.hash}`;
  const directMatch = raw.match(ISSUE_KEY_PATTERN);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  return url.searchParams.get('selectedIssue') ?? undefined;
}

export function parseSourceInput(rawSource: string): ParsedSourceInput {
  const raw = rawSource.trim();
  const url = tryParseUrl(raw);
  const urlIssueKey = url ? extractIssueKeyFromUrl(url) : undefined;
  const rawIssueKey = raw.match(ISSUE_KEY_PATTERN)?.[1];
  const issueKey = urlIssueKey ?? rawIssueKey;
  const issueId = !issueKey && /^\d+$/.test(raw) ? raw : undefined;
  const kindHint =
    url && /xray/i.test(`${url.hostname}${url.pathname}${url.search}`)
      ? 'xray'
      : urlIssueKey || rawIssueKey || url
        ? 'jira'
        : 'auto';

  return {
    raw,
    canonicalRef: issueKey ?? issueId ?? raw.toLowerCase(),
    kindHint,
    issueKey,
    issueId,
    url: url?.toString(),
  };
}

function extractRichText(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeWhitespace(value);
  }

  if (Array.isArray(value)) {
    return normalizeWhitespace(
      value
        .map((entry) => extractRichText(entry))
        .filter(Boolean)
        .join('\n'),
    );
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const node = value as Record<string, unknown>;
  if (typeof node.text === 'string') {
    return node.text;
  }

  const type = typeof node.type === 'string' ? node.type : '';
  const content = Array.isArray(node.content)
    ? node.content.map((entry) => extractRichText(entry)).filter(Boolean)
    : [];

  switch (type) {
    case 'hardBreak':
      return '\n';
    case 'paragraph':
    case 'heading':
      return `${content.join('')}\n`;
    case 'bulletList':
    case 'orderedList':
      return `${content.join('\n')}\n`;
    case 'listItem':
      return `- ${content.join(' ').trim()}\n`;
    default:
      return content.join('');
  }
}

function findAcceptanceCriteriaField(
  fields: Record<string, unknown>,
  names: Record<string, string>,
): string | undefined {
  return Object.entries(names).find(([, name]) =>
    ACCEPTANCE_FIELD_NAMES.some((candidate) => name.toLowerCase().includes(candidate)),
  )?.[0];
}

function extractAcceptanceCriteria(
  description: string,
  fields: Record<string, unknown>,
  names: Record<string, string>,
): string {
  const acceptanceFieldId = findAcceptanceCriteriaField(fields, names);
  if (acceptanceFieldId) {
    const value = extractRichText(fields[acceptanceFieldId]);
    if (value) {
      return value;
    }
  }

  const match = description.match(/acceptance criteria[:\s]*([\s\S]+)/i);
  return match?.[1] ? normalizeWhitespace(match[1]) : '';
}

function deriveRisk(priority: string | undefined, labels: string[]): string | undefined {
  const priorityValue = priority?.toLowerCase();
  if (
    priorityValue === 'highest' ||
    priorityValue === 'high' ||
    labels.some((label) => /risk[:_-]?high/i.test(label))
  ) {
    return 'high';
  }

  if (priorityValue === 'medium' || labels.some((label) => /risk[:_-]?medium/i.test(label))) {
    return 'medium';
  }

  if (priorityValue === 'low' || priorityValue === 'lowest' || labels.some((label) => /risk[:_-]?low/i.test(label))) {
    return 'low';
  }

  return undefined;
}

function extractEndpointCandidates(...inputs: string[]): string[] {
  const values = new Set<string>();

  for (const input of inputs) {
    const matches = input.match(ENDPOINT_PATTERN) ?? [];
    for (const match of matches) {
      if (match.startsWith('/rest/api/') || match.startsWith('/browse/')) {
        continue;
      }
      values.add(match);
    }
  }

  return [...values];
}

function detectSourceKind(
  issueType: string | undefined,
  labels: string[],
  kindHint: ParsedSourceInput['kindHint'],
): NormalizedSource['kind'] {
  const issueTypeValue = issueType?.toLowerCase() ?? '';
  if (issueTypeValue.includes('test') || labels.some((label) => /xray/i.test(label))) {
    return 'xray';
  }

  if (kindHint === 'jira' || kindHint === 'xray') {
    return kindHint;
  }

  return 'unknown';
}

class JiraSourceClient {
  private readonly enabled: boolean;
  private readonly baseUrl: string;

  constructor() {
    this.enabled = Boolean(config.jira.baseUrl && config.jira.email && config.jira.apiToken);
    this.baseUrl = config.jira.baseUrl.replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  async fetchIssue(reference: string): Promise<JiraIssueDetails | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const issueUrl = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(reference)}`;

    try {
      const response = await axios.get<JiraIssueResponse>(issueUrl, {
        auth: {
          username: config.jira.email,
          password: config.jira.apiToken,
        },
        headers: {
          Accept: 'application/json',
        },
        params: {
          expand: 'names',
        },
        timeout: config.apiTimeout,
      });

      const issue = response.data;
      const fields = issue.fields ?? {};
      const names = issue.names ?? {};
      const description = extractRichText(fields.description);
      const linkedIssueKeys = ((fields.issuelinks as Array<Record<string, unknown>> | undefined) ?? [])
        .flatMap((entry) => {
          const inward = entry.inwardIssue as Record<string, unknown> | undefined;
          const outward = entry.outwardIssue as Record<string, unknown> | undefined;
          return [inward?.key, outward?.key].filter((value): value is string => typeof value === 'string');
        })
        .filter(Boolean);

      return {
        id: issue.id,
        key: issue.key,
        summary: typeof fields.summary === 'string' ? fields.summary : reference,
        description,
        acceptanceCriteria: extractAcceptanceCriteria(description, fields, names),
        priority:
          typeof (fields.priority as Record<string, unknown> | undefined)?.name === 'string'
            ? ((fields.priority as Record<string, unknown>).name as string)
            : undefined,
        issueType:
          typeof (fields.issuetype as Record<string, unknown> | undefined)?.name === 'string'
            ? ((fields.issuetype as Record<string, unknown>).name as string)
            : undefined,
        labels: Array.isArray(fields.labels)
          ? fields.labels.filter((label): label is string => typeof label === 'string')
          : [],
        linkedIssueKeys: [...new Set(linkedIssueKeys)],
        url: issue.key ? `${this.baseUrl}/browse/${issue.key}` : undefined,
      };
    } catch (error) {
      const err = error as AxiosError;
      logger.warn('Failed to fetch Jira issue for AI authoring source', {
        reference,
        status: err.response?.status,
        message: err.message,
      });
      return undefined;
    }
  }
}

function buildOfflineSource(parsed: ParsedSourceInput, warning: string): NormalizedSource {
  return {
    raw: parsed.raw,
    canonicalRef: parsed.canonicalRef,
    kind: parsed.kindHint === 'auto' ? 'unknown' : parsed.kindHint,
    issueKey: parsed.issueKey,
    issueId: parsed.issueId,
    url: parsed.url,
    title: parsed.issueKey ?? parsed.issueId ?? parsed.raw,
    summary: parsed.raw,
    description: '',
    acceptanceCriteria: '',
    labels: [],
    linkedIssueKeys: [],
    linkedSourceRefs: [],
    endpointCandidates: extractEndpointCandidates(parsed.raw),
    fetchedFrom: ['none'],
    warnings: [warning],
  };
}

function buildNormalizedSource(parsed: ParsedSourceInput, jiraIssue: JiraIssueDetails): NormalizedSource {
  const endpointCandidates = extractEndpointCandidates(
    jiraIssue.summary,
    jiraIssue.description,
    jiraIssue.acceptanceCriteria,
  );
  return {
    raw: parsed.raw,
    canonicalRef: jiraIssue.key ?? jiraIssue.id ?? parsed.canonicalRef,
    kind: detectSourceKind(jiraIssue.issueType, jiraIssue.labels, parsed.kindHint),
    issueKey: jiraIssue.key ?? parsed.issueKey,
    issueId: jiraIssue.id ?? parsed.issueId,
    url: jiraIssue.url ?? parsed.url,
    title: jiraIssue.summary,
    summary: jiraIssue.summary,
    description: jiraIssue.description,
    acceptanceCriteria: jiraIssue.acceptanceCriteria,
    priority: jiraIssue.priority,
    risk: deriveRisk(jiraIssue.priority, jiraIssue.labels),
    issueType: jiraIssue.issueType,
    labels: jiraIssue.labels,
    linkedIssueKeys: jiraIssue.linkedIssueKeys,
    linkedSourceRefs: jiraIssue.linkedIssueKeys,
    endpointCandidates,
    fetchedFrom: ['jira'],
    warnings: [],
  };
}

function dedupeSources(sources: NormalizedSource[]): NormalizedSource[] {
  const deduped = new Map<string, NormalizedSource>();

  for (const source of sources) {
    const key = source.issueKey ?? source.issueId ?? source.canonicalRef;
    if (!deduped.has(key)) {
      deduped.set(key, source);
      continue;
    }

    const existing = deduped.get(key)!;
    deduped.set(key, {
      ...existing,
      linkedIssueKeys: [...new Set([...existing.linkedIssueKeys, ...source.linkedIssueKeys])],
      linkedSourceRefs: [...new Set([...existing.linkedSourceRefs, ...source.linkedSourceRefs])],
      endpointCandidates: [...new Set([...existing.endpointCandidates, ...source.endpointCandidates])],
      fetchedFrom: [...new Set([...existing.fetchedFrom, ...source.fetchedFrom])],
      warnings: [...new Set([...existing.warnings, ...source.warnings])],
    });
  }

  return [...deduped.values()];
}

export async function normalizeSources(rawSources: string[]): Promise<SourceNormalizationResult> {
  const jiraClient = new JiraSourceClient();
  const warnings: string[] = [];
  const parsedInputs = [
    ...new Map(rawSources.map((raw) => [parseSourceInput(raw).canonicalRef, parseSourceInput(raw)])).values(),
  ];
  const normalized: NormalizedSource[] = [];

  for (const parsed of parsedInputs) {
    const reference = parsed.issueKey ?? parsed.issueId ?? parsed.raw;
    const issue = jiraClient.isConfigured() ? await jiraClient.fetchIssue(reference) : undefined;

    if (issue) {
      normalized.push(buildNormalizedSource(parsed, issue));
      continue;
    }

    const warning = jiraClient.isConfigured()
      ? `Could not resolve source "${reference}" from Jira; continuing with the raw source only.`
      : 'Jira credentials are not configured; source normalization is using the raw inputs only.';
    normalized.push(buildOfflineSource(parsed, warning));
  }

  const kinds = new Set(normalized.map((source) => source.kind).filter((kind) => kind !== 'unknown'));
  const missingCounterpartKind =
    kinds.has('jira') && !kinds.has('xray') ? 'xray' : kinds.has('xray') && !kinds.has('jira') ? 'jira' : undefined;

  if (missingCounterpartKind && jiraClient.isConfigured()) {
    const linkedKeys = [...new Set(normalized.flatMap((source) => source.linkedIssueKeys))].slice(0, 5);
    for (const linkedKey of linkedKeys) {
      if (normalized.some((source) => source.issueKey === linkedKey)) {
        continue;
      }

      const linkedIssue = await jiraClient.fetchIssue(linkedKey);
      if (!linkedIssue) {
        continue;
      }

      const linkedSource = buildNormalizedSource(
        {
          raw: linkedKey,
          canonicalRef: linkedKey,
          kindHint: 'auto',
          issueKey: linkedKey,
        },
        linkedIssue,
      );

      if (linkedSource.kind === missingCounterpartKind) {
        linkedSource.warnings.push(
          `Linked ${missingCounterpartKind.toUpperCase()} source discovered automatically from issue links.`,
        );
        normalized.push(linkedSource);
      }
    }
  }

  if (!jiraClient.isConfigured()) {
    warnings.push(
      'Jira credentials are not configured, so issue summaries and acceptance criteria could not be hydrated.',
    );
  }

  const deduped = dedupeSources(normalized);
  const endpointCandidates = [...new Set(deduped.flatMap((source) => source.endpointCandidates))];
  const uniqueWarnings = [...new Set([...warnings, ...deduped.flatMap((source) => source.warnings)])];

  return {
    normalizedSources: deduped,
    endpointCandidates,
    warnings: uniqueWarnings,
  };
}
