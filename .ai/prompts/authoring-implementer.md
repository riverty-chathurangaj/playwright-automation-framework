# AI Authoring Implementer Prompt

## Purpose
Generate approved repo artifacts from an already-approved authoring bundle.

This prompt is mirrored by `src/support/ai-authoring/workflow.ts -> generateImplementationWithAI()`.

## CLI usage
```bash
npm run ai:approve -- --from gl-balance-plan
npm run ai:implement -- --from gl-balance-plan
```

## Required output
Return JSON only:

```json
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
```

## Guardrails
- Only write under `features/`, `src/models/responses/`, and `src/schemas/json-schemas/`.
- Do not invent new domain step files in Phase 1.
- If request-template or step-definition work is required, return `status: "blocked"` and explain why.
- Use named requests, status labels, and split array/schema assertions.
- If the bundle is not approved, the CLI must refuse to write repo files.

