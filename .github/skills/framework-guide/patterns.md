# pw-testforge-gls — Implementation Patterns

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
// Department as returned by GET /api-service/{instanceId}/departments
export interface DepartmentResponse {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
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
    "description": { "type": ["string", "null"] },
    "isActive": { "type": "boolean" }
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

### Domain steps register endpoints via the central template registry

```typescript
// CORRECT — domain step file registers its templates at module load time
import { registerTemplates } from '../../utils/request-templates';

registerTemplates({
  'orders request':    '/{instanceId}/orders',
  'order by id request': '/{instanceId}/orders/{orderId}',
});

// WRONG — inline const, not discoverable by common steps
const REQUEST_TEMPLATES = { ... };  // ❌
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

| Fixture                  | How to mutate                                                |
| ------------------------ | ------------------------------------------------------------ |
| `currentRequest`         | Set properties: `currentRequest.method = 'GET'`              |
| `currentResponse`        | `Object.assign(currentResponse, apiResult)` — never reassign |
| `activeRole`             | `activeRole.value = 'a valid user'`                          |
| `instanceId` (primitive) | `store('instanceIdOverride', Number(value))`                 |

**Never do `currentResponse = result`** — rebinds local variable only. Always use `Object.assign`.

---

## Pattern 5 — Domain Step File Structure (full example)

```typescript
import { When, Then } from '../../fixtures';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates, resolveEndpoint } from '../../utils/request-templates';
import { OrderResponse } from '../../models/responses/order.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. Register templates (at module load time) ─────────────────────────────
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

// ── 2. Request parameter steps ──────────────────────────────────────────────

When(
  'I set order request parameters:',
  function ({ currentRequest, store }: Pick<OrderFixtures, 'currentRequest' | 'store'>, dataTable: DataTable) {
    const row = dataTable.hashes()[0];
    const queryParams: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(row)) {
      if (key === 'instanceId' || key === 'orderId') {
        store(`${key}Override`, Number(value));
      } else if (value === 'true' || value === 'false') {
        queryParams[key] = value === 'true';
      } else if (!isNaN(Number(value)) && value !== '') {
        queryParams[key] = Number(value);
      } else {
        queryParams[key] = value;
      }
    }

    if (Object.keys(queryParams).length > 0) {
      currentRequest.queryParams = { ...currentRequest.queryParams, ...queryParams };
    }
  },
);

// ── 3. Send steps (one per request type) ────────────────────────────────────

Then(
  'I send the orders request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: OrderFixtures) {
    const { method, endpoint } = currentRequest;
    if (!method || !endpoint) throw new Error('No request defined.');
    const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;
    Object.assign(
      currentResponse,
      await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
    );
  },
);

Then(
  'I send the order by id request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: OrderFixtures) {
    const { method, endpoint } = currentRequest;
    if (!method || !endpoint) throw new Error('No request defined.');
    const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;
    Object.assign(
      currentResponse,
      await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
    );
  },
);

// ── 4. Response assertions ───────────────────────────────────────────────────

Then(
  'the response should be an array of orders',
  function ({ currentResponse, schemaValidator }: Pick<OrderFixtures, 'currentResponse' | 'schemaValidator'>) {
    const body = currentResponse.body as unknown as OrderResponse[];
    expect(Array.isArray(body), 'Response body should be an array').to.be.true;
    expect(body.length, 'Expected at least 1 order').to.be.at.least(1);
    body.forEach((order, index) => {
      const result = schemaValidator.validate('order', order);
      expect(
        result.valid,
        `Schema failed at [${index}]:\n${result.errors?.map((e) => `  [${e.path}] ${e.message}`).join('\n')}`,
      ).to.be.true;
    });
  },
);

