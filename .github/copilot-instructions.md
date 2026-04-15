# pw-testforge-gls — Framework Guide & Implementation Patterns

You are helping a developer work on a **pw-testforge-gls** BDD test automation framework project. When asked to implement new features, step definitions, schemas, or models, follow every pattern below exactly.

---

## Project Stack

| Concern           | Library                                                             |
| ----------------- | ------------------------------------------------------------------- |
| HTTP requests     | Playwright `APIRequestContext` (NOT browser)                        |
| BDD runner        | playwright-bdd 8.x (generates `.spec.ts` from `.feature` files)     |
| BDD config        | `playwright.config.ts` via `defineBddConfig()`                      |
| Fixtures / state  | `src/fixtures/index.ts` — replaces Cucumber `World`                 |
| Assertions        | Chai 5.x (`expect(...).to.be.true`, `.to.equal`, `.to.be.at.least`) |
| Schema validation | Ajv 8.x + `ajv-formats`, JSON Schema Draft-07                       |
| Type safety       | TypeScript 5.x strict mode                                          |
| Logging           | Winston (`src/core/logger.ts`)                                      |

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
│       └── <domain>.steps.ts      # registerTemplates() + send step + assertions
├── schemas/
│   ├── json-schemas/              # *.schema.json — one per response type
│   └── schema-validator.ts        # Loads + validates via Ajv
├── models/
│   ├── responses/                 # *.response.ts — HTTP response interfaces ONLY
│   └── test-data/
│       ├── factories/             # *.factory.ts — message envelope + payload interfaces + builder
│       └── fixtures/
│           └── swagger.json       # OpenAPI spec (starting point — verify against actual API)
├── messaging/
│   ├── exchanges.ts               # Friendly label → RabbitMQ exchange name registry
│   ├── message-schemas/           # *.schema.json — schemas for consumed/DLQ messages (NOT API responses)
│   └── ...                        # rabbit-client, publisher, consumer-harness, dlq-monitor, message-validator
├── database/
│   └── db-client.ts               # Knex database client with configurable auth
├── utils/
│   ├── request-templates.ts       # Central template registry: registerTemplates(), getTemplate(), resolveEndpoint()
│   └── http-status.ts             # Status label → code map: resolveStatus('OK') → 200
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
// src/models/responses/department.response.ts
export interface DepartmentResponse {
  id: number;
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
  "$id": "department",
  "title": "Department",
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" },
    "description": { "type": ["string", "null"] }
  },
  "additionalProperties": false
}
```

- `$id` must match the name used in `schemaValidator.validate('department', item)`
- Nullable fields: `["type", "null"]` — NOT OpenAPI's `nullable: true`
- `"additionalProperties": false` — locks schema to known fields
- Schema type is always `"object"` (never array at the root)

### Artifact 3 — Step definitions (see Pattern 5)

---

## Pattern 3 — Step Organisation

- **Common steps** go in `src/steps/common/` — if reusable across domains
- **Domain steps** go in `src/steps/<domain>/` — `registerTemplates()`, send steps, assertions
- Never duplicate a step definition across files

### All step files import from fixtures — no exceptions

```typescript
// CORRECT
import { When, Then } from '../../fixtures';

