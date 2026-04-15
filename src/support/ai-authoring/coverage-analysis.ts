import * as fs from 'fs';
import * as path from 'path';
import type {
  CoverageFeatureMatch,
  CoverageSnapshot,
  CoverageStepMatch,
  CoverageTemplateMatch,
  NormalizedSource,
  RequiredArtifact,
} from './types';

interface FeatureDocument {
  path: string;
  domain: string;
  tags: string[];
  scenarios: string[];
  content: string;
}

interface RequestTemplateDefinition {
  name: string;
  path: string;
  file: string;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'have',
  'will',
  'into',
  'when',
  'then',
  'user',
  'jira',
  'xray',
  'story',
  'test',
  'case',
  'should',
  'able',
  'service',
]);

function listFiles(rootDir: string, predicate: (filePath: string) => boolean): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const result: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath, predicate));
      continue;
    }

    if (predicate(fullPath)) {
      result.push(fullPath);
    }
  }

  return result;
}

function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function extractKeywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9{}]+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
    ),
  ];
}

function extractFeatureDocuments(): FeatureDocument[] {
  return listFiles(path.resolve(process.cwd(), 'features'), (filePath) => filePath.endsWith('.feature')).map(
    (filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const pathParts = relativePath(filePath).split('/');
      const domain = pathParts[1] ?? 'unknown';
      const tags = content
        .split('\n')
        .filter((line) => line.trim().startsWith('@'))
        .flatMap((line) => line.trim().split(/\s+/))
        .filter(Boolean);
      const scenarios = [...content.matchAll(/Scenario(?: Outline)?\s*:\s*(.+)$/gm)].map((match) => match[1].trim());

      return {
        path: relativePath(filePath),
        domain,
        tags,
        scenarios,
        content,
      };
    },
  );
}