Then(
  'I store the orders count as {string}',
  function ({ currentResponse, store }: Pick<OrderFixtures, 'currentResponse' | 'store'>, key: string) {
    const body = currentResponse.body as unknown as OrderResponse[];
    expect(Array.isArray(body), 'Response body should be an array').to.be.true;
    store(key, body.length);
  },
);
```

### Key patterns in this example

1. **`registerTemplates()`** at top level — called once at module load, not inside a step
2. **`resolveEndpoint()`** replaces `{placeholder}` tokens — checks store for `<key>Override` first, then `defaults`
3. **One send step per request type** — `I send the orders request` vs `I send the order by id request`
4. **`Object.assign(currentResponse, ...)`** — never reassign
5. **`body as unknown as OrderResponse[]`** — double cast for type safety
6. **`apiBase` from config** — never hardcode the service path

---

## Pattern 6 — Feature File Structure

```gherkin
@orders
Feature: Orders
  As a user of the API
  I should be able to retrieve order information for a given instance

  Background:
    Given I am authenticated as "a valid user"

  @smoke
  Scenario Outline: I should be able to get a list of orders for a given instance
    When I define a GET "orders request"
    And I set "instanceId" to "<instanceId>"
    Then I send the orders request to the API
    And I get the response code of OK
    And the response should be an array of orders

    Examples:
      | instanceId |
      | 1001       |
      | 1002       |

  @negative
  Scenario: Verify behavior with invalid instanceId
    When I define a GET "orders request"
    And I set "instanceId" to "99999"
    Then I send the orders request to the API
    And I get the response code of BadRequest
    And the response should match schema "error"

  @schema
  Scenario: I should be able to get a list of departments for a given instance
    When I define a GET "departments request"
    And I set "instanceId" to "1001"
    Then I send the departments request to the API
    And I get the response code of OK
    And the response should be an array of departments
    And each item in the response array should match schema "department"
```

### Array response — two-step validation pattern

```gherkin
And the response should be an array of orders                        ← domain step: non-empty check
And each item in the response array should match schema "order"      ← common step: schema contract
```

Do NOT combine both into one step — separate concerns = clearer failure messages.

---

## Pattern 7 — Authentication

```gherkin
# Correct — happy path
Given I am authenticated as "a valid user"

# Correct — negative scenarios
Given I am not authenticated
Given I am authenticated with an expired token
Given I am authenticated with an invalid token

# Wrong — never expose internal role names
Given I am authenticated as "m2m-service-account"  # ❌
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
  // Lazy: rabbitClient, consumerHarness, messagePublisher, dlqMonitor, messageValidator
  // Lazy: dbClient, snapshotManager, cleanupManager, queryBuilder
  _afterTestHook: void; // Auto: attaches req/resp on failure, optional AI analysis
};
```

### CurrentRequest interface

```typescript
export interface CurrentRequest {
  method?: string;
  endpoint?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
}
```

### CurrentResponse interface

```typescript
export interface CurrentResponse {
  status?: number;
  body?: Record<string, unknown> | unknown;
  headers?: Record<string, string>;
  duration?: number;
  correlationId?: string;
}
```

---

## Pattern 9 — Message Factory Structure

RabbitMQ message templates live in `src/models/test-data/factories/`. Each factory exports **two TypeScript interfaces** and a builder function.

**Rule:** `src/models/responses/` is for HTTP response interfaces only. Message interfaces (envelope + payload) are always co-located in their factory file.

```typescript
// src/models/test-data/factories/create-order.factory.ts
import { randomUUID } from 'crypto';
import { DataGenerator } from '../../../utils/data-generator';

// ── 1. MassTransit outer envelope ────────────────────────────────────────────
export interface CreateOrderMessage {
  messageId: string; // UUID
  conversationId: string;
  messageType: string[]; // ['urn:message:MyService:CreateOrder']
  message: CreateOrderPayload; // ← domain payload
  sentTime: string; // ISO timestamp — used as date cutoff in DB polling
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
  // null fields: requestId, correlationId, initiatorId, responseAddress, faultAddress, expirationTime
}

// ── 2. Domain payload ────────────────────────────────────────────────────────
export interface CreateOrderPayload {
  InstanceId: number;
  OrderId: number;
  Source: string;
  Amount: number; // randomized via DataGenerator.amount() — NEVER a string
  CreatedByUser: string;
  Reference: string;
}

