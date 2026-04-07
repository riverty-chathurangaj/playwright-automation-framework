# Testonaut GL — Agent Guide

BDD API test automation framework for the GL (General Ledger) service.
**Stack:** TypeScript 5.x · Playwright `APIRequestContext` · playwright-bdd 8.x · Chai 5.x · Ajv 8.x · Winston · RabbitMQ (amqplib) · Knex.js

---

## Critical Workflow

```bash
npm run bdd:gen               # Compile .feature → .features-gen/*.spec.ts (REQUIRED after any .feature change)
npm run test                  # Run all tests (all domain projects, excludes @manual)
npm run test:smoke            # Run @smoke tagged tests
npm run test:clients          # Run @clients tagged tests (one script per domain tag)
npm run test:accounts         # Run @accounts tagged tests
npm run test:balance          # Run @balance tagged tests
npm run test:transactions     # Run @transactions tagged tests
npm run test:messaging        # Run @messaging tagged tests
npm run test:security         # Run @security tagged tests
npm run test:accounting-month # Run @accounting-month tagged tests
npm run test:feature          # Run a single feature: npm run test:feature -- "@clients"
npm run test:ui               # Interactive Playwright UI runner
npm run type-check            # tsc --noEmit (no compile output)
npm run lint                  # ESLint on src/
npm run lint:fix              # ESLint with auto-fix
npm run clean                 # Remove dist, reports, .features-gen
npm run report                # Generate + open Allure report
npm run report:generate       # Generate Allure HTML report from allure-results
npm run report:open           # Open generated Allure HTML report
npm run report:serve          # Serve Allure from raw results (no generate step)
```

`bdd:gen` must run before every test execution — all `test:*` scripts call it automatically, but a bare `npx playwright test` does not.

**Note:** `@instances`, `@postings`, and `@report` have projects in `playwright.config.ts` but no dedicated npm scripts — run them via `npx playwright test --project=<name>` after `npm run bdd:gen`.

---

## Architecture: Feature → Spec Pipeline

```
features/<domain>/*.feature
        ↓  npm run bdd:gen
.features-gen/**/*.spec.ts   ← auto-generated, do NOT edit
        ↓  playwright test
```

Step definitions in `src/steps/**/*.ts` are auto-discovered via `playwright.config.ts`. `playwright.config.ts` projects map directly to Gherkin tags — adding a new domain requires a new project entry.

---

## Non-Negotiable Coding Rules

| Rule | Correct | Wrong |
|---|---|---|
| Step imports | `import { When } from '../../fixtures'` | `from 'playwright-bdd'` or `from '@cucumber/cucumber'` |
| Mutate response | `Object.assign(currentResponse, result)` | `currentResponse = result` |
| Body cast | `body as unknown as MyType[]` | `body as MyType[]` |
| HTTP status in `.feature` | `I get the response code of OK` | `the response code should be 200` |
| Nullable in JSON schema | `"type": ["string", "null"]` | `"nullable": true` |

---

## Adding a New Endpoint (3 required artifacts)

**1.** `src/models/responses/<entity>.response.ts` — TypeScript interface matching the **actual** API response (not swagger — verify live).

**2.** `src/schemas/json-schemas/<entity>.schema.json` — JSON Schema Draft-07. `$id` must match the name used in `schemaValidator.validate('<entity>', item)`. Always set `"additionalProperties": false`.

**3.** `src/steps/<domain>/<domain>.steps.ts` — Call `registerTemplates({...})` at module load, add a domain-specific send step, and assertion steps.

Also add the domain tag to `playwright.config.ts` projects array.

---

## Domain Step File Structure

```typescript
import { When, Then } from '../../fixtures';   // ← always from fixtures
import { registerTemplates, resolveEndpoint } from '@utils/request-templates';

// Call at module load — keys registered globally, resolved by common "I define a GET/POST" steps
// ⚠️  Template names must be unique across all domains — duplicates overwrite silently
registerTemplates({
  'clients request': '/{instanceId}/clients',   // {placeholder} resolved via store overrides
  'client departments request': '/{instanceId}/clients/departments',
});

// ⚠️  Do NOT re-define these — they are already in src/steps/common/api.steps.ts:
//   When('I define a GET {string}', ...)
//   When('I define a POST {string}', ...)
//   When('I set {string} to {string}', ...)

// Each domain gets its own named send step — never one generic "send" step
Then('I send the client request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures,
) {
  const { endpoint } = currentRequest;
  if (!endpoint) throw new Error('No request defined.');
  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;
  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});
```

