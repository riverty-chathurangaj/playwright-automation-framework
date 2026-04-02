# Testonaut GL — Framework Guide & Implementation Patterns

You are helping a developer work on the **Testonaut GL** BDD test automation framework.
When asked to implement new features, step definitions, schemas, or models, follow every pattern below exactly.

---

## Project Stack

| Concern | Library |
|---|---|
| HTTP requests | Playwright `APIRequestContext` (NOT browser) |
| BDD runner | playwright-bdd 8.x (generates `.spec.ts` from `.feature` files) |
| BDD config | `playwright.config.ts` via `defineBddConfig()` |
| Fixtures / state | `src/fixtures/index.ts` — replaces Cucumber `World` |
| Assertions | Chai 5.x (`expect(...).to.be.true`, `.to.equal`, `.to.be.at.least`) |
| Schema validation | Ajv 8.x + `ajv-formats`, JSON Schema Draft-07 |
| Type safety | TypeScript 5.x strict mode |
| Logging | Winston (`src/core/logger.ts`) |

---

## Project Layout

```
src/
├── core/                          # Config, HTTP client, auth, logging, retry
├── fixtures/index.ts              # ALL fixtures + { Given, When, Then } exports
├── steps/
│   ├── common/                    # Reusable across all domains
│   │   ├── api.steps.ts           # Generic HTTP + response assertions
│   │   ├── schema.steps.ts        # Schema/contract validation
│   │   ├── auth.steps.ts
│   │   ├── contract.steps.ts
│   │   ├── database.steps.ts
│   │   └── message.steps.ts
│   └── <domain>/
│       └── <domain>.steps.ts      # REQUEST_TEMPLATES + send step + assertions
├── schemas/
│   ├── json-schemas/              # *.schema.json — one per response type
│   └── schema-validator.ts        # Loads + validates via Ajv
├── models/
│   ├── responses/                 # *.response.ts — HTTP response interfaces ONLY
│   └── test-data/
│       ├── factories/             # *.factory.ts — MassTransit envelope + payload interfaces + builder
│       └── fixtures/
│           └── swagger.json       # OpenAPI spec (starting point — verify against actual API)
├── messaging/
│   ├── exchanges.ts               # Friendly label → RabbitMQ exchange name registry
│   ├── message-schemas/           # *.schema.json — schemas for consumed/DLQ messages (NOT API responses)
│   └── ...                        # rabbit-client, publisher, consumer-harness, dlq-monitor, message-validator
└── support/                       # global-setup, global-teardown, ai-enricher
features/
└── <domain>/
    └── <domain>.feature
```

---

## How playwright-bdd works

1. `npm run bdd:gen` — reads `.feature` files → generates `.spec.ts` in `.features-gen/`
2. `playwright test` runs the generated specs
3. Step definitions in `src/steps/**/*.ts` are auto-discovered via `playwright.config.ts`

**Always run `npm run bdd:gen` after changing any `.feature` file.**

---

## Pattern 1 — HTTP Status Codes (labels only, never numbers)

```gherkin
# Correct
Then I get the response code of OK
Then I get the response code of BadRequest

# Wrong
Then the response code should be 200
```

Available labels: `OK`, `Created`, `Accepted`, `NoContent`, `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `MethodNotAllowed`, `Conflict`, `UnprocessableEntity`, `TooManyRequests`, `InternalServerError`, `BadGateway`, `ServiceUnavailable`

---

## Pattern 2 — Adding a New Endpoint (three required artifacts)

Use `src/models/test-data/fixtures/swagger.json` as the **starting point** only.
**Always verify the schema against an actual API run** — swagger may reference the wrong component schema.

### Artifact 1 — TypeScript Interface (`src/models/responses/`)

```typescript
// src/models/responses/client-department.response.ts
// Client department as returned by GET /gl-service/{instanceId}/clients/departments
export interface ClientDepartmentResponse {
  recno: number;
  name: string;
  description: string | null;
}
```

- One file per response type, named `<entity>.response.ts`
- Fields must match the **actual API response**
- Nullable fields use `T | null`

### Artifact 2 — JSON Schema (`src/schemas/json-schemas/`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "client-department",
  "title": "GLClientDepartment",
  "type": "object",
  "properties": {
    "recno":       { "type": "integer" },
    "name":        { "type": "string" },
    "description": { "type": ["string", "null"] }
  },
  "additionalProperties": false
}
```

