// Extension: testonaut-guide
// Testonaut framework guide — returns patterns, common steps, and scaffolding
// templates for the BDD test automation framework.

import { joinSession } from '@github/copilot-sdk/extension';

// ── Common step definitions (verbatim from src/steps/common/) ────────────────

const COMMON_STEPS = {
  'auth.steps.ts': [
    'Given I am authenticated as {string}',
    'Given I am not authenticated',
    'Given I am authenticated with an expired token',
    'Given I am authenticated with an invalid token',
  ],
  'api.steps.ts — Request Building': [
    'When I define a GET {string}',
    'When I define a POST {string}',
    'When I define a PUT {string}',
    'When I set {string} to {string}',
    'When I set {string} to the stored value {string}',
    'Given I have a request body:',
    'When I set field {string} to {string} in the payload',
    'When I remove field {string} from the payload',
    'When I corrupt field {string} with {string}',
    'When I send a GET request to {string}',
    'When I send a POST request to {string}',
    'When I send a PUT request to {string}',
    'When I send a PATCH request to {string}',
    'When I send a DELETE request to {string}',
    'When I send a valid POST request to {string} with:',
    'When I send an invalid POST request to {string} with:',
  ],
  'api.steps.ts — Response Assertions': [
    'Then I get the response code of {word}',
    'Then the response status should be {word}',
    'Then the response status should be {word} or {word}',
    'Then the response field {string} should equal {string}',
    'Then the response field {string} should equal {float}',
    'Then the response field {string} should be {string}',
    'Then the response field {string} should not be empty',
    'Then the response field {string} should be a valid UUID',
    'Then the response field {string} should be one of {string}',
    'Then the response should contain field {string}',
    'Then the response should contain required fields:',
    'Then the field {string} should be of type {string}',
    'Then I store the response field {string} as {string}',
    'Then the response body should be an array',
    'Then the response should be an empty array',
    'Then the response body should be an array with at least {int} item(s)',
    'Then the response array should contain exactly {int} items',
    'Then each item in the response array field {string} should equal {string}',
    'Then the error message should reference field {string}',
    'Then the error should indicate {string}',
    'Then I see the error message {string}',
    'Then the response time should be under {int} milliseconds',
  ],
  'schema.steps.ts': [
    'Then the response should match schema {string}',
    'Then the response should NOT match schema {string}',
    'Then each item in the response array should match schema {string}',
    'Then no new undocumented fields should be present in the response',
    'Then no previously documented fields should be missing',
    'Then no field types should have changed from the baseline',
    'Then I have the baseline schema snapshot for {string}',
  ],
  'contract.steps.ts': [
    'Then the response should satisfy contract {string}',
    'Then the contract should be satisfied for {string} on {string}',
    'Then the response schema should be valid against contract {string}',
  ],
  'message.steps.ts': [
    'Given I am listening on {string}',
    'Given I am listening on the {string} exchange',
    'When I publish the message to {string}',
    'When I publish the message to {string} with routing key {string}',
    'When I publish the same message again to {string}',
    'When I publish a message to {string}:',
    'Then I should receive {int} message(s) within {int} seconds',
    'Then no messages should be received within {int} seconds',
    'Then I should not receive any additional messages within the next {int} seconds',
    'Then there should be an error on the {string} exchange',
    'Then there should be no errors on the {string} exchange',
    'Then there should be {int} error(s) on the {string} exchange within {int} seconds',
    'Then the message should match schema {string}',
    'Then the message field {string} should equal {string}',
    'Then the message field {string} should equal {float}',
    'Then the message field {string} should match the API response {string}',
    'Then the message header {string} should equal {string}',
    'Then the message property {string} should not be empty',
    'Then the messages should be in chronological order',
    'Then each message should have a unique {string}',
    'Then each message {string} should match its API response correlation',
    'Then the message should appear in the DLQ within {int} seconds',
    'Then the DLQ message header {string} should contain routing information',
    'Then the DLQ message header {string} should be {string}',
    'Then the DLQ message header {string} should be {int}',
    'Then the message should be retried {int} times',
    'Then after retries are exhausted the message should appear in the DLQ',
  ],
  'database.steps.ts': [
    'Given account {string} exists in the database with balance {float}',
    'Given I capture a database snapshot of account {string}',
    'Given I capture account {string} balance',
    'When I query the database for trial balance totals',
    'When I query for journal entries with non-existent account codes',
    'When I query for posted journal entries without audit trail',
    'When I send {int} concurrent POST requests to {string} for account {string}',
    'Then a journal entry row should exist in the database with:',
    'Then a journal entry row should exist in the database matching the API response',
    'Then the account {string} balance should have changed by {float}',
    'Then the journal entry should have a {string} timestamp within {int} seconds of now',
    'Then an audit trail entry should exist with:',
    'Then an audit trail entry should exist for the journal posting',
    'Then the audit {string} should be null',
    'Then the audit {string} should contain the persisted journal data',
    'Then the sum of all debit amounts should equal the sum of all credit amounts',
    'Then the difference should be exactly {float}',
    'Then the result set should be empty',
    'Then the trial balance totals should still be balanced',
    'Then all {int} responses should have status {int}',
    'Then no duplicate journal entry IDs should exist in the database',
    'Then the final account {string} balance should equal the initial balance plus the sum of all posted amounts',
  ],
};