// WRONG
import { When, Then } from '@cucumber/cucumber'; // ❌
import { When, Then } from 'playwright-bdd'; // ❌
```

### Available common steps (do NOT re-define in domain files)

#### auth.steps.ts

```gherkin
Given I am authenticated as {string}
Given I am not authenticated
Given I am authenticated with an expired token
Given I am authenticated with an invalid token
```

#### api.steps.ts — Request Building

```gherkin
When I define a GET {string}
When I define a POST {string}
When I define a PUT {string}
When I set {string} to {string}
When I set {string} to the stored value {string}
Given I have a request body:
When I set field {string} to {string} in the payload
When I remove field {string} from the payload
When I corrupt field {string} with {string}
When I send a GET request to {string}
When I send a POST request to {string}
When I send a PUT request to {string}
When I send a PATCH request to {string}
When I send a DELETE request to {string}
When I send a valid POST request to {string} with:
When I send an invalid POST request to {string} with:
```

#### api.steps.ts — Response Assertions

```gherkin
Then I get the response code of {word}
Then the response status should be {word}
Then the response status should be {word} or {word}
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
Then the response body should be an array
Then the response should be an empty array
Then the response body should be an array with at least {int} item(s)
Then the response array should contain exactly {int} items
Then each item in the response array field {string} should equal {string}
Then the error message should reference field {string}
Then the error should indicate {string}
Then I see the error message {string}
Then the response time should be under {int} milliseconds
```

#### schema.steps.ts

```gherkin
Then the response should match schema {string}
Then the response should NOT match schema {string}
Then each item in the response array should match schema {string}
Then no new undocumented fields should be present in the response
Then no previously documented fields should be missing
Then no field types should have changed from the baseline
Then I have the baseline schema snapshot for {string}
```

#### contract.steps.ts

```gherkin
Then the response should satisfy contract {string}
Then the contract should be satisfied for {string} on {string}
Then the response schema should be valid against contract {string}
```

#### message.steps.ts

```gherkin
Given I am listening on {string}
Given I am listening on the {string} exchange
When I publish the message to {string}
When I publish the message to {string} with routing key {string}
When I publish the same message again to {string}
When I publish a message to {string}:
Then I should receive {int} message(s) within {int} seconds
Then no messages should be received within {int} seconds
Then I should not receive any additional messages within the next {int} seconds
Then there should be an error on the {string} exchange
Then there should be no errors on the {string} exchange
Then there should be {int} error(s) on the {string} exchange within {int} seconds
Then the message should match schema {string}
Then the message field {string} should equal {string}
Then the message field {string} should equal {float}
Then the message field {string} should match the API response {string}
Then the message header {string} should equal {string}
Then the message property {string} should not be empty
Then the messages should be in chronological order
Then each message should have a unique {string}
Then each message {string} should match its API response correlation
Then the message should appear in the DLQ within {int} seconds
Then the DLQ message header {string} should contain routing information
Then the DLQ message header {string} should be {string}
Then the DLQ message header {string} should be {int}
Then the message should be retried {int} times
Then after retries are exhausted the message should appear in the DLQ
```

#### database.steps.ts

```gherkin
Given account {string} exists in the database with balance {float}
Given I capture a database snapshot of account {string}
Given I capture account {string} balance
When I query the database for trial balance totals
When I query for journal entries with non-existent account codes
When I query for posted journal entries without audit trail
When I send {int} concurrent POST requests to {string} for account {string}
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

| Fixture           | How to mutate                                                |
| ----------------- | ------------------------------------------------------------ |
| `currentRequest`  | Set properties: `currentRequest.method = 'GET'`              |
| `currentResponse` | `Object.assign(currentResponse, apiResult)` — never reassign |
| `activeRole`      | `activeRole.value = 'a valid user'`                          |
| primitive values  | `store('keyOverride', Number(value))`                        |

**Never do `currentResponse = result`** — rebinds local variable only. Always use `Object.assign`.

---

## Pattern 5 — Domain Step File Structure (full example)