Reference: `src/steps/clients/clients.steps.ts`, `src/utils/request-templates.ts`

---

## Common Steps (do NOT re-define in domain files)

Defined in `src/steps/common/` — use as-is in feature files. See `src/steps/common/*.steps.ts` for the authoritative, exhaustive list — highlights below:

### auth.steps.ts — Authentication

```gherkin
Given I am authenticated as {string}
Given I am not authenticated
Given I am authenticated with an expired token
Given I am authenticated with an invalid token
```

### api.steps.ts — Request Building

```gherkin
# Template-based request definition (templates registered by domain step files)
When I define a GET {string}
When I define a POST {string}
When I define a PUT {string}
When I set {string} to {string}
When I set {string} to the stored value {string}

# Payload manipulation
Given I have a request body:
When I set field {string} to {string} in the payload
When I remove field {string} from the payload
When I corrupt field {string} with {string}

# Direct HTTP verb steps (bypass templates — use URL string directly)
When I send a GET request to {string}
When I send a POST request to {string}
When I send a PUT request to {string}
When I send a PATCH request to {string}
When I send a DELETE request to {string}
When I send a valid POST request to {string} with:
When I send an invalid POST request to {string} with:
```

### api.steps.ts — Response Assertions

```gherkin
# Status
Then I get the response code of {word}
Then the response status should be {word}
Then the response status should be {word} or {word}

# Field assertions
Then the response field {string} should equal {string}
Then the response field {string} should equal {float}
Then the response field {string} should be {string}
Then the response field {string} should not be empty
Then the response field {string} should be a valid UUID
Then the response field {string} should be one of {string}
Then the response should contain field {string}
Then the response should contain required fields:
Then the field {string} should be of type {string}
Then I store the response field {string} as {string}

# Array assertions
Then the response body should be an array
Then the response should be an empty array
Then the response body should be an array with at least {int} item(s)
Then the response array should contain exactly {int} items
Then each item in the response array field {string} should equal {string}

# Error assertions
Then the error message should reference field {string}
Then the error should indicate {string}
Then I see the error message {string}

# Performance
Then the response time should be under {int} milliseconds
```

### schema.steps.ts — Schema Validation

```gherkin
Then the response should match schema {string}
Then the response should NOT match schema {string}
Then each item in the response array should match schema {string}
Then no new undocumented fields should be present in the response
Then no previously documented fields should be missing
Then no field types should have changed from the baseline
Then I have the baseline schema snapshot for {string}
```

### contract.steps.ts — Contract Validation

```gherkin
Then the response should satisfy contract {string}
Then the contract should be satisfied for {string} on {string}
Then the response schema should be valid against contract {string}
```

### message.steps.ts — RabbitMQ Messaging

```gherkin
# Setup / Publishing
Given I am listening on {string}
Given I am listening on the {string} exchange
When I publish the message to {string}
When I publish the message to {string} with routing key {string}
When I publish the same message again to {string}
When I publish a message to {string}:

# Consumption assertions
Then I should receive {int} message(s) within {int} seconds
Then no messages should be received within {int} seconds
Then I should not receive any additional messages within the next {int} seconds

# Error exchange assertions
Then there should be an error on the {string} exchange
Then there should be no errors on the {string} exchange
Then there should be {int} error(s) on the {string} exchange within {int} seconds

# Message field / header assertions
Then the message should match schema {string}
Then the message field {string} should equal {string}
Then the message field {string} should equal {float}
Then the message field {string} should match the API response {string}
Then the message header {string} should equal {string}
Then the message property {string} should not be empty
Then the messages should be in chronological order
Then each message should have a unique {string}
Then each message {string} should match its API response correlation

# DLQ assertions
Then the message should appear in the DLQ within {int} seconds
Then the DLQ message header {string} should contain routing information
Then the DLQ message header {string} should be {string}
Then the DLQ message header {string} should be {int}
Then the message should be retried {int} times
Then after retries are exhausted the message should appear in the DLQ
```

### database.steps.ts — Database Validation

