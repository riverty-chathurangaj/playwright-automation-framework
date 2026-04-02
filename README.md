# Testonaut GL — GL Service API Test Automation Framework

An intelligent, AI-powered BDD test automation framework for financial API quality assurance.

**Stack:** TypeScript 5.x · Playwright · playwright-bdd · RabbitMQ (amqplib) · SQL (Knex.js) · Claude AI

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your environment values

# 3. Generate BDD spec files (required before first run)
npm run bdd:gen

# 4. Run smoke tests
npm run test:smoke

# 5. Run full regression
npm run test:regression
```

> **Why `bdd:gen`?** playwright-bdd compiles `.feature` files into Playwright `.spec.js` test files in `.features-gen/`. Run it once after changing any `.feature` file or step definitions.

---

## Test Execution

| Command | Description |
|---|---|
| `npm test` | Generate + run all tests (default project) |
| `npm run test:ui` | Open Playwright UI runner (interactive, filterable) |
| `npm run test:smoke` | Smoke tests only (`@smoke`) |
| `npm run test:regression` | Full regression (`@regression`) |
| `npm run test:negative` | Negative validation tests (`@negative`) |
| `npm run test:schema` | Schema validation tests (`@schema`) |
| `npm run test:security` | Security / auth edge cases (`@security`) |
| `npm run test:transactions` | Transaction scenarios (`@transactions`) |
| `npm run test:messaging` | RabbitMQ message tests (`@messaging`) |
| `npm run test:accounts` | GL Accounts tests (`@accounts`) |
| `npm run test:clients` | Clients controller tests (`@clients`) |
| `npm run test:balance` | Balance query tests (`@balance`) |
| `npm run test:feature` | Run tests matching a tag or title (append `--grep @tag`) |
| `npm run bdd:gen` | Regenerate spec files from feature files only |

### Tag-based execution

```bash
# Run by tag (after bdd:gen)
npx playwright test --grep "@smoke"
npx playwright test --grep "@regression" --grep-invert "@messaging"
npx playwright test --grep "@XRAY-GL-101"

# Run with environment
BASE_URL=https://staging.api.example.com npm run test:smoke

# Run a specific feature by name
npx playwright test --grep "GL Account"
```

### Playwright UI runner

```bash
npm run test:ui
```

Opens a browser-based UI where you can filter by tag, project, or test name, see live results, and view Playwright traces — no separate tooling needed.

---

## Project Structure

```
testonaut-gl/
├── .ai/
│   └── prompts/                # AI prompt templates (scenario gen, failure analysis, etc.)
├── .claude/
│   └── commands/
│       └── framework-guide.md  # Claude slash command: patterns & implementation guide
├── src/
│   ├── core/                   # Foundation: API client, auth, config, logger, retry
│   ├── fixtures/
│   │   └── index.ts            # All Playwright fixtures + Given/When/Then exports
│   ├── messaging/              # RabbitMQ: client, consumer harness, DLQ monitor, publisher
│   ├── database/               # Knex.js: DB client, query builder, snapshot/cleanup managers
│   │   └── queries/            # Domain query helpers (gl-accounts, journal-entries, etc.)
│   ├── schemas/
│   │   └── json-schemas/       # Ajv JSON Schema Draft-07 definitions per endpoint
│   ├── models/
│   │   └── responses/          # TypeScript interfaces for API response types
│   ├── steps/                  # Playwright-BDD step definitions (common + domain)
│   │   ├── common/             # Reusable: api, auth, schema, contract, database, message
│   │   └── clients/            # Domain-specific: clients controller steps
│   ├── support/                # Global setup/teardown, Xray reporter, AI enricher
│   └── utils/                  # PayloadMutator, DataGenerator, Comparator, HttpStatus
├── features/
│   ├── messaging/              # RabbitMQ event tests + DLQ
│   ├── security/               # Auth, token, and security edge cases
│   ├── balance/                # Trial balance and client balance queries
│   ├── transactions/           # Journal entry transaction tests
│   ├── accounts/               # GL Accounts CRUD
│   └── clients/                # Clients controller
├── .features-gen/              # Auto-generated Playwright spec files (gitignored)
├── reports/                    # Generated reports (gitignored)
├── playwright.config.ts        # Playwright + playwright-bdd configuration
├── knexfile.ts                 # Database connection configuration
└── .env.example                # Environment variable template
```

---

## Architecture Overview

```
Feature Files (Gherkin)
        ↓
playwright-bdd (bddgen compiles to .spec.js)
        ↓
Step Definitions (TypeScript — fixture destructuring pattern)
        ↓
src/fixtures/index.ts  (Playwright fixtures — lazy init per test)
        ↓
┌──────────────┬─────────────────┬──────────────┬─────────────┐
│  API Client  │ Schema/Contract │  AMQP Client │  DB Client  │
│ (Playwright  │ Validator (Ajv) │  (amqplib)   │  (Knex.js)  │
│  Request ctx)│                 │              │             │
└──────────────┴─────────────────┴──────────────┴─────────────┘
        ↓