// ── 3. Builder function ──────────────────────────────────────────────────────
export function buildCreateOrderMessage(
  payloadOverrides: Partial<CreateOrderPayload> = {},
  messageId: string = randomUUID(),
): CreateOrderMessage {
  const payload: CreateOrderPayload = {
    InstanceId: 1001,
    OrderId: DataGenerator.integer(1, 9999),
    Source: 'TestAutomation',
    Amount: DataGenerator.amount(),
    CreatedByUser: 'test-user',
    Reference: randomUUID(),
    ...payloadOverrides,
  };

  return {
    messageId,
    conversationId: randomUUID(),
    messageType: ['urn:message:MyService:CreateOrder'],
    message: payload,
    sentTime: new Date().toISOString(),
    headers: {},
    host: {
      machineName: 'test-host',
      processName: 'test',
      processId: 0,
      assembly: '',
      assemblyVersion: '',
      frameworkVersion: '',
      massTransitVersion: '',
      operatingSystemVersion: '',
    },
  };
}
```

### Message schemas (consumed messages / DLQ)

Runtime schemas for **consumed** messages live in `src/messaging/message-schemas/` — loaded by `MessageValidator` (`src/messaging/message-validator.ts`), **not** the HTTP `SchemaValidator`.

There is **no runtime JSON schema for outbound messages** — TypeScript interfaces enforce the outbound contract at compile time only. Add a `src/messaging/message-schemas/<message>.schema.json` only when you need to validate consumed message structure in a step.

### Adding a new message type — checklist

- [ ] `src/models/test-data/factories/<message>.factory.ts` — export `*Message` (envelope) + `*Payload` interfaces and builder function
- [ ] `src/messaging/exchanges.ts` — register the exchange label if new; **never use raw exchange strings in feature files**
- [ ] `src/steps/messaging/<message>.steps.ts` — publish step, `store('lastPublishedMessage', msg)`, DB verification step
- [ ] (Optional) `src/messaging/message-schemas/<message>.schema.json` — only if runtime validation of a consumed message structure is needed

---

## Pattern 10 — Database Integration

### Knex + Azure AD Passwordless

The framework connects to Azure SQL via Microsoft Entra ID passwordless authentication (`@azure/identity` → `DefaultAzureCredential`). No username/password — developer must be logged in via `az login`.

**Knex + Azure AD gotcha:** Set `type: 'azure-active-directory-default'` at the **connection root level** — NOT nested under `authentication`. Knex maps it internally via `_generateConnection()`.

```typescript
// CORRECT — in db-client.ts buildConnectionConfig()
return {
  server: cfg.host,
  database: cfg.name,
  type: 'azure-active-directory-default',
  options: { encrypt: true },
};

// WRONG — knex strips nested authentication
return { authentication: { type: 'azure-active-directory-default' } }; // ❌
```

### Messaging → DB Verification Pattern

After publishing a RabbitMQ message and confirming consumption, verify the resulting database records:

```gherkin
Then I should receive 1 message within 30 seconds
And the records from the create order message should exist in the database
```

The verification step:

1. Reads `lastPublishedMessage` from the store (set by common message steps)
2. Extracts key identifiers and timestamps from the message payload
3. Polls the target table using a date cutoff (from `sentTime`) to filter out pre-existing records
4. Asserts the expected rows exist with matching field values

### Polling best practices

- **Always use a date filter** on large tables to avoid query timeouts
- **Poll for specific field matches** — not just `rows.length > 0` — old records may exist for the same key
- **Use `sentTime`** from the message envelope as the `CreatedDate` cutoff to exclude pre-existing data
- **Be aware of precision differences** — the message may have higher precision than the stored column (e.g., an unrounded source amount vs. a rounded stored amount)

```typescript
// Generic polling pattern
async function pollForRecords(
  dbClient: DatabaseClient,
  filters: Record<string, unknown>,
  dateCutoff: string,
  options: { maxWaitMs: number; intervalMs: number } = { maxWaitMs: 30000, intervalMs: 2000 },
): Promise<unknown[]> {
  const start = Date.now();
  while (Date.now() - start < options.maxWaitMs) {
    const rows = await dbClient.query(filters, dateCutoff);
    // Check for specific field match — not just rows.length > 0
    const matched = rows.filter((row) => matchesCriteria(row, filters));
    if (matched.length > 0) return matched;
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }
  throw new Error(`Timed out waiting for records matching ${JSON.stringify(filters)}`);
}
```

---

## Pattern 11 — Request Template Registry

The central template registry (`src/utils/request-templates.ts`) provides three functions:

| Function                                        | Purpose                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `registerTemplates(map)`                        | Domain step files call this at module load time to register their endpoint templates      |
| `getTemplate(name)`                             | Common steps resolve a template by its friendly name (throws if unknown)                  |
| `resolveEndpoint(template, retrieve, defaults)` | Replaces `{placeholder}` tokens — checks store for `<key>Override` first, then `defaults` |

```typescript
// In a domain step file (top level, not inside a step):
registerTemplates({
  'products request': '/{instanceId}/products',
  'product by id request': '/{instanceId}/products/{productId}',
});

// In the send step:
const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;
```

This architecture means:

- Common `When I define a GET {string}` step can resolve **any** domain template by name
- Domain files only need to register templates and define their own send steps
- Template placeholders like `{instanceId}` are resolved via the store (set by `When I set "instanceId" to "1001"`)