// ── Scaffold templates ───────────────────────────────────────────────────────

function scaffoldEndpoint(entity, domain) {
  const pascal = entity.charAt(0).toUpperCase() + entity.slice(1);
  const kebab = entity
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');

  return `## 1. TypeScript Interface — src/models/responses/${kebab}.response.ts

\`\`\`typescript
// ${pascal} as returned by the API
export interface ${pascal}Response {
  id: number;
  name: string;
  // TODO: Add fields matching the actual API response (verify with a live run)
}
\`\`\`

## 2. JSON Schema — src/schemas/json-schemas/${kebab}.schema.json

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "${kebab}",
  "title": "${pascal}",
  "type": "object",
  "properties": {
    "id":   { "type": "integer" },
    "name": { "type": "string" }
  },
  "additionalProperties": false
}
\`\`\`

Rules:
- \`$id\` must match the name used in \`schemaValidator.validate('${kebab}', item)\`
- Nullable fields: \`"type": ["string", "null"]\` — NOT \`"nullable": true\`
- Always set \`"additionalProperties": false\`

## 3. Domain Step File — src/steps/${domain}/${domain}.steps.ts

\`\`\`typescript
import { When, Then } from '../../fixtures';
import { expect } from 'chai';
import { registerTemplates } from '@utils/request-templates';
import { config } from '@core/config';
import { ${pascal}Response } from '../../models/responses/${kebab}.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = \`/\${config.servicePath}\`;

// Register templates at module load
registerTemplates({
  '${entity} request': '/{instanceId}/${entity}s',
});

type ${pascal}Fixtures = {
  apiClient: ApiClient;
  schemaValidator: SchemaValidator;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  instanceId: number;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

// Domain-specific send step
Then('I send the ${entity} request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ${pascal}Fixtures,
) {
  const { method, endpoint } = currentRequest;
  if (!method || !endpoint) throw new Error('No request defined.');
  const effectiveId = retrieve<number>('instanceIdOverride') ?? instanceId;
  const resolvedEndpoint = \`\${apiBase}\${endpoint.replace('{instanceId}', String(effectiveId))}\`;
  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

// Domain-specific array assertion
Then('the response should be an array of ${entity}s', function (
  { currentResponse, schemaValidator }: Pick<${pascal}Fixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as ${pascal}Response[];
  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 ${entity}').to.be.at.least(1);
  body.forEach((item, index) => {
    const result = schemaValidator.validate('${kebab}', item);
    expect(result.valid, \`Schema failed at [\${index}]:\\n\${result.errors?.map(e => \`  [\${e.path}] \${e.message}\`).join('\\n')}\`).to.be.true;
  });
});
\`\`\`

## 4. Feature File — features/${domain}/${domain}.feature

\`\`\`gherkin
@${domain}
Feature: ${pascal}s
  As a user of the API
  I should be able to retrieve ${entity} information

  Background:
    Given I am authenticated as "a valid user"

  @smoke
  Scenario: Get a list of ${entity}s
    When I define a GET "${entity} request"
    And I set "instanceId" to "1001"
    Then I send the ${entity} request to the API
    And I get the response code of OK
    And the response should be an array of ${entity}s
    And each item in the response array should match schema "${kebab}"
\`\`\`

## 5. Add project to playwright.config.ts

\`\`\`typescript
{
  name: '${domain}',
  grep: /@${domain}\\b/,
  grepInvert: /@manual/,
},
\`\`\`

## After creating files:
- Run \`npm run bdd:gen\` to generate specs from the feature file
- Run \`npm run type-check\` to verify TypeScript compiles
- Verify response shape against a live API run (swagger may be wrong)`;
}

