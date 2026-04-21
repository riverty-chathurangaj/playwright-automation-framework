# .ai — Developer Tooling Layer

This folder contains reference documentation and configuration for the AI features built into the riverty-playwright-bdd framework. **Nothing here runs during `npm test`.**

---

## Structure

```
.ai/
├── README.md              ← this file
├── config.ts              ← provider reference (live config is in src/core/shared/config.ts)
├── mcp/
│   └── mcp.json           ← stub for future MCP server integration
└── prompts/
    ├── failure-analyzer.md       ← ✅ LIVE — mirrors ai-enricher.ts → analyzeFailure()
    ├── scenario-generator.md     ← ✅ LIVE — mirrors ai-enricher.ts → generateScenariosFromTicket()
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