- `$id` must match the name used in `schemaValidator.validate('client-department', item)`
- Nullable fields: `["type", "null"]` — NOT OpenAPI's `nullable: true`
- `"additionalProperties": false` — locks schema to known fields
- Schema type is always `"object"` (never array at the root)

### Artifact 3 — Step definitions (see Pattern 5)

---

## Pattern 3 — Step Organisation

- **Common steps** go in `src/steps/common/` — if reusable across domains
- **Domain steps** go in `src/steps/<domain>/` — REQUEST_TEMPLATES, send steps, assertions
- Never duplicate a step definition across files

### All step files import from fixtures — no exceptions

```typescript
// CORRECT
import { When, Then } from '../../fixtures';

// WRONG
import { When, Then } from '@cucumber/cucumber';  // ❌
import { When, Then } from 'playwright-bdd';       // ❌
```

### Available common steps (do NOT re-define in domain files)

```gherkin
Given I am authenticated as {string}
Then I get the response code of {word}
Then the response should match schema {string}
Then each item in the response array should match schema {string}
Then the response field {string} should equal {string}
Then I store the response field {string} as {string}
Then the stored count {string} should be less than {string}
```

---

## Pattern 4 — Step Definition Signature (fixture destructuring, never `this`)

```typescript
import { When, Then } from '../../fixtures';
import { expect } from 'chai';

type MyFixtures = {
  apiClient: ApiClient;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  instanceId: number;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

// CORRECT — fixtures as first argument, step args after
When('I define a GET {string}', function (
  { currentRequest }: Pick<MyFixtures, 'currentRequest'>,
  requestName: string,
) {
  // ...
});

// WRONG — Cucumber World pattern, does not work with playwright-bdd
When('...', async function (this: any, arg) { this.currentResponse = ...; }); // ❌
```

### Mutable state rules

| Fixture | How to mutate |
|---|---|
| `currentRequest` | Set properties: `currentRequest.method = 'GET'` |
| `currentResponse` | `Object.assign(currentResponse, apiResult)` — never reassign |
| `activeRole` | `activeRole.value = 'a valid client'` |
| `instanceId` (primitive) | `store('instanceIdOverride', Number(value))` |

**Never do `currentResponse = result`** — rebinds local variable only. Always use `Object.assign`.

---

## Pattern 5 — Domain Step File Structure (full example)

```typescript
import { When, Then } from '../../fixtures';
import { expect } from 'chai';
import { config } from '../../core/config';
import { ClientResponse } from '../../models/responses/client.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────
const REQUEST_TEMPLATES: Record<string, string> = {
  'clients request': '/{instanceId}/clients',
  'client departments request': '/{instanceId}/clients/departments',
};

type ClientFixtures = {
  apiClient: ApiClient;
  schemaValidator: SchemaValidator;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  instanceId: number;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

// ── 2. Request building ──────────────────────────────────────────────────────

When('I define a GET {string}', function (
  { currentRequest }: Pick<ClientFixtures, 'currentRequest'>,
  requestName: string,
) {
  const template = REQUEST_TEMPLATES[requestName];
  if (!template) {
    throw new Error(`Unknown request: "${requestName}". Known: ${Object.keys(REQUEST_TEMPLATES).join(', ')}`);
  }
  currentRequest.method = 'GET';
  currentRequest.endpoint = template;  // stored as template — resolved at send time
  delete currentRequest.queryParams;
});

When('I set {string} to {string}', function (
  { store }: Pick<ClientFixtures, 'store'>,
  param: string,
  value: string,
) {
  if (param === 'instanceId') {
    store('instanceIdOverride', Number(value));
  } else {
    throw new Error(`Unknown parameter "${param}"`);
  }
});

// ── 3. Send steps (one per request type) ────────────────────────────────────

Then('I send the client request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures,
) {
  const { method, endpoint } = currentRequest;
  if (!method || !endpoint) throw new Error('No request defined.');
  const effectiveId = retrieve<number>('instanceIdOverride') ?? instanceId;
  const resolvedEndpoint = `${apiBase}${endpoint.replace('{instanceId}', String(effectiveId))}`;
  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

// ── 4. Response assertions ───────────────────────────────────────────────────

Then('the response should be an array of clients', function (
  { currentResponse, schemaValidator }: Pick<ClientFixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as ClientResponse[];
  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 client').to.be.at.least(1);
  body.forEach((client, index) => {
    const result = schemaValidator.validate('client', client);
    expect(result.valid, `Schema failed at [${index}]:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`).to.be.true;
  });
});
```