function extractRequestTemplates(): RequestTemplateDefinition[] {
  const stepFiles = listFiles(
    path.resolve(process.cwd(), 'src/steps'),
    (filePath) => filePath.endsWith('.ts') && !filePath.includes(`${path.sep}common${path.sep}`),
  );
  const templates: RequestTemplateDefinition[] = [];

  for (const filePath of stepFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const registerBlocks = [...content.matchAll(/registerTemplates\(\s*\{([\s\S]*?)\}\s*\)/g)];
    for (const block of registerBlocks) {
      const entries = [...(block[1] ?? '').matchAll(/['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g)];
      for (const entry of entries) {
        templates.push({
          name: entry[1],
          path: entry[2],
          file: relativePath(filePath),
        });
      }
    }
  }

  return templates;
}

function extractCommonSteps(): CoverageStepMatch[] {
  const stepFiles = listFiles(path.resolve(process.cwd(), 'src/steps/common'), (filePath) => filePath.endsWith('.ts'));
  const steps: CoverageStepMatch[] = [];

  for (const filePath of stepFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = [...content.matchAll(/\b(?:Given|When|Then)\(\s*['"`]([^'"`]+)['"`]/g)];
    for (const match of matches) {
      steps.push({
        step: match[1],
        file: relativePath(filePath),
        score: 0,
      });
    }
  }

  return steps;
}

function loadSchemaIds(): string[] {
  return listFiles(path.resolve(process.cwd(), 'src/schemas/json-schemas'), (filePath) =>
    filePath.endsWith('.json'),
  ).map((filePath) => {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      return typeof parsed.$id === 'string' ? parsed.$id : path.basename(filePath, '.schema.json');
    } catch {
      return path.basename(filePath, '.schema.json');
    }
  });
}

function loadResponseModels(): string[] {
  return listFiles(path.resolve(process.cwd(), 'src/models/responses'), (filePath) =>
    filePath.endsWith('.response.ts'),
  ).map((filePath) => path.basename(filePath, '.response.ts'));
}

function scoreTextMatch(
  content: string,
  keywords: string[],
  endpointCandidates: string[],
): { score: number; reasons: string[] } {
  const haystack = content.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 2;
      reasons.push(`keyword "${keyword}"`);
    }
  }

  for (const endpoint of endpointCandidates) {
    const fragment = endpoint.split('/').filter(Boolean).pop();
    if (fragment && haystack.includes(fragment.toLowerCase())) {
      score += 3;
      reasons.push(`endpoint fragment "${fragment}"`);
    }
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 4),
  };
}

function inferDomain(
  sources: NormalizedSource[],
  knownDomains: string[],
  requestTemplates: RequestTemplateDefinition[],
): string | undefined {
  const domainScores = new Map<string, number>(knownDomains.map((domain) => [domain, 0]));
  const corpus = sources
    .map((source) =>
      [source.summary, source.description, source.acceptanceCriteria, ...source.endpointCandidates].join(' '),
    )
    .join(' ')
    .toLowerCase();

  for (const domain of knownDomains) {
    if (corpus.includes(domain.toLowerCase())) {
      domainScores.set(domain, (domainScores.get(domain) ?? 0) + 3);
    }
  }

  for (const endpoint of sources.flatMap((source) => source.endpointCandidates)) {
    const segments = endpoint
      .split('/')
      .filter(Boolean)
      .filter((segment) => !segment.startsWith('{'));
    for (const segment of segments) {
      const normalized = segment.toLowerCase();
      if (domainScores.has(normalized)) {
        domainScores.set(normalized, (domainScores.get(normalized) ?? 0) + 4);
      }

      for (const domain of knownDomains) {
        if (normalized.includes(domain.toLowerCase()) || domain.toLowerCase().includes(normalized)) {
          domainScores.set(domain, (domainScores.get(domain) ?? 0) + 2);
        }
      }
    }
  }

  for (const template of requestTemplates) {
    const score = sources.some((source) => source.endpointCandidates.includes(template.path)) ? 5 : 0;
    if (score > 0) {
      const domain = template.file.split('/')[2];
      if (domainScores.has(domain)) {
        domainScores.set(domain, (domainScores.get(domain) ?? 0) + score);
      }
    }
  }

  const [bestDomain, bestScore] = [...domainScores.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return bestScore ? bestDomain : undefined;
}

function buildDestinationStem(endpointCandidates: string[], inferredDomain?: string): string {
  const endpointStem = endpointCandidates
    .flatMap((endpoint) => endpoint.split('/'))
    .filter(Boolean)
    .filter((segment) => !segment.startsWith('{'))
    .pop();

  const rawStem = endpointStem ?? inferredDomain ?? 'generated-scenario';
  return rawStem
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function buildSuggestedDestination(
  inferredDomain: string | undefined,
  endpointCandidates: string[],
): {
  featureFile: string;
  responseModelFile?: string;
  schemaFile?: string;
} {
  const domain = inferredDomain ?? 'shared';
  const stem = buildDestinationStem(endpointCandidates, inferredDomain);
  const modelStem = stem.replace(/-request$/, '');

  return {
    featureFile: `features/${domain}/${stem}.feature`,
    responseModelFile: `src/models/responses/${modelStem}.response.ts`,
    schemaFile: `src/schemas/json-schemas/${modelStem}.schema.json`,
  };
}

export function analyzeCoverage(sources: NormalizedSource[]): CoverageSnapshot {
  const features = extractFeatureDocuments();
  const requestTemplates = extractRequestTemplates();
  const commonSteps = extractCommonSteps();
  const schemaIds = loadSchemaIds();
  const responseModels = loadResponseModels();
  const knownDomains = [...new Set(features.map((feature) => feature.domain))].sort();
  const endpointCandidates = [...new Set(sources.flatMap((source) => source.endpointCandidates))];
  const keywords = extractKeywords(
    sources
      .map((source) =>
        [
          source.summary,
          source.description,
          source.acceptanceCriteria,
          source.issueKey,
          ...source.endpointCandidates,
        ].join(' '),
      )
      .join(' '),
  );

  const inferredDomain = inferDomain(sources, knownDomains, requestTemplates);

  const featureMatches: CoverageFeatureMatch[] = features
    .map((feature) => {
      const { score, reasons } = scoreTextMatch(feature.content, keywords, endpointCandidates);
      return {
        path: feature.path,
        score,
        reason: reasons.join(', ') || 'domain proximity',
        tags: feature.tags,
        scenarios: feature.scenarios.slice(0, 6),
      };
    })
    .filter((feature) => feature.score > 0 || (inferredDomain && feature.path.includes(`/${inferredDomain}/`)))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const requestTemplateMatches: CoverageTemplateMatch[] = requestTemplates
    .map((template) => {
      const { score } = scoreTextMatch(`${template.name} ${template.path}`, keywords, endpointCandidates);
      return {
        ...template,
        score,
      };
    })
    .filter((template) => template.score > 0 || endpointCandidates.includes(template.path))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const schemaMatches = schemaIds
    .filter((schemaId) => keywords.some((keyword) => schemaId.toLowerCase().includes(keyword)))
    .slice(0, 8);

  const responseModelMatches = responseModels
    .filter((model) => keywords.some((keyword) => model.toLowerCase().includes(keyword)))
    .slice(0, 8);

  const commonStepMatches = commonSteps
    .map((step) => ({
      ...step,
      score: scoreTextMatch(step.step, keywords, endpointCandidates).score,
    }))
    .filter((step) => step.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  const requiredArtifacts: RequiredArtifact[] = ['feature'];
  if (responseModelMatches.length === 0) {
    requiredArtifacts.push('response-model');
  }
  if (schemaMatches.length === 0) {
    requiredArtifacts.push('json-schema');
  }
  if (!inferredDomain || requestTemplateMatches.length === 0) {
    requiredArtifacts.push('step-scaffolding-notes');
  }

  const gaps: string[] = [];
  if (featureMatches.length === 0) {
    gaps.push('No close feature coverage was found for the normalized sources.');
  }
  if (endpointCandidates.length === 0) {
    gaps.push('No endpoint candidates could be extracted from the supplied Jira/Xray context.');
  }
  if (!inferredDomain) {
    gaps.push('The workflow could not confidently infer a destination domain from the current repo coverage.');
  }

  const warnings: string[] = [];
  if (sources.every((source) => source.fetchedFrom.includes('none'))) {
    warnings.push(
      'Coverage analysis is running on raw source text only because no hydrated Jira issue data was available.',
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    knownDomains,
    inferredDomain,
    endpointCandidates,
    featureMatches,
    requestTemplateMatches,
    schemaMatches,
    responseModelMatches,
    commonStepMatches,
    requiredArtifacts: [...new Set(requiredArtifacts)],
    gaps,
    warnings,
  };
}

export function renderCoverageAnalysis(coverage: CoverageSnapshot): string {
  const lines: string[] = [];

  lines.push('# Coverage Analysis');
  lines.push('');
  lines.push(`Generated: ${coverage.generatedAt}`);
  lines.push('');
  lines.push('## Inference');
  lines.push('');
  lines.push(`- Inferred domain: ${coverage.inferredDomain ?? 'unresolved'}`);
  lines.push(
    `- Endpoint candidates: ${coverage.endpointCandidates.length ? coverage.endpointCandidates.join(', ') : 'none detected'}`,
  );
  lines.push(`- Required artifacts: ${coverage.requiredArtifacts.join(', ')}`);
  lines.push('');

  lines.push('## Existing Feature Coverage');
  lines.push('');
  if (coverage.featureMatches.length === 0) {
    lines.push('- No close feature matches found.');
  } else {
    for (const match of coverage.featureMatches) {
      lines.push(`- ${match.path} (score ${match.score}) — ${match.reason}`);
      if (match.scenarios.length > 0) {
        lines.push(`  Scenarios: ${match.scenarios.join(' | ')}`);
      }
    }
  }
  lines.push('');

  lines.push('## Request Templates');
  lines.push('');
  if (coverage.requestTemplateMatches.length === 0) {
    lines.push('- No closely matching request templates found.');
  } else {
    for (const match of coverage.requestTemplateMatches) {
      lines.push(`- ${match.name} -> ${match.path} (${match.file})`);
    }
  }
  lines.push('');

  lines.push('## Schemas And Models');
  lines.push('');
  lines.push(`- Schemas: ${coverage.schemaMatches.length ? coverage.schemaMatches.join(', ') : 'none matched'}`);
  lines.push(
    `- Response models: ${coverage.responseModelMatches.length ? coverage.responseModelMatches.join(', ') : 'none matched'}`,
  );
  lines.push('');

  lines.push('## Common Steps');
  lines.push('');
  if (coverage.commonStepMatches.length === 0) {
    lines.push('- No especially relevant common step matches found.');
  } else {
    for (const step of coverage.commonStepMatches) {
      lines.push(`- ${step.step} (${step.file})`);
    }
  }
  lines.push('');

  lines.push('## Gaps');
  lines.push('');
  if (coverage.gaps.length === 0) {
    lines.push('- No major gaps detected from static analysis.');
  } else {
    for (const gap of coverage.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  if (coverage.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const warning of coverage.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join('\n');
}
