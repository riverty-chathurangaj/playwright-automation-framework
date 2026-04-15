import * as assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '@core/config';
import { analyzeCoverage } from '@support/ai-authoring/coverage-analysis';
import { approveBundle, createPlanBundle, implementBundle } from '@support/ai-authoring/workflow';
import { normalizeSources, parseSourceInput } from '@support/ai-authoring/source-normalizer';
import type { AuthoringBundle } from '@support/ai-authoring/types';

const createdBundleDirs: string[] = [];

const originalJiraConfig = { ...config.jira };
const originalAIConfig = { ...config.ai };

function forceOfflineMode(): void {
  config.jira.baseUrl = '';
  config.jira.email = '';
  config.jira.apiToken = '';
  config.ai.provider = 'anthropic';
  config.ai.anthropicApiKey = '';
  config.ai.openaiApiKey = '';
  config.ai.openaiEndpoint = '';
}

function restoreConfig(): void {
  config.jira.baseUrl = originalJiraConfig.baseUrl;
  config.jira.email = originalJiraConfig.email;
  config.jira.apiToken = originalJiraConfig.apiToken;
  config.ai.provider = originalAIConfig.provider;
  config.ai.anthropicApiKey = originalAIConfig.anthropicApiKey;
  config.ai.openaiApiKey = originalAIConfig.openaiApiKey;
  config.ai.openaiEndpoint = originalAIConfig.openaiEndpoint;
}

