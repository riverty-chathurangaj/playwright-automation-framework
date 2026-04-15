# .ai — Developer Tooling Layer

This folder contains reference documentation and configuration for the AI features built into the pw-testforge-gls framework. **Nothing here runs during `npm test`.**

---

## Structure

```
.ai/
├── README.md              ← this file
├── config.ts              ← provider reference (live config is in src/core/config.ts)
├── mcp/
│   └── mcp.json           ← stub for future MCP server integration
├── out/                   ← generated plan/approval/implementation bundles (gitignored)
└── prompts/
    ├── failure-analyzer.md       ← ✅ LIVE — mirrors ai-enricher.ts → analyzeFailure()
    ├── scenario-generator.md     ← ✅ LIVE — mirrors ai-enricher.ts → generateScenariosFromTicket()
    ├── authoring-plan.md         ← ✅ LIVE — mirrors workflow.ts → generatePlanWithAI()
    ├── authoring-implementer.md  ← ✅ LIVE — mirrors workflow.ts → generateImplementationWithAI()
    ├── schema-analyzer.md        ← 🟡 SPEC — schema drift detection (not yet implemented)
    └── test-data-generator.md    ← 🟡 SPEC — financial test data generation (not yet implemented)
```

---

## Live AI features

### 1. Failure Analysis (automatic)
Fires after every failed test. Attaches root cause analysis to the Allure report Overview tab.

```bash
# Runs automatically — no action needed.
# Configure via .env:
AI_ENABLED=true
AI_PROVIDER=azure-openai
AI_MODEL=o4-mini
```

### 2. Scenario Generation (CLI)
Generate a `.feature` file from a Jira ticket description.

```bash
npm run ai:generate -- \
  --ticket   "GL-456: Filter balance by currency" \
  --ac       "Endpoint accepts currency code filter; returns 400 for invalid codes" \
  --endpoint "/{instanceId}/balance" \
  --domain   balance \
  --out      balance-currency-filter.feature
```

See `prompts/scenario-generator.md` for the full rule set the AI follows.

### 3. AI Authoring Workflow (CLI)
Create a reviewable bundle from Jira/Xray inputs, approve it, then implement repo artifacts.

```bash
npm run ai:plan -- \
  --source GL-456 \
  --source https://yourcompany.atlassian.net/browse/GL-789 \
  --out gl-balance-plan

npm run ai:approve -- --from gl-balance-plan
npm run ai:implement -- --from gl-balance-plan
```

Bundle output is written under `.ai/out/<slug>/`:

- `source-context.json`
- `coverage-analysis.md`
- `test-plan.md`
- `bundle.json`
- `implementation-preview.json` after `ai:implement`

The workflow is human-approved by design:

- `ai:plan` writes a `proposed` bundle
- `ai:approve` marks the bundle `approved`
- `ai:implement` refuses to write repo files unless the bundle is approved

Phase 1 accepts Jira issue IDs/URLs and Xray issue-backed IDs/URLs. Detailed Xray-native test-step ingestion is intentionally deferred; linked counterpart discovery currently relies on the Jira issue metadata available to the workflow.

---

## Planned AI features (not yet implemented)

| Feature | Prompt spec | Description |
|---|---|---|
| Schema drift detection | `prompts/schema-analyzer.md` | Compares baseline vs current API response, flags breaking changes |
| Test data generator | `prompts/test-data-generator.md` | Generates financially-accurate test data (balanced entries, ISO currencies, edge cases) |

---

## Provider configuration

Set `AI_PROVIDER` in `.env`. See `.env.example` for all required env vars per provider.

| Provider | Model | Notes |
|---|---|---|
| `azure-openai` *(active)* | `o4-mini` | Reasoning model — uses `max_completion_tokens`, no `temperature` |
| `openai` | `gpt-4o`, `gpt-4o-mini` | Uses `responses.create()` API |
| `anthropic` | `claude-opus-4-6`, `claude-sonnet-4-6` | Uses `messages.create()` API |
