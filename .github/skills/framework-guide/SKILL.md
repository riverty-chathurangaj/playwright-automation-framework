---
name: framework-guide
description: pw-testforge-gls — BDD API Test Automation Framework Guide & Implementation Patterns. Use when implementing features, step definitions, schemas, or models in this BDD test automation project.
user-invocable: true
disable-model-invocation: false
---

# pw-testforge-gls — Framework Guide

You are helping a developer work on the **pw-testforge-gls** BDD test automation framework.
When asked to implement new features, step definitions, schemas, or models, follow every pattern in `patterns.md` exactly.

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
├── utils/
│   ├── request-templates.ts       # Central template registry: registerTemplates(), getTemplate(), resolveEndpoint()
│   ├── http-status.ts             # Status label → code map
│   ├── data-generator.ts          # Randomized test data helpers
│   ├── comparator.ts              # Response comparison utilities
│   └── payload-mutator.ts         # Request body mutation helpers
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
├── database/                      # db-client, snapshot-manager, cleanup-manager, query-builder
└── support/                       # global-setup, global-teardown, ai-enricher
features/
└── <domain>/
    └── <domain>.feature
```

---

## Critical Rules (must follow — always)

1. **Import `Given/When/Then` only from `../../fixtures`** — never from `@cucumber/cucumber` or `playwright-bdd`
2. **Never reassign `currentResponse`** — always `Object.assign(currentResponse, result)`
3. **HTTP status codes in feature files use labels, never numbers** — `OK`, `BadRequest`, `NotFound`, etc.
4. **Run `npm run bdd:gen` after every `.feature` file change**
5. **Schemas are object-type** (not array) — validate arrays with `each item in the response array should match schema`
6. **Verify response shape against a live API run** — swagger may reference the wrong component schema

---

## Available Common Steps (do NOT re-define in domain files)

### auth.steps.ts

```gherkin
Given I am authenticated as {string}
Given I am not authenticated
Given I am authenticated with an expired token
Given I am authenticated with an invalid token
```

### api.steps.ts — Request Building

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

### api.steps.ts — Response Assertions

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

### schema.steps.ts

```gherkin
Then the response should match schema {string}
Then the response should NOT match schema {string}
Then each item in the response array should match schema {string}
Then no new undocumented fields should be present in the response
Then no previously documented fields should be missing
Then no field types should have changed from the baseline
Then I have the baseline schema snapshot for {string}
```

### contract.steps.ts

```gherkin
Then the response should satisfy contract {string}
Then the contract should be satisfied for {string} on {string}
Then the response schema should be valid against contract {string}
```

### message.steps.ts

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

### database.steps.ts

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

## New Controller Checklist

- [ ] Read `src/models/test-data/fixtures/swagger.json` for endpoint definition
- [ ] Make a live API call to verify actual response shape (swagger may be wrong)
- [ ] `src/models/responses/<entity>.response.ts` — TypeScript interface
- [ ] `src/schemas/json-schemas/<entity>.schema.json` — JSON Schema Draft-07
- [ ] `features/<domain>/<domain>.feature` — Gherkin with `@<domain>` tag
- [ ] `src/steps/<domain>/<domain>.steps.ts` — `registerTemplates()` + send step + assertions
- [ ] Add project to `playwright.config.ts` projects array for new domain

---

## Tag → Run Profile Architecture

Each feature file is tagged for selective execution. Tags fall into two categories:

**Domain tags** — one per API controller / functional area:

| Tag         | npm script              | Purpose                   |
| ----------- | ----------------------- | ------------------------- |
| `@<domain>` | `npm run test:<domain>` | Domain-specific endpoints |

Each domain tag maps to a Playwright project in `playwright.config.ts` and an npm script in `package.json`.

**Cross-cutting tags** — applied alongside domain tags for filtering:

| Tag           | npm script                | Purpose                    |
| ------------- | ------------------------- | -------------------------- |
| `@smoke`      | `npm run test:smoke`      | Fast sanity checks         |
| `@regression` | `npm run test:regression` | Full coverage              |
| `@negative`   | `npm run test:negative`   | Error paths                |
| `@schema`     | `npm run test:schema`     | Contract/schema validation |
| `@security`   | `npm run test:security`   | Auth & permissions         |
| `@messaging`  | `npm run test:messaging`  | Async queue ops            |
| `@manual`     | (excluded)                | Manual testing only        |

Run a single feature by tag: `npm run test:feature -- "@orders"`

---

## Common Mistakes

| Mistake                                                 | Correct                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `import { Given } from '@cucumber/cucumber'`            | `import { Given } from '../../fixtures'`                                         |
| `this.currentResponse = result`                         | `Object.assign(currentResponse, result)`                                         |
| `currentResponse = result` (local rebind)               | `Object.assign(currentResponse, result)`                                         |
| `body as MyResponse[]` (direct cast)                    | `body as unknown as MyResponse[]`                                                |
| Numeric codes in features (`200`, `404`)                | Labels: `OK`, `NotFound`                                                         |
| Re-defining a common step in a domain file              | Check `src/steps/common/` first                                                  |
| Using OpenAPI `nullable: true` in JSON schema           | Use `["type", "null"]` (Draft-07)                                                |
| Trusting swagger without verifying against live API     | Always run the endpoint and check actual response                                |
| Forgetting `npm run bdd:gen` after feature changes      | Run before any test run                                                          |
| One generic "send" step for all request types           | Each request type gets its own named send step                                   |
| Root-level array schema in `schemaValidator.validate()` | Object schema + `each item in the response array should match schema`            |
| Inline `REQUEST_TEMPLATES` const in domain step file    | Use `registerTemplates()` from `@utils/request-templates`                        |
| Nesting `authentication` in Knex mssql connection       | Use `type: 'azure-active-directory-default'` at root level                       |
| Polling DB returning on `rows.length > 0`               | Poll until specific field match — old records may exist for same key             |
| Putting message interfaces in `src/models/responses/`   | Co-locate in factory file: `src/models/test-data/factories/<message>.factory.ts` |
| Raw exchange string in feature/step file                | Register label in `src/messaging/exchanges.ts`, use `resolveExchange(label)`     |
| Runtime message validation using HTTP `SchemaValidator` | Use `MessageValidator` + schemas from `src/messaging/message-schemas/`           |

---

For full implementation patterns with code examples, see `patterns.md` in this directory.
