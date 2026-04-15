import * as fs from 'fs';
import * as path from 'path';
import { AIEnricher } from '@support/ai-enricher';
import { logger } from '@core/logger';
import { analyzeCoverage, buildSuggestedDestination, renderCoverageAnalysis } from './coverage-analysis';
import { normalizeSources } from './source-normalizer';
import type {
  AuthoringBundle,
  AuthoringPlan,
  BundleStatus,
  GeneratedImplementationFile,
  ImplementationResult,
  RequiredArtifact,
} from './types';

const AI_OUT_ROOT = path.resolve(process.cwd(), '.ai/out');

interface WorkflowPaths {
  bundleDir: string;
  bundlePath: string;
  sourceContextPath: string;
  coveragePath: string;
  planPath: string;
  implementationPreviewPath: string;
}

interface GeneratedPlanPayload {
  summary: string;
  alreadyCoveredScenarios: string[];
  missingScenarios: string[];
  requiredArtifacts: RequiredArtifact[];
  destination: {
    featureFile: string;
    responseModelFile?: string;
    schemaFile?: string;
  };
  implementationNotes: string[];
  warnings: string[];
  blockers: string[];
}

interface GeneratedImplementationPayload {
  status: 'ready' | 'blocked';
  summary: string;
  warnings: string[];
  blockers: string[];
  notes: string[];
  files: GeneratedImplementationFile[];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function loadJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function bundlePaths(slug: string): WorkflowPaths {
  const bundleDir = path.join(AI_OUT_ROOT, slug);
  return {
    bundleDir,
    bundlePath: path.join(bundleDir, 'bundle.json'),
    sourceContextPath: path.join(bundleDir, 'source-context.json'),
    coveragePath: path.join(bundleDir, 'coverage-analysis.md'),
    planPath: path.join(bundleDir, 'test-plan.md'),
    implementationPreviewPath: path.join(bundleDir, 'implementation-preview.json'),
  };
}

function resolveBundleDir(from: string): string {
  const explicitPath = path.resolve(process.cwd(), from);
  if (fs.existsSync(explicitPath)) {
    if (fs.statSync(explicitPath).isDirectory()) {
      return explicitPath;
    }

    if (path.basename(explicitPath) === 'bundle.json') {
      return path.dirname(explicitPath);
    }
  }

  return path.join(AI_OUT_ROOT, from);
}

function readBundle(from: string): { bundle: AuthoringBundle; paths: WorkflowPaths } {
  const bundleDir = resolveBundleDir(from);
  const bundlePath = path.join(bundleDir, 'bundle.json');
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Could not find bundle.json for "${from}". Looked in ${bundleDir}.`);
  }

  return {
    bundle: loadJsonFile<AuthoringBundle>(bundlePath),
    paths: {
      bundleDir,
      bundlePath,
      sourceContextPath: path.join(bundleDir, 'source-context.json'),
      coveragePath: path.join(bundleDir, 'coverage-analysis.md'),
      planPath: path.join(bundleDir, 'test-plan.md'),
      implementationPreviewPath: path.join(bundleDir, 'implementation-preview.json'),
    },
  };
}

function safeJsonParse<T>(value: string): T | undefined {
  try {
    return JSON.parse(
      value
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, ''),
    ) as T;
  } catch {
    return undefined;
  }
}

function maybeCreateEnricher(): AIEnricher | undefined {
  try {
    return new AIEnricher();
  } catch (error) {
    logger.info('AI authoring workflow is using deterministic fallback planning', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function buildFallbackPlan(
  bundle: Omit<AuthoringBundle, 'schemaVersion' | 'slug' | 'status' | 'createdAt' | 'updatedAt' | 'plan'>,
): AuthoringPlan {
  const destination = buildSuggestedDestination(bundle.inferredDomain, bundle.endpointCandidates);
  const primarySource = bundle.normalizedSources[0];
  const alreadyCovered = bundle.coverage.featureMatches.flatMap((match) => match.scenarios).slice(0, 6);
  const missingScenarios = [
    'Happy-path coverage for the primary endpoint using the named-request pattern.',
    'Negative validation coverage using status labels instead of raw codes.',
    'Schema coverage that keeps array assertions separate from item-schema assertions.',
  ];

  if (bundle.endpointCandidates.some((endpoint) => endpoint.includes('?') || endpoint.includes('{'))) {
    missingScenarios.push('Scenario Outline coverage for key parameter permutations and unconventional inputs.');
  }

  if (bundle.coverage.requiredArtifacts.includes('step-scaffolding-notes')) {
    missingScenarios.push(
      'Domain-step or request-template follow-up, because no close existing template match was found.',
    );
  }

  return {
    summary: primarySource
      ? `Static analysis suggests the work belongs in the ${bundle.inferredDomain ?? 'shared'} domain and should focus on ${primarySource.summary}.`
      : 'Static analysis prepared a bundle, but the source context was too thin to infer a single dominant scenario set.',
    likelyDomain: bundle.inferredDomain,
    likelyEndpointCandidates: bundle.endpointCandidates,
    alreadyCoveredScenarios: alreadyCovered,
    missingScenarios,
    requiredArtifacts: bundle.coverage.requiredArtifacts,
    destination,
    implementationNotes: [
      'Prefer reusing common steps from src/steps/common before proposing any new step definition.',
      'Use named requests and status labels only.',
      bundle.coverage.requiredArtifacts.includes('step-scaffolding-notes')
        ? 'If the domain step file lacks a matching request template, capture the needed step scaffolding as notes instead of inventing unsupported steps.'
        : 'Existing domain scaffolding appears close enough for feature-first generation.',
    ],
    warnings: [...bundle.warnings],
    blockers:
      bundle.endpointCandidates.length === 0 ? ['No endpoint candidates were inferred from the supplied sources.'] : [],
  };
}

function renderPlanMarkdown(bundle: AuthoringBundle): string {
  const lines: string[] = [];
  lines.push('# Test Plan');
  lines.push('');
  lines.push(`Status: ${bundle.status}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(bundle.plan.summary);
  lines.push('');
  lines.push('## Destination');
  lines.push('');
  lines.push(`- Domain: ${bundle.plan.likelyDomain ?? 'unresolved'}`);
  lines.push(`- Feature file: ${bundle.plan.destination.featureFile}`);
  if (bundle.plan.destination.responseModelFile) {
    lines.push(`- Response model: ${bundle.plan.destination.responseModelFile}`);
  }
  if (bundle.plan.destination.schemaFile) {
    lines.push(`- JSON schema: ${bundle.plan.destination.schemaFile}`);
  }
  lines.push('');
  lines.push('## Already Covered');
  lines.push('');
  if (bundle.plan.alreadyCoveredScenarios.length === 0) {
    lines.push('- No close existing scenarios were identified.');
  } else {
    for (const item of bundle.plan.alreadyCoveredScenarios) {
      lines.push(`- ${item}`);
    }
  }
  lines.push('');
  lines.push('## Missing Coverage');
  lines.push('');
  for (const item of bundle.plan.missingScenarios) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Required Artifacts');
  lines.push('');
  for (const artifact of bundle.plan.requiredArtifacts) {
    lines.push(`- ${artifact}`);
  }
  lines.push('');
  lines.push('## Implementation Notes');
  lines.push('');
  for (const note of bundle.plan.implementationNotes) {
    lines.push(`- ${note}`);
  }

  if (bundle.plan.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const warning of bundle.plan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  if (bundle.plan.blockers.length > 0) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    for (const blocker of bundle.plan.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join('\n');
}

async function generatePlanWithAI(
  bundle: Omit<AuthoringBundle, 'schemaVersion' | 'slug' | 'status' | 'createdAt' | 'updatedAt' | 'plan'>,
): Promise<AuthoringPlan | undefined> {
  const enricher = maybeCreateEnricher();
  if (!enricher) {
    return undefined;
  }

  const suggestedDestination = buildSuggestedDestination(bundle.inferredDomain, bundle.endpointCandidates);
  const prompt = `You are planning API-first test automation work for the pw-testforge-gls framework.

Return ONLY valid JSON matching this schema:
{
  "summary": "string",
  "alreadyCoveredScenarios": ["string"],
  "missingScenarios": ["string"],
  "requiredArtifacts": ["feature|response-model|json-schema|step-scaffolding-notes"],
  "destination": {
    "featureFile": "features/<domain>/<name>.feature",
    "responseModelFile": "src/models/responses/<name>.response.ts",
    "schemaFile": "src/schemas/json-schemas/<name>.schema.json"
  },
  "implementationNotes": ["string"],
  "warnings": ["string"],
  "blockers": ["string"]
}

Framework rules:
- Prefer reusing existing common steps and domain scaffolding.
- Use the named-request pattern instead of direct HTTP verb steps for domain tests.
- Use status labels like OK or BadRequest, never raw numbers.
- Keep array assertions separate from schema assertions.
- If step scaffolding is unclear or unsupported, keep the plan explicit about notes/blockers instead of guessing.

Suggested destination:
${JSON.stringify(suggestedDestination, null, 2)}

Normalized source context:
${JSON.stringify(bundle.normalizedSources, null, 2)}

Coverage snapshot:
${JSON.stringify(bundle.coverage, null, 2)}`;

  const response = await enricher.generateText(prompt);
  const parsed = safeJsonParse<GeneratedPlanPayload>(response);
  if (!parsed) {
    logger.warn('AI authoring plan response was not valid JSON; falling back to deterministic planning');
    return undefined;
  }

  return {
    summary: parsed.summary,
    likelyDomain: bundle.inferredDomain,
    likelyEndpointCandidates: bundle.endpointCandidates,
    alreadyCoveredScenarios: parsed.alreadyCoveredScenarios,
    missingScenarios: parsed.missingScenarios,
    requiredArtifacts: parsed.requiredArtifacts,
    destination: parsed.destination,
    implementationNotes: parsed.implementationNotes,
    warnings: parsed.warnings,
    blockers: parsed.blockers,
  };
}

function validateFeatureContent(content: string): string[] {
  const errors: string[] = [];
  if (!/When I define a (GET|POST|PUT|PATCH|DELETE)/.test(content)) {
    errors.push('Feature content must use the named-request pattern (`When I define a ...`).');
  }
  if (/When I send a (GET|POST|PUT|PATCH|DELETE) request to/.test(content)) {
    errors.push('Feature content used a direct HTTP verb step instead of the named-request pattern.');
  }
  if (/\bresponse (?:code|status).*\b\d{3}\b/i.test(content) || /\bshould be\s+2\d{2}\b/i.test(content)) {
    errors.push('Feature content used numeric HTTP status codes instead of framework labels.');
  }
  if (
    /each item in the response array should match schema/i.test(content) &&
    !/(response should be an array|response body should be an array)/i.test(content)
  ) {
    errors.push('Feature content validates array items against a schema without a separate array assertion.');
  }
  return errors;
}

function validateSchemaContent(content: string): string[] {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.type === 'object' && parsed.additionalProperties !== false) {
      errors.push('JSON schema object roots must set `additionalProperties` to false.');
    }
    if (typeof parsed.$id !== 'string' || !parsed.$id) {
      errors.push('JSON schema must declare a non-empty `$id`.');
    }
  } catch {
    errors.push('JSON schema content is not valid JSON.');
  }
  return errors;
}

function validateGeneratedFiles(files: GeneratedImplementationFile[]): string[] {
  const errors: string[] = [];
  const allowedPrefixes = ['features/', 'src/models/responses/', 'src/schemas/json-schemas/'];

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, '/');
    if (!allowedPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
      errors.push(`Generated file path "${file.path}" is outside the supported write scope.`);
      continue;
    }

