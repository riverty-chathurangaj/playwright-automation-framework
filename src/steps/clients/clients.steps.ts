import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates } from '../../utils/request-templates';
import { ClientResponse } from '../../models/responses/client.response';
import { ClientDepartmentResponse } from '../../models/responses/client-department.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';
// Note: 'I define a GET {string}', 'I set {string} to {string}', and
//       'I get the response code of {word}' are defined in common/api.steps.ts

const apiBase = `/${config.servicePath}`;

// Register client-domain request templates into the shared registry
registerTemplates({
  'clients request': '/{instanceId}/clients',
  'client departments request': '/{instanceId}/clients/departments',
});

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

// ─── Request building ─────────────────────────────────────────────────────────


When('I set client request parameters:', function (
  { currentRequest, store }: Pick<ClientFixtures, 'currentRequest' | 'store'>,
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

Then('I send the client request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET/POST..." step first.');
  }

  const effectiveId = retrieve<number>('instanceIdOverride') ?? instanceId;
  const resolvedEndpoint = `${apiBase}${endpoint.replace('{instanceId}', String(effectiveId))}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

// ─── Response assertions ──────────────────────────────────────────────────────

Then('the response should be an array of clients', function (
  { currentResponse, schemaValidator }: Pick<ClientFixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as ClientResponse[];

  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 client in the response but got 0').to.be.at.least(1);

  body.forEach((client, index) => {
    const result = schemaValidator.validate('client', client);
    expect(
      result.valid,
      `Schema validation failed for client at index [${index}]:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
    ).to.be.true;
  });
});

Then('I store the clients count as {string}', function (
  { currentResponse, store }: Pick<ClientFixtures, 'currentResponse' | 'store'>,
  key: string,
) {
  const body = currentResponse.body as unknown as ClientResponse[];
  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  store(key, body.length);
});

Then('the stored count {string} should be less than {string}', function (
  { retrieve }: Pick<ClientFixtures, 'retrieve'>,
  keyA: string,
  keyB: string,
) {
  const a = retrieve<number>(keyA);
  const b = retrieve<number>(keyB);
  expect(
    a,
    `Expected ${keyA} (${a}) to be less than ${keyB} (${b})`,
  ).to.be.lessThan(b);
});

Then('I send the client departments request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET/POST..." step first.');
  }

  const effectiveId = retrieve<number>('instanceIdOverride') ?? instanceId;
  const resolvedEndpoint = `${apiBase}${endpoint.replace('{instanceId}', String(effectiveId))}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

Then('the response should be an array of client departments', function (
  { currentResponse }: Pick<ClientFixtures, 'currentResponse'>,
) {
  const body = currentResponse.body as unknown as ClientDepartmentResponse[];

  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 client department in the response but got 0').to.be.at.least(1);
});