function scaffoldMessageType(messageName) {
  const pascal = messageName.charAt(0).toUpperCase() + messageName.slice(1);
  const kebab = messageName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');

  return `## 1. Factory — src/models/test-data/factories/${kebab}.factory.ts

\`\`\`typescript
import { randomUUID } from 'crypto';

// Outer envelope (e.g., MassTransit format)
export interface ${pascal}Message {
  messageId: string;
  conversationId: string;
  messageType: string[];
  message: ${pascal}Payload;
  sentTime: string;
  headers: Record<string, unknown>;
  host: Record<string, unknown>;
}

// Domain payload
export interface ${pascal}Payload {
  // TODO: Define payload fields
  InstanceId: number;
  Reference: string;
  Amount: number;
}

export function build${pascal}Message(
  payloadOverrides: Partial<${pascal}Payload> = {},
  messageId: string = randomUUID(),
): ${pascal}Message {
  const payload: ${pascal}Payload = {
    InstanceId: 1001,
    Reference: \`REF-\${randomUUID().slice(0, 8)}\`,
    Amount: Math.round(Math.random() * 10000) / 100,
    ...payloadOverrides,
  };
  return {
    messageId,
    conversationId: randomUUID(),
    messageType: ['urn:message:YourNamespace:${pascal}'],
    message: payload,
    sentTime: new Date().toISOString(),
    headers: {},
    host: { machineName: 'test-framework', processName: 'testonaut' },
  };
}
\`\`\`

Rule: Message interfaces live in the factory file — NOT in src/models/responses/.

## 2. Register exchange — src/messaging/exchanges.ts

Add a new entry to the EXCHANGES registry:
\`\`\`typescript
'your exchange label': {
  exchange: 'your.actual-exchange-name',
  routingKey: '',
},
\`\`\`
Never use raw exchange strings in feature files — always use the label.

## 3. Steps — src/steps/messaging/${kebab}.steps.ts

\`\`\`typescript
import { When, Then } from '../../fixtures';
import { build${pascal}Message } from '../../models/test-data/factories/${kebab}.factory';

// Build and store message
When('I build a ${messageName} message', function ({ store }) {
  const message = build${pascal}Message();
  store('lastPublishedMessage', message);
  store('currentMessage', message);
});

// DB verification (if applicable)
Then('the transactions from the ${messageName} message should exist in the database', async function (
  { retrieve, dbClient },
) {
  const message = retrieve('lastPublishedMessage');
  // Poll database with retry, matching on specific values
  // Always filter by date to avoid timeouts on large tables
});
\`\`\`

## 4. (Optional) Message schema — src/messaging/message-schemas/${kebab}.schema.json

Only needed if you need to validate consumed message structure at runtime.`;
}