    if (file.type === 'feature') {
      errors.push(...validateFeatureContent(file.content).map((error) => `${file.path}: ${error}`));
    }

    if (file.type === 'json-schema') {
      errors.push(...validateSchemaContent(file.content).map((error) => `${file.path}: ${error}`));
    }

    if (file.type === 'response-model' && !/export\s+interface\s+[A-Za-z0-9_]+/.test(file.content)) {
      errors.push(`${file.path}: Response model content must export at least one interface.`);
    }
  }

  return errors;
}

async function generateImplementationWithAI(
  bundle: AuthoringBundle,
): Promise<GeneratedImplementationPayload | undefined> {
  const enricher = maybeCreateEnricher();
  if (!enricher) {
    return undefined;
  }

  const prompt = `You are implementing approved API-first test automation work for the pw-testforge-gls framework.

Return ONLY valid JSON matching this schema:
{
  "status": "ready|blocked",
  "summary": "string",
  "warnings": ["string"],
  "blockers": ["string"],
  "notes": ["string"],
  "files": [
    {
      "path": "features/<domain>/<name>.feature",
      "type": "feature|response-model|json-schema",
      "rationale": "string",
      "content": "full file content"
    }
  ]
}

Rules:
- Only write under features/, src/models/responses/, and src/schemas/json-schemas/.
- Prefer generating a feature file plus any missing response model or schema file.
- Do not generate a new domain step file. If domain-step or request-template work is required, return status "blocked" and explain it in blockers/notes.
- Use the named-request pattern instead of direct HTTP verb steps for domain tests.
- Use status labels instead of raw numeric codes.
- Keep array assertions separate from schema assertions.
- If anything is ambiguous, choose status "blocked" rather than guessing.

Approved bundle:
${JSON.stringify(bundle, null, 2)}`;

  const response = await enricher.generateText(prompt);
  return safeJsonParse<GeneratedImplementationPayload>(response);
}

