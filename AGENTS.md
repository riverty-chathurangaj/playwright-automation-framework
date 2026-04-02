# Testonaut GL — Agent Guide

BDD API test automation framework for the GL (General Ledger) service.
**Stack:** TypeScript 5.x · Playwright `APIRequestContext` · playwright-bdd 8.x · Chai 5.x · Ajv 8.x · Winston · RabbitMQ (amqplib) · Knex.js

---

## Critical Workflow

```bash
npm run bdd:gen               # Compile .feature → .features-gen/*.spec.ts (REQUIRED after any .feature change)
npm run test:smoke            # Run @smoke tagged tests
npm run test:clients          # Run @clients tagged tests (one script per domain tag)
npm run test:accounting-month # Run @accounting-month tagged tests
npm run test:ui               # Interactive Playwright UI runner
npm run type-check            # tsc --noEmit (no compile output)
npm run lint                  # ESLint on src/
npm run lint:fix              # ESLint with auto-fix
npm run clean                 # Remove dist, reports, .features-gen
npm run report:generate       # Generate Allure HTML report from allure-results
npm run report:open           # Open generated Allure HTML report
npm run report:serve          # Serve Allure from raw results (no generate step)
```

`bdd:gen` must run before every test execution — all `test:*` scripts call it automatically, but a bare `npx playwright test` does not.

**Note:** `@instances` and `@postings` have projects in `playwright.config.ts` but no dedicated npm scripts — run them via `npx playwright test --project=instances` / `--project=postings` after `npm run bdd:gen`.

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

Defined in `src/steps/common/` — use as-is in feature files:

```gherkin
# Auth (auth.steps.ts)
Given I am authenticated as "a valid client"
Given I am not authenticated
Given I am authenticated with an expired token
Given I am authenticated with an invalid token

# Request building (api.steps.ts) — do NOT re-define in domain files
When I define a GET "clients request"
When I define a POST "clients request"
When I define a PUT "clients request"
When I set "instanceId" to "2001"
When I set "instanceId" to the stored value "createdId"

# Response status (api.steps.ts)
Then I get the response code of OK
Then the response status should be OK

# Response field assertions (api.steps.ts)
Then the response field "status" should equal "active"
Then the response field "status" should be "null"
Then the response field "id" should not be empty
Then the response field "guid" should be a valid UUID
Then I store the response field "id" as "createdId"

# Array assertions (api.steps.ts)
Then the response body should be an array
Then the response should be an empty array
Then the response body should be an array with at least 1 item(s)
Then the response array should contain exactly 5 items

# Schema validation (schema.steps.ts)
Then the response should match schema "gl-error"
Then the response should NOT match schema "client"
Then each item in the response array should match schema "client"
Then no new undocumented fields should be present in the response

# Contract validation (contract.steps.ts)
Then the response should satisfy contract "journal-entries"
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

`AuthManager` acquires OAuth2 `client_credentials` tokens against `config.auth.baseUrl/oauth/token`. Tokens are cached and auto-refreshed 60 s before expiry. Role strings like `"a valid client"` map to the `AUTH_*` env vars. Setting `AUTH_DISABLED=true` bypasses auth entirely (returns empty token).

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

Key variables: `BASE_URL`, `SERVICE_PATH` (default: `gl-service`), `INSTANCE_ID`, `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE`, `AUTH_DISABLED` (`true` bypasses auth), `RABBITMQ_URL`, `DB_HOST`, `DB_AUTH_TYPE` (`default` or `azure-active-directory-default`), `DB_NAME`, `AI_ENABLED`, `ANTHROPIC_API_KEY` (required when `AI_ENABLED=true`), `GIT_SHA` (injected by CI; used in `X-Test-Run-Id` header).

`src/core/config.ts` throws on startup for any `required()` variable that is unset.

---

## HTTP Status Labels

`src/utils/http-status.ts` maps labels to codes. Valid labels: `OK` `Created` `Accepted` `NoContent` `BadRequest` `Unauthorized` `Forbidden` `NotFound` `MethodNotAllowed` `Conflict` `UnprocessableEntity` `TooManyRequests` `InternalServerError` `BadGateway` `ServiceUnavailable`