afterEach(() => {
  restoreConfig();
  while (createdBundleDirs.length > 0) {
    const dir = createdBundleDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('parseSourceInput recognizes Jira keys and Xray-flavored URLs', () => {
  const jiraIssue = parseSourceInput('GL-123');
  assert.equal(jiraIssue.issueKey, 'GL-123');
  assert.equal(jiraIssue.kindHint, 'jira');

  const xrayIssue = parseSourceInput('https://xray.cloud.getxray.app/projects/GL?selectedIssue=GL-456');
  assert.equal(xrayIssue.issueKey, 'GL-456');
  assert.equal(xrayIssue.kindHint, 'xray');
});

test('normalizeSources dedupes repeated inputs in offline mode', async () => {
  forceOfflineMode();
  const result = await normalizeSources(['GL-123', 'https://yourcompany.atlassian.net/browse/GL-123']);

  assert.equal(result.normalizedSources.length, 1);
  assert.equal(result.normalizedSources[0].canonicalRef, 'GL-123');
  assert.match(result.warnings.join(' '), /Jira credentials are not configured/i);
});

test('analyzeCoverage infers a known domain from endpoint candidates', () => {
  const coverage = analyzeCoverage([
    {
      raw: 'GL-123',
      canonicalRef: 'GL-123',
      kind: 'jira',
      title: 'Get clients',
      summary: 'Retrieve clients for an instance',
      description: 'The API should support /{instanceId}/clients.',
      acceptanceCriteria: 'Use /{instanceId}/clients and validate the returned client array.',
      labels: [],
      linkedIssueKeys: [],
      linkedSourceRefs: [],
      endpointCandidates: ['/{instanceId}/clients'],
      fetchedFrom: ['none'],
      warnings: [],
    },
  ]);

  assert.ok(coverage.knownDomains.includes('clients'));
  assert.equal(coverage.inferredDomain, 'clients');
  assert.ok(coverage.requiredArtifacts.includes('feature'));
});

test('createPlanBundle writes the expected bundle artifacts in offline mode', async () => {
  forceOfflineMode();
  const slug = `ai-authoring-test-${Date.now()}`;
  const { bundle, paths } = await createPlanBundle(['GL-123'], slug);
  createdBundleDirs.push(paths.bundleDir);

  assert.equal(bundle.slug, slug);
  assert.ok(fs.existsSync(paths.bundlePath));
  assert.ok(fs.existsSync(paths.sourceContextPath));
  assert.ok(fs.existsSync(paths.coveragePath));
  assert.ok(fs.existsSync(paths.planPath));
});

test('approveBundle marks a proposed bundle as approved', () => {
  const slug = `ai-authoring-approve-${Date.now()}`;
  const bundleDir = path.join(process.cwd(), '.ai/out', slug);
  fs.mkdirSync(bundleDir, { recursive: true });
  createdBundleDirs.push(bundleDir);

  const bundle: AuthoringBundle = {
    schemaVersion: 1,
    slug,
    status: 'proposed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceInputs: ['GL-123'],
    normalizedSources: [],
    endpointCandidates: [],
    coverage: {
      generatedAt: new Date().toISOString(),
      knownDomains: [],
      endpointCandidates: [],
      featureMatches: [],
      requestTemplateMatches: [],
      schemaMatches: [],
      responseModelMatches: [],
      commonStepMatches: [],
      requiredArtifacts: ['feature'],
      gaps: [],
      warnings: [],
    },
    plan: {
      summary: 'Plan summary',
      likelyEndpointCandidates: [],
      alreadyCoveredScenarios: [],
      missingScenarios: [],
      requiredArtifacts: ['feature'],
      destination: { featureFile: 'features/shared/example.feature' },
      implementationNotes: [],
      warnings: [],
      blockers: [],
    },
    warnings: [],
    blockers: [],
  };

  fs.writeFileSync(path.join(bundleDir, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf-8');
  fs.writeFileSync(path.join(bundleDir, 'test-plan.md'), '# Test Plan', 'utf-8');

  const result = approveBundle(slug);
  assert.equal(result.bundle.status, 'approved');
  assert.ok(result.bundle.approvedAt);
});

test('implementBundle refuses to run when a bundle is not approved', async () => {
  const slug = `ai-authoring-guard-${Date.now()}`;
  const bundleDir = path.join(process.cwd(), '.ai/out', slug);
  fs.mkdirSync(bundleDir, { recursive: true });
  createdBundleDirs.push(bundleDir);

  const bundle: AuthoringBundle = {
    schemaVersion: 1,
    slug,
    status: 'proposed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceInputs: ['GL-123'],
    normalizedSources: [],
    endpointCandidates: [],
    coverage: {
      generatedAt: new Date().toISOString(),
      knownDomains: [],
      endpointCandidates: [],
      featureMatches: [],
      requestTemplateMatches: [],
      schemaMatches: [],
      responseModelMatches: [],
      commonStepMatches: [],
      requiredArtifacts: ['feature'],
      gaps: [],
      warnings: [],
    },
    plan: {
      summary: 'Plan summary',
      likelyEndpointCandidates: [],
      alreadyCoveredScenarios: [],
      missingScenarios: [],
      requiredArtifacts: ['feature'],
      destination: { featureFile: 'features/shared/example.feature' },
      implementationNotes: [],
      warnings: [],
      blockers: [],
    },
    warnings: [],
    blockers: [],
  };

  fs.writeFileSync(path.join(bundleDir, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf-8');

  await assert.rejects(() => implementBundle(slug), /must be approved/i);
});

test('implementBundle can retry a previously approved blocked bundle', async () => {
  forceOfflineMode();
  const slug = `ai-authoring-retry-${Date.now()}`;
  const bundleDir = path.join(process.cwd(), '.ai/out', slug);
  fs.mkdirSync(bundleDir, { recursive: true });
  createdBundleDirs.push(bundleDir);

  const bundle: AuthoringBundle = {
    schemaVersion: 1,
    slug,
    status: 'blocked',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    sourceInputs: ['GL-123'],
    normalizedSources: [],
    endpointCandidates: [],
    coverage: {
      generatedAt: new Date().toISOString(),
      knownDomains: [],
      endpointCandidates: [],
      featureMatches: [],
      requestTemplateMatches: [],
      schemaMatches: [],
      responseModelMatches: [],
      commonStepMatches: [],
      requiredArtifacts: ['feature'],
      gaps: [],
      warnings: [],
    },
    plan: {
      summary: 'Plan summary',
      likelyEndpointCandidates: [],
      alreadyCoveredScenarios: [],
      missingScenarios: [],
      requiredArtifacts: ['feature'],
      destination: { featureFile: 'features/shared/example.feature' },
      implementationNotes: [],
      warnings: [],
      blockers: [],
    },
    warnings: [],
    blockers: [],
  };

  fs.writeFileSync(path.join(bundleDir, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf-8');

  const result = await implementBundle(slug);
  assert.equal(result.bundle.status, 'blocked');
  assert.match(result.bundle.implementation?.blockers.join(' ') ?? '', /Configure AI provider credentials/i);
});