function writeGeneratedFiles(files: GeneratedImplementationFile[]): string[] {
  const wroteFiles: string[] = [];
  for (const file of files) {
    const destination = path.resolve(process.cwd(), file.path);
    ensureDir(path.dirname(destination));
    fs.writeFileSync(destination, file.content, 'utf-8');
    wroteFiles.push(file.path.replace(/\\/g, '/'));
  }
  return wroteFiles;
}

export async function createPlanBundle(
  sourceInputs: string[],
  requestedSlug?: string,
): Promise<{ bundle: AuthoringBundle; paths: WorkflowPaths }> {
  if (sourceInputs.length === 0) {
    throw new Error('At least one `--source` value is required.');
  }

  const normalization = await normalizeSources(sourceInputs);
  const coverage = analyzeCoverage(normalization.normalizedSources);
  const inferredDomain = coverage.inferredDomain;
  const endpointCandidates = normalization.endpointCandidates;
  const slug =
    requestedSlug ??
    slugify(
      normalization.normalizedSources.map((source) => source.issueKey ?? source.canonicalRef).join('-') ||
        `authoring-${Date.now()}`,
    );
  const paths = bundlePaths(slug);

  ensureDir(paths.bundleDir);

  const draftBundle: Omit<AuthoringBundle, 'schemaVersion' | 'slug' | 'status' | 'createdAt' | 'updatedAt' | 'plan'> = {
    sourceInputs,
    normalizedSources: normalization.normalizedSources,
    inferredDomain,
    endpointCandidates,
    coverage,
    warnings: [...new Set([...normalization.warnings, ...coverage.warnings])],
    blockers: [],
  };

  const plan = (await generatePlanWithAI(draftBundle)) ?? buildFallbackPlan(draftBundle);
  const now = new Date().toISOString();
  const status: BundleStatus = plan.blockers.length > 0 ? 'blocked' : 'proposed';

  const bundle: AuthoringBundle = {
    schemaVersion: 1,
    slug,
    status,
    createdAt: now,
    updatedAt: now,
    ...draftBundle,
    plan,
    blockers: [...new Set([...draftBundle.blockers, ...plan.blockers])],
  };

  writeJson(paths.sourceContextPath, {
    generatedAt: now,
    sourceInputs,
    normalizedSources: bundle.normalizedSources,
  });
  fs.writeFileSync(paths.coveragePath, renderCoverageAnalysis(bundle.coverage), 'utf-8');
  fs.writeFileSync(paths.planPath, renderPlanMarkdown(bundle), 'utf-8');
  writeJson(paths.bundlePath, bundle);

  return { bundle, paths };
}