```typescript
import { When, Then } from '../../fixtures';
import { expect } from 'chai';
import { registerTemplates, resolveEndpoint } from '@utils/request-templates';
import { config } from '@core/config';
import { OrderResponse } from '../../models/responses/order.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. Register templates at module load ─────────────────────────
registerTemplates({
  'orders request': '/{instanceId}/orders',
  'order by id request': '/{instanceId}/orders/{orderId}',
});

type OrderFixtures = {
  apiClient: ApiClient;
  schemaValidator: SchemaValidator;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  instanceId: number;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

// ── 2. Domain-specific send step ─────────────────────────────────
Then(
  'I send the order request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: OrderFixtures) {
    const { method, endpoint } = currentRequest;
    if (!method || !endpoint) throw new Error('No request defined.');
    const effectiveId = retrieve<number>('instanceIdOverride') ?? instanceId;
    const resolvedEndpoint = `${apiBase}${endpoint.replace('{instanceId}', String(effectiveId))}`;
    Object.assign(
      currentResponse,
      await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
    );
  },
);

// ── 3. Domain-specific assertions ────────────────────────────────
Then(
  'the response should be an array of orders',
  function ({ currentResponse, schemaValidator }: Pick<OrderFixtures, 'currentResponse' | 'schemaValidator'>) {
    const body = currentResponse.body as unknown as OrderResponse[];
    expect(Array.isArray(body), 'Response body should be an array').to.be.true;
    expect(body.length, 'Expected at least 1 order').to.be.at.least(1);
    body.forEach((item, index) => {
      const result = schemaValidator.validate('order', item);
      expect(
        result.valid,
        `Schema failed at [${index}]:\n${result.errors?.map((e) => `  [${e.path}] ${e.message}`).join('\n')}`,
      ).to.be.true;
    });
  },
);
```

---

## Pattern 6 — Feature File Structure

```gherkin
@orders
Feature: Orders
  As a user of the API
  I should be able to retrieve order information

  Background:
    Given I am authenticated as "a valid user"

  @smoke
  Scenario Outline: Get orders for an instance
    When I define a GET "orders request"
    And I set "instanceId" to "<instanceId>"
    Then I send the order request to the API
    And I get the response code of OK
    And the response should be an array of orders

    Examples:
      | instanceId |
      | 1001       |
      | 1002       |

  Scenario: Invalid instanceId returns error
    When I define a GET "orders request"
    And I set "instanceId" to "99999"
    Then I send the order request to the API
    And I get the response code of BadRequest
    And the response should match schema "error"
```

### Array response — two-step validation pattern

```gherkin
And the response should be an array of orders                        ← domain step: non-empty check
And each item in the response array should match schema "order"      ← common step: schema contract
```

Do NOT combine both into one step — separate concerns = clearer failure messages.

---

## Pattern 7 — Tag Architecture

Tags follow a **dual-layer** system:

- **Domain tags** (mutually exclusive): Each feature has exactly ONE — maps to a Playwright project in `playwright.config.ts`. Examples: `@orders`, `@products`, `@accounts`, `@messaging`.
- **Cross-cutting tags** (additive): `@smoke`, `@regression`, `@negative`, `@schema`, `@security` — filtered via `--grep` at CLI. A scenario can have multiple cross-cutting tags.
- **Special tags**: `@fixme` → `test.fixme()` (skipped), `@manual` → excluded from all runs via `grepInvert`.

### When adding a new domain

1. Add `@<domain>` tag to the feature file
2. Add a project entry in `playwright.config.ts`:
   ```typescript
   { name: '<domain>', grep: /@<domain>\b/, grepInvert: /@manual/ }
   ```
3. Optionally add npm scripts:
   ```json
   "test:<domain>": "npm run bdd:gen && playwright test --project=<domain>"
   ```

---

## Pattern 8 — Fixture Reference

```typescript
type Fixtures = {
  apiClient: ApiClient; // Playwright HTTP client
  currentRequest: CurrentRequest; // { method, endpoint, body, headers, queryParams }
  currentResponse: CurrentResponse; // { status, body, headers, duration, correlationId }
  testData: Record<string, unknown>; // Generic test state store
  activeRole: { value: string }; // Auth role wrapper
  instanceId: number; // Default from .env; override via store()
  schemaValidator: SchemaValidator; // Ajv validator, loads *.schema.json on startup
  store: (key: string, value: unknown) => void;
  retrieve: <T>(key: string) => T;
  // Lazy (initialised only when needed):
  rabbitClient: RabbitClient;
  consumerHarness: ConsumerHarness;
  messagePublisher: MessagePublisher;
  dlqMonitor: DLQMonitor;
  messageValidator: MessageValidator;
  dbClient: DatabaseClient;
  snapshotManager: SnapshotManager;
  cleanupManager: CleanupManager;
  queryBuilder: QueryBuilder;
  _afterTestHook: void; // Auto: attaches req/resp on failure
};
```

