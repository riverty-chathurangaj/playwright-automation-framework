import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates, resolveEndpoint } from '../../utils/request-templates';
import { InstanceResponse } from '../../models/responses/instance.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';
// Note: 'I define a GET {string}', 'I set {string} to {string}', and
//       'I get the response code of {word}' are defined in common/api.steps.ts

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────
registerTemplates({
  'instances request': '/instances',
  'instance by id request': '/instances/{id}',
  'instance by source system request': '/instances/source-system/{sourceSystemId}/id',
  'activate instance request': '/instances/{id}/activate',
  'deactivate instance request': '/instances/{id}/deactivate',
});

type InstanceFixtures = {
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

When('I set instance request parameters:', function (
  { currentRequest, store }: Pick<InstanceFixtures, 'currentRequest' | 'store'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === 'id' || key === 'instanceId' || key === 'sourceSystemId') {
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

Then('I send the instances request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole }: InstanceFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${endpoint}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

Then('I send the instance by id request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: InstanceFixtures,
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

Then('I send the instance by source system request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a GET..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve)}`;

  Object.assign(
    currentResponse,
    await apiClient.get(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

Then('I send the activate instance request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a PUT..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve)}`;

  Object.assign(
    currentResponse,
    await apiClient.put(resolvedEndpoint, {}, activeRole.value),
  );
});

Then('I send the deactivate instance request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a PUT..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve)}`;

  Object.assign(
    currentResponse,
    await apiClient.put(resolvedEndpoint, {}, activeRole.value),
  );
});

// ── 4. Response assertions ───────────────────────────────────────────────────

Then('the response should be an array of instances', function (
  { currentResponse, schemaValidator }: Pick<InstanceFixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as InstanceResponse[];

  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  expect(body.length, 'Expected at least 1 instance in the response but got 0').to.be.at.least(1);

  body.forEach((instance, index) => {
    const result = schemaValidator.validate('instance', instance);
    expect(
      result.valid,
      `Schema validation failed for instance at index [${index}]:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
    ).to.be.true;
  });
});

Then('the response should be a valid instance', function (
  { currentResponse, schemaValidator }: Pick<InstanceFixtures, 'currentResponse' | 'schemaValidator'>,
) {
  const body = currentResponse.body as unknown as InstanceResponse;

  expect(body, 'Response body should not be null or undefined').to.not.be.null;
  expect(typeof body, 'Response body should be an object').to.equal('object');
  expect(Array.isArray(body), 'Response body should not be an array').to.be.false;

  const result = schemaValidator.validate('instance', body);
  expect(
    result.valid,
    `Schema validation failed for instance:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
  ).to.be.true;
});

Then('the response instance id should equal {string}', function (
  { currentResponse }: Pick<InstanceFixtures, 'currentResponse'>,
  expectedId: string,
) {
  const body = currentResponse.body as unknown as InstanceResponse;
  expect(body.id, `Expected instance id to be ${expectedId} but got ${body.id}`).to.equal(Number(expectedId));
});

Then('I store the instances count as {string}', function (
  { currentResponse, store }: Pick<InstanceFixtures, 'currentResponse' | 'store'>,
  key: string,
) {
  const body = currentResponse.body as unknown as InstanceResponse[];
  expect(Array.isArray(body), 'Response body should be an array').to.be.true;
  store(key, body.length);
});

Then('the instance should have isActive equal to {string}', function (
  { currentResponse }: Pick<InstanceFixtures, 'currentResponse'>,
  expected: string,
) {
  const body = currentResponse.body as unknown as InstanceResponse;
  const expectedBool = expected === 'true';
  expect(body.isActive, `Expected instance isActive to be ${expectedBool} but got ${body.isActive}`).to.equal(expectedBool);
});

