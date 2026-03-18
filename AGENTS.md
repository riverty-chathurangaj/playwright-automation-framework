# Testonaut GL — Agent Guide

BDD API test automation framework for the GL (General Ledger) service.
**Stack:** TypeScript 5.x · Playwright `APIRequestContext` · playwright-bdd 8.x · Chai 5.x · Ajv 8.x · Winston · RabbitMQ (amqplib) · Knex.js

---

## Critical Workflow

```bash
npm run bdd:gen          # Compile .feature → .features-gen/*.spec.ts (REQUIRED after any .feature change)
npm run test:smoke       # Run @smoke tagged tests
npm run test:clients     # Run @clients tagged tests (one script per domain tag)
npm run test:ui          # Interactive Playwright UI runner
npm run type-check       # tsc --noEmit (no compile output)
npm run lint             # ESLint on src/
```

`bdd:gen` must run before every test execution — all `test:*` scripts call it automatically, but a bare `npx playwright test` does not.

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

**3.** `src/steps/<domain>/<domain>.steps.ts` — Add entry to `REQUEST_TEMPLATES`, a named send step, and assertion steps.

Also add the domain tag to `playwright.config.ts` projects array.

---

## Domain Step File Structure

```typescript
import { When, Then } from '../../fixtures';   // ← always from fixtures
const REQUEST_TEMPLATES: Record<string, string> = {
  'clients request': '/{instanceId}/clients',   // template — resolved at send time
};

// Step receives fixture object as first arg, step params after
When('I define a GET {string}', function (
  { currentRequest }: Pick<ClientFixtures, 'currentRequest'>,
  requestName: string,
) { ... });

// Each domain gets its own named send step — never one generic "send" step
Then('I send the client request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures,
) {
  const effectiveId = retrieve<number>('instanceIdOverride') ?? instanceId;
  Object.assign(currentResponse, await apiClient.get(resolvedUrl, {}, activeRole.value));
});
```

Reference: `src/steps/clients/clients.steps.ts`

---

## Common Steps (do NOT re-define in domain files)

Defined in `src/steps/common/` — use as-is in feature files:

```gherkin
Given I am authenticated as "a valid client"
Then I get the response code of OK
Then the response should match schema "gl-error"
Then each item in the response array should match schema "client"
Then the response field "status" should equal "active"
Then I store the response field "id" as "createdId"
Then the stored count "filteredCount" should be less than "totalCount"
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

## Message factories

RabbitMQ message templates live in `src/models/test-data/factories/`. Each factory exports a builder function with an overrides parameter:

```typescript
// src/models/test-data/factories/book-client-deposit.factory.ts
buildBookClientDepositMessage(payloadOverrides?, messageId?)
// Amount is randomized via DataGenerator.amount() — always a number, never a string
```

Reference: `src/steps/messaging/book-client-deposit.steps.ts`

---

## Environment Variables (`.env`)

Key variables: `BASE_URL`, `SERVICE_PATH` (default: `gl-service`), `INSTANCE_ID`, `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE`, `RABBITMQ_URL`, `DB_HOST`, `DB_AUTH_TYPE` (`default` or `azure-active-directory-default`), `DB_NAME`, `AI_ENABLED`, `AI_API_KEY`.

`src/core/config.ts` throws on startup for any `required()` variable that is unset.

---

## HTTP Status Labels

`src/utils/http-status.ts` maps labels to codes. Valid labels: `OK` `Created` `Accepted` `NoContent` `BadRequest` `Unauthorized` `Forbidden` `NotFound` `MethodNotAllowed` `Conflict` `UnprocessableEntity` `TooManyRequests` `InternalServerError` `BadGateway` `ServiceUnavailable`