---

## Pattern 9 — Adding a New Controller (checklist)

- [ ] Read `src/models/test-data/fixtures/swagger.json` for endpoint definition
- [ ] Make a live API call to verify actual response shape (swagger may be wrong)
- [ ] `src/models/responses/<entity>.response.ts` — TypeScript interface
- [ ] `src/schemas/json-schemas/<entity>.schema.json` — JSON Schema Draft-07
- [ ] `features/<domain>/<domain>.feature` — Gherkin with `@<domain>` tag
- [ ] `src/steps/<domain>/<domain>.steps.ts` — `registerTemplates()` + send + assertions
- [ ] Add project to `playwright.config.ts` projects array for new domain

---

## Adding a New Message Type (checklist)

- [ ] `src/models/test-data/factories/<message>.factory.ts` — export envelope + payload interfaces and builder function
- [ ] `src/messaging/exchanges.ts` — register the exchange label if new; **never use raw exchange strings in feature files**
- [ ] `src/steps/messaging/<message>.steps.ts` — publish step, `store('lastPublishedMessage', msg)`, DB verification step
- [ ] (Optional) `src/messaging/message-schemas/<message>.schema.json` — only if runtime validation of a consumed message structure is needed

---

## Message Factory Structure

Each factory file exports **two TypeScript interfaces** and a builder function:

```typescript
// src/models/test-data/factories/<action>.factory.ts
import { randomUUID } from 'crypto';

// ── Outer envelope ──────────────────────────────────────────────
export interface SomeActionMessage {
  messageId: string; // UUID
  conversationId: string;
  messageType: string[]; // ['urn:message:YourNamespace:SomeAction']
  message: SomeActionPayload;
  sentTime: string; // ISO timestamp
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
}

// ── Domain payload ──────────────────────────────────────────────
export interface SomeActionPayload {
  // ... domain-specific fields
}

export function buildSomeActionMessage(
  payloadOverrides: Partial<SomeActionPayload> = {},
  messageId: string = randomUUID(),
): SomeActionMessage {
  /* ... */
}
```

**Rule:** `src/models/responses/` is for HTTP response interfaces only. Message interfaces (envelope + payload) are always co-located in their factory file.

### Message schemas (consumed messages / DLQ)

Runtime schemas for **consumed** messages live in `src/messaging/message-schemas/` — loaded by `MessageValidator` (`src/messaging/message-validator.ts`), **not** the HTTP `SchemaValidator`.

There is **no runtime JSON schema for outbound messages** — TypeScript interfaces enforce the outbound contract at compile time only. Add a `src/messaging/message-schemas/<message>.schema.json` only when you need to validate consumed message structure in a step.

---

## Database Integration

The framework supports database verification via Knex.js (`src/database/db-client.ts`).

- **Auth modes:** SQL auth (default) and Azure AD passwordless (`DB_AUTH_TYPE` env var)
- **Knex mssql + Azure AD gotcha:** Set `type: 'azure-active-directory-default'` at the **connection root level** — NOT nested under `authentication`. Knex maps it internally via `_generateConnection()`.

```typescript
// CORRECT — in db-client.ts buildConnectionConfig()
return { server: cfg.host, database: cfg.name, type: 'azure-active-directory-default', options: { encrypt: true } };
// WRONG — knex strips nested authentication
return { authentication: { type: 'azure-active-directory-default' } }; // ❌
```

- **Large tables:** Always filter by date to avoid query timeouts.
- **Polling pattern:** When verifying async processing (e.g., message → DB), poll with a specific value match — not just `rows.length > 0`. Old records may exist for the same reference key.

