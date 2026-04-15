# AI Authoring Plan Prompt

## Purpose
Generate a reviewable test plan bundle from Jira and Xray sources before any repo files are written.

This prompt is mirrored by `src/support/ai-authoring/workflow.ts -> generatePlanWithAI()`.

## CLI usage
```bash
npm run ai:plan -- \
  --source GL-123 \
  --source https://yourcompany.atlassian.net/browse/GL-456 \
  --out gl-balance-plan
```

## Inputs
- Normalized source context from Jira/Xray intake
- Static coverage scan of:
  - `features/**/*.feature`
  - `src/steps/**/*.ts`
  - `src/schemas/json-schemas/*.json`
  - `src/models/responses/*.response.ts`

## Required output
Return JSON only:

```json
{
  "summary": "string",
  "alreadyCoveredScenarios": ["string"],
  "missingScenarios": ["string"],
  "requiredArtifacts": ["feature", "response-model", "json-schema", "step-scaffolding-notes"],
  "destination": {
    "featureFile": "features/<domain>/<name>.feature",
    "responseModelFile": "src/models/responses/<name>.response.ts",
    "schemaFile": "src/schemas/json-schemas/<name>.schema.json"
  },
  "implementationNotes": ["string"],
  "warnings": ["string"],
  "blockers": ["string"]
}
```

## Guardrails
- Reuse the framework’s named-request pattern.
- Prefer existing common steps and domain scaffolding.
- Use status labels like `OK` or `BadRequest`, never raw numeric codes.
- Keep array assertions separate from schema assertions.
- If step scaffolding is ambiguous, call it out as a blocker instead of guessing.