---

## Pattern 6 — Feature File Structure

```gherkin
@clients
Feature: Clients
  As a user of the GL API
  I should be able to retrieve client information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @smoke
  Scenario Outline: I should be able to get a list of clients for a given instance
    When I define a GET "clients request"
    And I set "instanceId" to "<instanceId>"
    Then I send the client request to the API
    And I get the response code of OK
    And the response should be an array of clients

    Examples:
      | instanceId |
      | 2001       |
      | 2002       |

  Scenario: Verify behavior with invalid instanceId
    When I define a GET "clients request"
    And I set "instanceId" to "99999"
    Then I send the client request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  Scenario: I should be able to get a list of client departments for a given instance
    When I define a GET "client departments request"
    And I set "instanceId" to "2001"
    Then I send the client departments request to the API
    And I get the response code of OK
    And the response should be an array of client departments
    And each item in the response array should match schema "client-department"
```

### Array response — two-step validation pattern

```gherkin
And the response should be an array of clients                       ← domain step: non-empty check
And each item in the response array should match schema "client"     ← common step: schema contract
```

Do NOT combine both into one step — separate concerns = clearer failure messages.

---

## Pattern 7 — Adding a New Controller (checklist)

- [ ] Read `src/models/test-data/fixtures/swagger.json` for endpoint definition
- [ ] Make a live API call to verify actual response shape (swagger may be wrong)
- [ ] `src/models/responses/<entity>.response.ts` — TypeScript interface
- [ ] `src/schemas/json-schemas/<entity>.schema.json` — JSON Schema Draft-07
- [ ] `features/<domain>/<domain>.feature` — Gherkin with `@<domain>` tag
- [ ] `src/steps/<domain>/<domain>.steps.ts` — REQUEST_TEMPLATES + send + assertions
- [ ] Add project to `playwright.config.ts` projects array for new domain

---

## Fixture Reference

```typescript
type GLFixtures = {
  apiClient: ApiClient;               // Playwright HTTP client
  currentRequest: CurrentRequest;     // { method, endpoint, body, headers, queryParams }
  currentResponse: CurrentResponse;   // { status, body, headers, duration, correlationId }
  testData: Record<string, unknown>;  // Generic test state store
  activeRole: { value: string };      // Auth role wrapper
  instanceId: number;                 // Default from .env; override via store()
  schemaValidator: SchemaValidator;   // Ajv validator, loads *.schema.json on startup
  store: (key: string, value: unknown) => void;
  retrieve: <T>(key: string) => T;
  // Lazy: rabbitClient, consumerHarness, messagePublisher, dlqMonitor, messageValidator
  // Lazy: dbClient, snapshotManager, cleanupManager, queryBuilder
  _afterTestHook: void;               // Auto: attaches req/resp on failure, optional AI analysis
};
```

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