---

## Environment Variables

All configuration is loaded via `src/core/config.ts`. Defaults exist for all values — no env var is strictly required.

| Category     | Variables                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Core**     | `BASE_URL`, `SERVICE_PATH`, `INSTANCE_ID`, `API_VERSION`, `TEST_ENV`, `API_TIMEOUT`                                     |
| **Auth**     | `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE`                                                |
| **RabbitMQ** | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_DLQ`, `RABBITMQ_VHOST`, `RABBITMQ_HEARTBEAT`, `MESSAGE_WAIT_TIMEOUT`     |
| **Database** | `DB_CLIENT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA`, `DB_AUTH_TYPE`, `DB_QUERY_TIMEOUT` |
| **AI**       | `AI_ENABLED`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`                         |

---

## TypeScript Path Aliases

| Alias          | Resolves to       |
| -------------- | ----------------- |
| `@core/*`      | `src/core/*`      |
| `@utils/*`     | `src/utils/*`     |
| `@models/*`    | `src/models/*`    |
| `@schemas/*`   | `src/schemas/*`   |
| `@messaging/*` | `src/messaging/*` |
| `@database/*`  | `src/database/*`  |
| `@steps/*`     | `src/steps/*`     |
| `@support/*`   | `src/support/*`   |
| `@fixtures/*`  | `src/fixtures/*`  |

---

## Common Mistakes

| Mistake                                                 | Correct                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `import { Given } from '@cucumber/cucumber'`            | `import { Given } from '../../fixtures'`                                         |
| `this.currentResponse = result`                         | `Object.assign(currentResponse, result)`                                         |
| `currentResponse = result` (local rebind)               | `Object.assign(currentResponse, result)`                                         |
| `body as MyType[]`                                      | `body as unknown as MyType[]`                                                    |
| Numeric codes in features (`200`, `404`)                | Labels: `OK`, `NotFound`                                                         |
| Re-defining a common step in a domain file              | Check `src/steps/common/` first                                                  |
| Using OpenAPI `nullable: true` in JSON schema           | Use `["type", "null"]` (Draft-07)                                                |
| Trusting swagger without verifying against live API     | Always run the endpoint and check actual response                                |
| Forgetting `npm run bdd:gen` after feature changes      | Run before any test run                                                          |
| One generic "send" step for all request types           | Each domain gets its own named send step                                         |
| Root-level array schema                                 | Object schema + `each item in the response array should match schema`            |
| Nesting `authentication` in knex mssql connection       | Use `type: 'azure-active-directory-default'` at root level                       |
| Querying large tables without date filter               | Always pass date cutoff                                                          |
| Putting message interfaces in `src/models/responses/`   | Co-locate in factory file: `src/models/test-data/factories/<message>.factory.ts` |
| Raw exchange string in feature/step file                | Register label in `src/messaging/exchanges.ts`                                   |
| Runtime message validation using HTTP `SchemaValidator` | Use `MessageValidator` + schemas from `src/messaging/message-schemas/`           |

---

## AI Authoring Workflow

Use the repo-owned bundle workflow for Jira/Xray-driven AI authoring:

1. `npm run ai:plan -- --source <jira-or-xray-id-or-url> [--source ...] [--out <slug>]`
2. Review `.ai/out/<slug>/source-context.json`, `.ai/out/<slug>/coverage-analysis.md`, `.ai/out/<slug>/test-plan.md`, and `.ai/out/<slug>/bundle.json`
3. Wait for explicit user approval
4. `npm run ai:approve -- --from <slug>`
5. `npm run ai:implement -- --from <slug>`

Guardrails:

- Never implement from an unapproved bundle.
- Reuse existing common steps and domain scaffolding first.
- Use named requests and status labels only.
- Keep array assertions separate from schema assertions.
- If step-definition work is ambiguous, surface a blocker instead of fabricating unsupported patterns.