```gherkin
# Setup
Given account {string} exists in the database with balance {float}
Given I capture a database snapshot of account {string}
Given I capture account {string} balance

# Assertions
Then a journal entry row should exist in the database with:
Then a journal entry row should exist in the database matching the API response
Then the account {string} balance should have changed by {float}
Then the journal entry should have a {string} timestamp within {int} seconds of now
Then an audit trail entry should exist with:
Then an audit trail entry should exist for the journal posting
Then the audit {string} should be null
Then the audit {string} should contain the persisted journal data
Then the sum of all debit amounts should equal the sum of all credit amounts
Then the difference should be exactly {float}
Then the result set should be empty
Then the trial balance totals should still be balanced
Then all {int} responses should have status {int}
Then no duplicate journal entry IDs should exist in the database
Then the final account {string} balance should equal the initial balance plus the sum of all posted amounts

# Query steps
When I query the database for trial balance totals
When I query for journal entries with non-existent account codes
When I query for posted journal entries without audit trail
When I send {int} concurrent POST requests to {string} for account {string}
```

Array validation pattern (two steps, separate concerns):
```gherkin
And the response should be an array of clients     ← domain step: non-empty + type check
And each item in the response array should match schema "client"   ← common step: schema contract
```

---

## Fixture System (`src/fixtures/index.ts`)

All fixtures + `{ Given, When, Then }` are exported from a single file. Key fixtures:

| Fixture | Notes |
|---|---|
| `apiClient` | Playwright `APIRequestContext` wrapper with OAuth2 token cache |
| `currentRequest` | Mutable: set `.method`, `.endpoint`, `.queryParams` directly |
| `currentResponse` | Mutable only via `Object.assign` |
| `activeRole` | Mutable wrapper: `activeRole.value = 'a valid client'` |
| `instanceId` | Read-only from `.env`; override via `store('instanceIdOverride', n)` |
| `store` / `retrieve` | Per-test key-value state backed by `testData` |
| `schemaValidator` | Ajv instance; loads all `src/schemas/json-schemas/*.schema.json` at startup |
| `rabbitClient`, `dbClient` | Lazy — only initialised when referenced by a test |
| `_afterTestHook` | Auto-fixture; attaches `Request/Response` JSON on failure; runs AI analysis if `AI_ENABLED=true` |

---

## Auth Flow

`AuthManager` acquires OAuth2 `client_credentials` tokens against `config.auth.baseUrl/oauth/token`. Tokens are cached and auto-refreshed 60 s before expiry. Role strings like `"a valid client"` map to the `AUTH_*` env vars. Auth can be disabled programmatically via `clearTokens()` (used by the `Given I am not authenticated` step). Static tokens can be injected for negative testing via `setStaticToken()` (used by the expired/invalid token steps).

---

## Database — Azure SQL with Entra ID Passwordless

The framework connects to **Azure SQL Database** via Microsoft Entra ID passwordless authentication (`@azure/identity` → `DefaultAzureCredential`). No username/password — developer must be logged in via `az login`.

**Knex + Azure AD gotcha:** Set `type: 'azure-active-directory-default'` at the **connection root level** — NOT nested under `authentication`. Knex maps it internally via `_generateConnection()`.

```typescript
// CORRECT — in db-client.ts buildConnectionConfig()
return { server: cfg.host, database: cfg.name, type: 'azure-active-directory-default', options: { encrypt: true } };
// WRONG — knex strips nested authentication
return { authentication: { type: 'azure-active-directory-default' } };  // ❌
```

**Large tables:** `Data.Transaction` is large — always pass a `CreatedDate` filter to avoid query timeouts.

Reference: `src/database/db-client.ts`, `src/core/config.ts` (`database.authType`)

---

## Messaging → DB Verification Pattern

After publishing a RabbitMQ message and confirming consumption, verify database transactions:
1. `lastPublishedMessage` is stored by common message steps
2. Extract `InstanceId`, `Reference`, `sentTime` from the stored message
3. Poll `Data.Transaction` by `Reference + InstanceId + CreatedDate` cutoff, waiting until rows matching the exact `±Amount` appear in `AmountNotRounded`
4. Assert both a positive and negative entry exist with matching `BundleNumber`