**`Data.Transaction` columns:** `Id`, `PartitionId`, `InstanceId`, `BundleNumber`, `ClientId`, `OrgnoClient`, `EventId`, `EventCombinationId`, `EventCombinationNumber`, `PostingId`, `PostingNumber`, `AccountingYear`, `AccountingMonth`, `AccountingYearMonth`, `Account`, `Amount`, `AmountNotRounded`, `ReceiverBankAccount`, `CustomerGuid`, `CustomerNumber`, `InvoiceNumber`, `OrderNumber`, `MerchantId`, `VoucherGuid`, `VoucherAllocationGuid`, `VoucherDate`, `ParentTransactionReference`, `Reference`, `Reference2`, `CreatedDate`, `CreatedByUser`, `ApplicationId`, `TransactionRequestLogId`

Reference: `src/database/db-client.ts`, `src/core/config.ts` (`database.authType`)

---

## Messaging → DB Verification Pattern

After publishing a RabbitMQ message and confirming consumption, verify the resulting database transactions:
1. `lastPublishedMessage` is stored by common message steps
2. Extract `InstanceId`, `Reference`, `sentTime` from the stored message
3. Poll `Data.Transaction` with `getTransactionsByReferenceWithRetry()` using a `CreatedDate` cutoff
4. Assert at least 1 transaction row exists

```gherkin
Then I should receive 1 message within 30 seconds
And the transactions from the book client deposit message should exist in the database
```

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

## Tag → Run Profile Mapping

| Tag | npm script | Purpose |
|---|---|---|
| `@smoke` | `npm run test:smoke` | Fast sanity checks |
| `@regression` | `npm run test:regression` | Full coverage |
| `@negative` | `npm run test:negative` | Error paths |
| `@schema` | `npm run test:schema` | Contract/schema validation |
| `@security` | `npm run test:security` | Auth & permissions |
| `@clients` | `npm run test:clients` | Client endpoints |
| `@accounts` | `npm run test:accounts` | Account endpoints |
| `@balance` | `npm run test:balance` | Balance endpoints |
| `@transactions` | `npm run test:transactions` | Transaction endpoints |
| `@messaging` | `npm run test:messaging` | Async queue ops |
| `@manual` | (excluded) | Manual testing only |

---

## Common Mistakes

| Mistake | Correct |
|---|---|
| `import { Given } from '@cucumber/cucumber'` | `import { Given } from '../../fixtures'` |
| `this.currentResponse = result` | `Object.assign(currentResponse, result)` |
| `currentResponse = result` (local rebind) | `Object.assign(currentResponse, result)` |
| `body as ClientResponse[]` | `body as unknown as ClientResponse[]` |
| Numeric codes in features (`200`, `404`) | Labels: `OK`, `NotFound` |
| Re-defining a common step in a domain file | Check `src/steps/common/` first |
| Using OpenAPI `nullable: true` in JSON schema | Use `["type", "null"]` (Draft-07) |
| Trusting swagger without verifying against live API | Always run the endpoint and check actual response |
| Forgetting `npm run bdd:gen` after feature changes | Run before any test run |
| One generic "send" step for all request types | Each request type gets its own named send step |
| Root-level array schema in `schemaValidator.validate()` | Object schema + `each item in the response array should match schema` |
| Nesting `authentication` in knex mssql connection | Use `type: 'azure-active-directory-default'` at root level |
| Querying `Data.Transaction` without date filter | Always pass `CreatedDate` cutoff — table is large |
| Matching message Amount against `Amount` column | Match against `AmountNotRounded` — `Amount` is rounded |
| Polling DB returning on `rows.length > 0` | Poll until specific amount match — old records exist for same Reference |
| Putting message interfaces in `src/models/responses/` | Co-locate in factory file: `src/models/test-data/factories/<message>.factory.ts` |
| Raw exchange string in feature/step file | Register label in `src/messaging/exchanges.ts`, use `resolveExchange(label)` |
| Runtime message validation using HTTP `SchemaValidator` | Use `MessageValidator` (`src/messaging/message-validator.ts`) + schemas from `src/messaging/message-schemas/` |