export function approveBundle(from: string): { bundle: AuthoringBundle; paths: WorkflowPaths } {
  const { bundle, paths } = readBundle(from);
  const updatedBundle: AuthoringBundle = {
    ...bundle,
    status: 'approved',
    approvedAt: bundle.approvedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeJson(paths.bundlePath, updatedBundle);
  fs.writeFileSync(paths.planPath, renderPlanMarkdown(updatedBundle), 'utf-8');

  return { bundle: updatedBundle, paths };
}

function blockedImplementation(summary: string, blockers: string[], notes: string[] = []): ImplementationResult {
  return {
    status: 'blocked',
    summary,
    warnings: [],
    blockers,
    notes,
    files: [],
  };
}

export async function implementBundle(from: string): Promise<{ bundle: AuthoringBundle; paths: WorkflowPaths }> {
  const { bundle, paths } = readBundle(from);
  const canImplement = bundle.status === 'approved' || (bundle.status === 'blocked' && Boolean(bundle.approvedAt));
  if (!canImplement) {
    throw new Error(
      `Bundle "${bundle.slug}" must be approved before implementation. Current status: ${bundle.status}.`,
    );
  }

  const generated = await generateImplementationWithAI(bundle);
  const implementation =
    generated ??
    blockedImplementation(
      'AI implementation could not run because no configured AI provider was available for code generation.',
      ['Configure AI provider credentials before running `ai:implement`.'],
      ['The bundle remains approved, so you can retry once AI credentials are available.'],
    );

  const validationErrors = implementation.status === 'ready' ? validateGeneratedFiles(implementation.files) : [];
  const finalImplementation: ImplementationResult =
    validationErrors.length > 0
      ? {
          ...implementation,
          status: 'blocked',
          blockers: [...implementation.blockers, ...validationErrors],
          files: [],
        }
      : implementation;

  if (finalImplementation.status === 'ready') {
    finalImplementation.wroteFiles = writeGeneratedFiles(finalImplementation.files);
  }

  const updatedBundle: AuthoringBundle = {
    ...bundle,
    status: finalImplementation.status === 'ready' ? 'implemented' : 'blocked',
    implementation: finalImplementation,
    implementedAt: finalImplementation.status === 'ready' ? new Date().toISOString() : bundle.implementedAt,
    updatedAt: new Date().toISOString(),
    blockers: [...new Set([...(bundle.blockers ?? []), ...finalImplementation.blockers])],
    warnings: [...new Set([...(bundle.warnings ?? []), ...finalImplementation.warnings])],
  };

  writeJson(paths.implementationPreviewPath, finalImplementation);
  writeJson(paths.bundlePath, updatedBundle);
  fs.writeFileSync(paths.planPath, renderPlanMarkdown(updatedBundle), 'utf-8');

  return { bundle: updatedBundle, paths };
}