**Important:** The message `Amount` (a number with up to 4 decimals) maps to the `AmountNotRounded` column — NOT `Amount`. The `Amount` column stores the rounded value.

**Polling caveat:** Old records may already exist for the same `Reference`. The polling loop must check for the specific amount match — not just `rows.length > 0`.

### Exchange Labels (`src/messaging/exchanges.ts`)

RabbitMQ exchanges are referenced by friendly labels in feature files — never by raw exchange names:

```gherkin
Given I am listening on "general ledger posting service"
When I publish the message to "general ledger posting service"
Given I am listening on the "general ledger posting service error" exchange
```

| Label | Exchange |
|---|---|
| `general ledger posting service` | `finance.general-ledger-posting-service` |
| `general ledger posting service error` | `finance.general-ledger-posting-service_error` |

New exchanges must be added to `src/messaging/exchanges.ts` — never use raw exchange strings in feature files.

## Message factories

RabbitMQ message templates live in `src/models/test-data/factories/`. Each factory exports a builder function with an overrides parameter:

```typescript
// src/models/test-data/factories/book-client-deposit.factory.ts
buildBookClientDepositMessage(payloadOverrides?, messageId?)
// Amount is randomized via DataGenerator.amount() — always a number, never a string
```

Reference: `src/steps/messaging/book-client-deposit.steps.ts`

### Factory file structure — two exported interfaces (co-located, never in `src/models/responses/`)

Each factory file exports **two TypeScript interfaces** and a builder function:

```typescript
// ── 1. MassTransit outer envelope ────────────────────────────────────────────
export interface BookClientDepositMessage {
  messageId: string;           // UUID
  conversationId: string;
  messageType: string[];       // ['urn:message:GeneralLedger:BookClientDeposit']
  message: BookClientDepositPayload;  // ← GL domain payload
  sentTime: string;            // ISO timestamp — used as CreatedDate cutoff in DB polling
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
  // null fields: requestId, correlationId, initiatorId, responseAddress, faultAddress, expirationTime
}

// ── 2. GL domain payload ─────────────────────────────────────────────────────
export interface BookClientDepositPayload {
  InstanceId: number;
  ClientId: number;
  Source: string;
  Amount: number;              // randomized via DataGenerator.amount() — NEVER a string
  CreatedByUser: string;
  SettledDate: string;
  Reference: string;
  BundleNoSettled: number;
  MerchantId: string;
}

export function buildBookClientDepositMessage(
  payloadOverrides: Partial<BookClientDepositPayload> = {},
  messageId: string = randomUUID(),
): BookClientDepositMessage { /* ... */ }
```

**Rule:** `src/models/responses/` is for HTTP response interfaces only. Message interfaces (envelope + payload) are always co-located in their factory file.

### Message schemas (consumed messages / DLQ)

Runtime schemas for **consumed** messages live in `src/messaging/message-schemas/` — loaded by `MessageValidator` (`src/messaging/message-validator.ts`), **not** the HTTP `SchemaValidator`.

- `dlq-error.schema.json` (`$id: "dlq-error-event"`) — validates `x-death` / DLQ headers

There is **no runtime JSON schema for outbound messages** — TypeScript interfaces enforce the outbound contract at compile time only. Add a `src/messaging/message-schemas/<message>.schema.json` only when you need to validate consumed message structure in a step.

### Adding a new message type — checklist

- [ ] `src/models/test-data/factories/<message>.factory.ts` — export `*Message` (envelope) + `*Payload` interfaces and builder function
- [ ] `src/messaging/exchanges.ts` — register the exchange label if new; **never use raw exchange strings in feature files**
- [ ] `src/steps/messaging/<message>.steps.ts` — publish step, `store('lastPublishedMessage', msg)`, DB verification step
- [ ] (Optional) `src/messaging/message-schemas/<message>.schema.json` — only if runtime validation of a consumed message structure is needed

---

## TypeScript Path Aliases

`tsconfig.json` defines these path aliases — use them in all `src/` files:

| Alias | Resolves to |
|---|---|
| `@core/*` | `src/core/*` |
| `@utils/*` | `src/utils/*` |
| `@models/*` | `src/models/*` |
| `@schemas/*` | `src/schemas/*` |
| `@messaging/*` | `src/messaging/*` |
| `@database/*` | `src/database/*` |
| `@steps/*` | `src/steps/*` |
| `@support/*` | `src/support/*` |
| `@fixtures/*` | `src/fixtures/*` |