┌─────────────────┬────────────────┬──────────────────────────┐
│  GL Service API │   RabbitMQ     │      SQL Database        │
│  (.NET HTTP)    │  Message Broker│   (SQL Server/PG/MySQL)  │
└─────────────────┴────────────────┴──────────────────────────┘
```

### Fixture Architecture (`src/fixtures/index.ts`)

The central file replacing the old Cucumber `World` class. All fixtures (API, messaging, database) are defined here and are **lazy** — RabbitMQ and database connections only open if a test step actually requests `rabbitClient` or `dbClient`.

```typescript
// All step files import from here — not from @playwright/test
import { Given, When, Then } from '../../fixtures';

// Steps use fixture destructuring — never "this"
When('I send a GET request to {string}', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId },
  path: string
) {
  Object.assign(currentResponse, await apiClient.get(url, {}, activeRole.value));
});
```

---

## Key Features

### Playwright Tracing

`trace: 'on'` is set in `playwright.config.ts`. The `ApiClient` uses the Playwright-managed `request` fixture context, so **every HTTP request is captured in a trace ZIP** automatically. View traces with:

```bash
npx playwright show-trace path/to/trace.zip
```

### Negative Testing

`PayloadMutator` sends any value to any field — bypassing TypeScript's type system for full negative coverage:

```typescript
PayloadMutator.corruptField(payload, 'debitAmount', 'string-in-numeric')
PayloadMutator.corruptField(payload, 'accountCode', 'sql-injection')
PayloadMutator.removeField(payload, 'currency')
```

### Schema Validation

Every endpoint response validated against JSON Schema Draft-07:

```gherkin
Then the response should match schema "journal-entry"
And the response should satisfy contract "journal-entries"
```

### Message Testing

Full RabbitMQ event lifecycle testing with consumer harness:

```gherkin
Given I am listening on exchange "gl.events" with routing key "journal.posted"
When I send a valid POST request to "/api/v1/journal-entries"
Then I should receive 1 message within 10 seconds
And the message should match schema "journal-posted-event"
```

### Database Assertions

Direct DB validation after API operations:

```gherkin
Given I capture a database snapshot of account "1001"
When I send a valid POST request to "/api/v1/journal-entries"
Then a journal entry row should exist in the database
And the account "1001" balance should have changed by 5000.00
```

### AI Integration

Set `AI_ENABLED=true` and configure one provider to activate:
- Anthropic: `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`
- OpenAI: `AI_PROVIDER=openai` + `OPENAI_API_KEY`
- Automatic failure analysis on test failures (attached to Playwright report)
- AI prompts for scenario generation, test data synthesis, schema analysis in `.ai/prompts/`

---

## Reporting

After a test run:

```bash
# Generate and open Allure dashboard
npm run report:generate
npm run report:open

# Serve live from allure-results (no generate step needed)
npm run report:serve
```

| Report | Location |
|---|---|
| Playwright JSON | `reports/playwright-report.json` |
| Allure results (raw) | `reports/allure-results/` |
| Allure HTML dashboard | `reports/allure-report/` |
| Playwright trace ZIPs | `.features-gen/` test output dir |

---

## Environment Variables

See `.env.example` for the complete reference. Key variables:

| Variable | Description |
|---|---|
| `BASE_URL` | GL Service API base URL |
| `TEST_ENV` | dev / staging / uat / prod |
| `RABBITMQ_URL` | amqp://user:pass@host:5672 |
| `DB_CLIENT` | mssql / pg / mysql2 |
| `AI_ENABLED` | true to activate AI failure analysis |
| `AI_PROVIDER` | anthropic (default) or openai |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | Required when `AI_PROVIDER=openai` |
| `XRAY_CLIENT_ID` | For Xray result publishing |
| `GIT_SHA` | Injected by CI; used in `X-Test-Run-Id` header |

---

## Implementation Roadmap

| Phase | Status | Description |
|---|---|---|
| 1 — Foundation | ✅ Complete | Core API client, auth, Playwright setup |
| 2 — BDD Expansion | ✅ Complete | Full positive + negative test coverage |
| 3 — Schema & Contract | ✅ Complete | Ajv validation, drift detection |
| 4 — RabbitMQ Messaging | ✅ Complete | AMQP client, consumer harness, DLQ |
| 5 — Database Validation | ✅ Complete | Knex.js client, snapshots, integrity |
| 6 — E2E & Xray | ✅ Complete | Cross-layer flows, Xray integration |
| 7 — AI Integration | ✅ Complete | Failure analysis, scenario generation |
| 8 — Optimization | 🔄 In Progress | Parallel execution, performance tuning |

### BDD Runtime Migration (March 2026)

Migrated from `@cucumber/cucumber` to `playwright-bdd`:
- `world.ts` + `hooks.ts` replaced by `src/fixtures/index.ts`
- All step files updated to fixture destructuring pattern (`{ apiClient, currentResponse }` instead of `this`)
- `cucumber.js` config replaced by `playwright.config.ts`
- `bddgen` generates `.spec.js` files in `.features-gen/` before each test run
- Playwright tracing (`trace: 'on'`) now captures all HTTP requests via managed `request` context

---

*Testonaut GL — Version 1.0 · March 2026 · Riverty Group GmbH · Quality Engineering*
