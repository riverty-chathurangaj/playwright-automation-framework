import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates, resolveEndpoint } from '../../utils/request-templates';
import { GLAccountResponse } from '../../models/responses/gl-account.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';
// Note: 'I define a GET {string}', 'I set {string} to {string}', and
//       'I get the response code of {word}' are defined in common/api.steps.ts

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────
registerTemplates({
  'accounts request': '/{instanceId}/accounts',
  'accounts by posting request': '/{instanceId}/accounts/{postingId}',
});

type AccountFixtures = {
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

When('I set account request parameters:', function (
  { currentRequest, store }: Pick<AccountFixtures, 'currentRequest' | 'store'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === 'instanceId' || key === 'postingId') {
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
});

// ── 3. Send steps (one per request type) ─────────────────────────────────────

Then('I send the accounts request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: AccountFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

Then('I send the accounts by posting request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: AccountFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

// ── 4. Response assertions ───────────────────────────────────────────────────

Then('the response should be an array of accounts', function (
  { currentResponse, schemaValidator }: Pick<AccountFixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as GLAccountResponse[];

  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 account in the response but got 0').to.be.at.least(1);

  body.forEach((account, index) => {
    const result = schemaValidator.validate('gl-account', account);
    expect(
      result.valid,
      `Schema validation failed for account at index [${index}]:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
    ).to.be.true;
  });
});

Then('I store the accounts count as {string}', function (
  { currentResponse, store }: Pick<AccountFixtures, 'currentResponse' | 'store'>,
  key: string,
) {
  const body = currentResponse.body as unknown as GLAccountResponse[];
  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  store(key, body.length);
});

