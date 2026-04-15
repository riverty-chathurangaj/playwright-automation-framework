export type AIAuthoringSourceKind = 'jira' | 'xray' | 'unknown';

export type BundleStatus = 'proposed' | 'approved' | 'implemented' | 'blocked';

export type RequiredArtifact = 'feature' | 'response-model' | 'json-schema' | 'step-scaffolding-notes';

export type GeneratedFileType = 'feature' | 'response-model' | 'json-schema';

export interface ParsedSourceInput {
  raw: string;
  canonicalRef: string;
  kindHint: AIAuthoringSourceKind | 'auto';
  issueKey?: string;
  issueId?: string;
  url?: string;
}

export interface NormalizedSource {
  raw: string;
  canonicalRef: string;
  kind: AIAuthoringSourceKind;
  issueKey?: string;
  issueId?: string;
  url?: string;
  title: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  priority?: string;
  risk?: string;
  issueType?: string;
  labels: string[];
  linkedIssueKeys: string[];
  linkedSourceRefs: string[];
  endpointCandidates: string[];
  fetchedFrom: Array<'jira' | 'xray' | 'none'>;
  warnings: string[];
}

export interface CoverageFeatureMatch {
  path: string;
  score: number;
  reason: string;
  tags: string[];
  scenarios: string[];
}

export interface CoverageTemplateMatch {
  name: string;
  path: string;
  file: string;
  score: number;
}

export interface CoverageStepMatch {
  step: string;
  file: string;
  score: number;
}

export interface CoverageSnapshot {
  generatedAt: string;
  knownDomains: string[];
  inferredDomain?: string;
  endpointCandidates: string[];
  featureMatches: CoverageFeatureMatch[];
  requestTemplateMatches: CoverageTemplateMatch[];
  schemaMatches: string[];
  responseModelMatches: string[];
  commonStepMatches: CoverageStepMatch[];
  requiredArtifacts: RequiredArtifact[];
  gaps: string[];
  warnings: string[];
}

export interface AuthoringPlanDestination {
  featureFile: string;
  responseModelFile?: string;
  schemaFile?: string;
}

export interface AuthoringPlan {
  summary: string;
  likelyDomain?: string;
  likelyEndpointCandidates: string[];
  alreadyCoveredScenarios: string[];
  missingScenarios: string[];
  requiredArtifacts: RequiredArtifact[];
  destination: AuthoringPlanDestination;
  implementationNotes: string[];
  warnings: string[];
  blockers: string[];
}

export interface GeneratedImplementationFile {
  path: string;
  type: GeneratedFileType;
  rationale: string;
  content: string;
}

export interface ImplementationResult {
  status: 'ready' | 'blocked';
  summary: string;
  warnings: string[];
  blockers: string[];
  notes: string[];
  files: GeneratedImplementationFile[];
  wroteFiles?: string[];
}

export interface AuthoringBundle {
  schemaVersion: number;
  slug: string;
  status: BundleStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  implementedAt?: string;
  sourceInputs: string[];
  normalizedSources: NormalizedSource[];
  inferredDomain?: string;
  endpointCandidates: string[];
  coverage: CoverageSnapshot;
  plan: AuthoringPlan;
  implementation?: ImplementationResult;
  warnings: string[];
  blockers: string[];
}