Step files may also use relative `../../fixtures` — both are valid, but `@core/config` etc. are preferred in non-step files.

---

## Environment Variables (`.env`)

All variables loaded by `config.ts` have sensible defaults — none are strictly required for the framework to load. However, functional tests need valid credentials.

### Loaded by `src/core/config.ts` (runtime)

**Core:** `BASE_URL` (default: `http://localhost:5000`), `SERVICE_PATH` (default: `gl-service`), `INSTANCE_ID` (default: `1001`), `API_VERSION` (default: `v1`), `TEST_ENV` (default: `dev`), `API_TIMEOUT` (default: `30000`ms)

**Auth:** `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE` — all empty by default; must be set for authenticated tests. Auth uses a **single shared M2M credential set** for all roles (role string is a label only — backend enforces authorization).

**RabbitMQ:** `RABBITMQ_URL` (default: `amqp://guest:guest@localhost:5672`), `RABBITMQ_EXCHANGE`, `RABBITMQ_DLQ`, `RABBITMQ_VHOST`, `RABBITMQ_HEARTBEAT`, `MESSAGE_WAIT_TIMEOUT` (default: `15000`ms)

**Database:** `DB_CLIENT` (default: `mssql`), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default: `GL_Database`), `DB_SCHEMA`, `DB_AUTH_TYPE` (`default` or `azure-active-directory-default`), `DB_QUERY_TIMEOUT`

**AI:** `AI_ENABLED` (default: `false`), `AI_PROVIDER` (`anthropic` or `openai`), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`

**Xray:** `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`, `XRAY_BASE_URL`, `XRAY_PROJECT_KEY`, `XRAY_EXECUTION_KEY`

**CI/Reporting:** `GIT_SHA` (injected by CI; used in `X-Test-Run-Id` header), `LOG_LEVEL` (default: `info`), `REPORT_DIR`

### Present in `.env.example` only (not loaded by config.ts)

`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `GIT_BRANCH`, `GIT_REPO`, `ALLURE_RESULTS_DIR`, `LOG_DIR` — used by CI pipelines or external tooling, not by the framework at runtime.

---

## HTTP Status Labels

`src/utils/http-status.ts` maps labels to codes. Valid labels: `OK` `Created` `Accepted` `NoContent` `BadRequest` `Unauthorized` `Forbidden` `NotFound` `MethodNotAllowed` `Conflict` `UnprocessableEntity` `TooManyRequests` `InternalServerError` `BadGateway` `ServiceUnavailable`

---

## Tags & Run Profiles

### Domain projects (mutually exclusive — one per feature)

Defined as Playwright projects in `playwright.config.ts` with `grep: /@<tag>\b/` and `grepInvert: /@manual/`.

| Project | Tag | npm script |
|---|---|---|
| `clients` | `@clients` | `npm run test:clients` |
| `accounts` | `@accounts` | `npm run test:accounts` |
| `balance` | `@balance` | `npm run test:balance` |
| `transactions` | `@transactions` | `npm run test:transactions` |
| `instances` | `@instances` | `npx playwright test --project=instances` |
| `accounting-month` | `@accounting-month` | `npm run test:accounting-month` |
| `postings` | `@postings` | `npx playwright test --project=postings` |
| `messaging` | `@messaging` | `npm run test:messaging` |
| `security` | `@security` | `npm run test:security` |
| `report` | `@report` | `npx playwright test --project=report` |

### Cross-cutting tags (filtered via `--grep` at CLI)

These are NOT Playwright projects — they apply across all domain projects.

| Tag | npm script | Purpose |
|---|---|---|
| `@smoke` | `npm run test:smoke` | Fast sanity checks |
| `@regression` | `npm run test:regression` | Full coverage |
| `@negative` | `npm run test:negative` | Error paths |
| `@schema` | `npm run test:schema` | Contract/schema validation |

### Special tags

- `@fixme` — playwright-bdd converts to `test.fixme()` → scenario is **skipped** (not executed). Used to mark known API issues.
- `@manual` — Excluded from all automated runs via `grepInvert`.
- `@book-client-deposit` — Sub-domain tag on messaging features (alongside the `@messaging` domain tag).