const CRITICAL_RULES = `# Testonaut — Critical Rules

1. Step files import \`{ Given, When, Then }\` from \`../../fixtures\` — NEVER from \`@cucumber/cucumber\` or \`playwright-bdd\`
2. Mutate \`currentResponse\` via \`Object.assign(currentResponse, result)\` — NEVER reassign the variable
3. Cast response body via \`body as unknown as MyType[]\` — never a direct cast
4. HTTP status codes in feature files use labels only: \`OK\`, \`BadRequest\`, \`NotFound\` — never raw numbers
5. Run \`npm run bdd:gen\` after every change to a \`.feature\` file
6. JSON schema nullable fields use \`["type", "null"]\` — not OpenAPI's \`nullable: true\`
7. Domain step files register endpoints via \`registerTemplates()\` from \`@utils/request-templates\`
8. Common steps in \`src/steps/common/\` must not be re-defined in domain files — check before adding
9. Schemas are always object-type at root (never array) — validate arrays with \`each item in the response array should match schema\`
10. Verify response shape against a live API run — swagger may reference the wrong component schema

## Available HTTP Status Labels
OK, Created, Accepted, NoContent, BadRequest, Unauthorized, Forbidden, NotFound, MethodNotAllowed, Conflict, UnprocessableEntity, TooManyRequests, InternalServerError, BadGateway, ServiceUnavailable

## Fixture Mutation Rules
| Fixture | How to mutate |
|---|---|
| currentRequest | Set properties: \`currentRequest.method = 'GET'\` |
| currentResponse | \`Object.assign(currentResponse, result)\` — never reassign |
| activeRole | \`activeRole.value = 'a valid user'\` |
| primitive values | \`store('keyOverride', Number(value))\` |`;

// ── Extension registration ───────────────────────────────────────────────────

const session = await joinSession({
  tools: [
    {
      name: 'testonaut_common_steps',
      description:
        'Returns ALL common step definitions from src/steps/common/. Use before writing any step definition to avoid re-defining existing steps. Optionally filter by file name.',
      parameters: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description:
              'Filter by step file name, e.g. "auth", "api", "schema", "contract", "message", "database". Omit to return all.',
          },
        },
      },
      skipPermission: true,
      handler: async (args) => {
        const filter = args.file?.toLowerCase();
        let result = '';
        for (const [file, steps] of Object.entries(COMMON_STEPS)) {
          if (filter && !file.toLowerCase().includes(filter)) continue;
          result += `### ${file}\n`;
          for (const step of steps) {
            result += `  ${step}\n`;
          }
          result += '\n';
        }
        return result.trim() || `No common steps found matching "${filter}".`;
      },
    },
    {
      name: 'testonaut_scaffold_endpoint',
      description:
        'Generates scaffolding templates for a new API endpoint: TypeScript interface, JSON Schema, domain step file, feature file, and playwright.config.ts project entry. Returns the templates as text — you then create the files.',
      parameters: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            description: 'The entity name in camelCase, e.g. "order", "clientDepartment", "product"',
          },
          domain: {
            type: 'string',
            description: 'The domain/folder name in kebab-case, e.g. "orders", "clients", "products"',
          },
        },
        required: ['entity', 'domain'],
      },
      handler: async (args) => scaffoldEndpoint(args.entity, args.domain),
    },
    {
      name: 'testonaut_scaffold_message',
      description:
        'Generates scaffolding templates for a new RabbitMQ message type: factory with envelope + payload interfaces, exchange registration, step file, and optional message schema.',
      parameters: {
        type: 'object',
        properties: {
          messageName: {
            type: 'string',
            description: 'The message name in camelCase, e.g. "bookClientDeposit", "processPayment"',
          },
        },
        required: ['messageName'],
      },
      handler: async (args) => scaffoldMessageType(args.messageName),
    },
    {
      name: 'testonaut_rules',
      description:
        'Returns the critical rules, HTTP status labels, and fixture mutation rules for the Testonaut framework. Call this before implementing any feature to ensure compliance.',
      parameters: { type: 'object', properties: {} },
      skipPermission: true,
      handler: async () => CRITICAL_RULES,
    },
  ],
});
