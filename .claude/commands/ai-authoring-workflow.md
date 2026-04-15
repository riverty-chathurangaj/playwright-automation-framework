# AI Authoring Workflow

Use the repo-owned CLI workflow instead of inventing a custom agent flow.

## Plan
Run:

```bash
npm run ai:plan -- --source <jira-or-xray-id-or-url> [--source ...] [--out <slug>]
```

Then review:

- `.ai/out/<slug>/source-context.json`
- `.ai/out/<slug>/coverage-analysis.md`
- `.ai/out/<slug>/test-plan.md`
- `.ai/out/<slug>/bundle.json`

## Approval
Do not implement until the user has approved the generated plan.

Once approved:

```bash
npm run ai:approve -- --from <slug>
```

## Implementation
Only after approval:

```bash
npm run ai:implement -- --from <slug>
```

## Guardrails
- Reuse the repo’s common steps and domain scaffolding.
- Use named requests and status labels.
- Keep array assertions separate from schema assertions.
- If implementation requires unclear step-definition work, stop and surface the blocker instead of guessing.

