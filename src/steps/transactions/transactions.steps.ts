import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '@core/config';
import { registerTemplates, resolveEndpoint } from '@utils/request-templates';
import { GLTransactionResponse } from '@models/responses/gl-transaction.response';
import type { ApiClient } from '@core/api-client';
import type { SchemaValidator } from '@schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────

registerTemplates({
  'transactions request': '/{instanceId}/transactions',
  'transactions by id request': '/{instanceId}/transactions/{id}',
});

type TransactionFixtures = {
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

When('I set transaction request parameters:', function (
  { currentRequest, store }: Pick<TransactionFixtures, 'currentRequest' | 'store'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === 'instanceId') {
      store('instanceIdOverride', Number(value));
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

// ── 3. Send steps ────────────────────────────────────────────────────────────

Then('I send the transactions request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: TransactionFixtures,
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

Then('I send the transactions by id request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: TransactionFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, {}, activeRole.value),
  );
});

// ── 4. Response assertions ───────────────────────────────────────────────────

Then('the response should be an array of transactions', function (
  { currentResponse, schemaValidator }: Pick<TransactionFixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as GLTransactionResponse[];

  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 transaction in the response but got 0').to.be.at.least(1);

  body.forEach((transaction, index) => {
    const result = schemaValidator.validate('gl-transaction', transaction);
    expect(
      result.valid,
      `Schema validation failed for transaction at index [${index}]:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
    ).to.be.true;
  });
});
