import { Given, When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { PayloadMutator, CorruptionType } from '@utils/payload-mutator';
import { Comparator } from '@utils/comparator';
import { config } from '@core/config';
import { resolveStatus } from '@utils/http-status';
import { getTemplate } from '@utils/request-templates';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

function resolvePath(path: string, instanceId: number): string {
  const resolved = path.replace('{instanceId}', String(instanceId));
  return resolved.startsWith('/api') ? resolved : `${apiBase}${resolved}`;
}


When('I define a GET {string}', function (
  { currentRequest }: { currentRequest: CurrentRequest },
  requestName: string,
) {
  const template = getTemplate(requestName);
  currentRequest.method = 'GET';
  currentRequest.endpoint = template;
  delete currentRequest.queryParams;
});

When('I define a POST {string}', function (
  { currentRequest }: { currentRequest: CurrentRequest },
  requestName: string,
) {
  const template = getTemplate(requestName);
  currentRequest.method = 'POST';
  currentRequest.endpoint = template;
  delete currentRequest.queryParams;
  delete currentRequest.body;
});

When('I define a PUT {string}', function (
  { currentRequest }: { currentRequest: CurrentRequest },
  requestName: string,
) {
  const template = getTemplate(requestName);
  currentRequest.method = 'PUT';
  currentRequest.endpoint = template;
  delete currentRequest.queryParams;
  delete currentRequest.body;
});

When('I set {string} to {string}', function (
  { store }: { store: (key: string, value: unknown) => void },
  param: string,
  value: string,
) {
  const parsed = !isNaN(Number(value)) && value !== '' ? Number(value) : value;
  store(`${param}Override`, parsed);
});

Given('I have a request body:', function ({ currentRequest }: { currentRequest: CurrentRequest }, docString: string) {
  currentRequest.body = JSON.parse(docString);
});


When('I set field {string} to {string} in the payload', function (
  { currentRequest }: { currentRequest: CurrentRequest },
  field: string,
  value: string,
) {
  if (!currentRequest.body) throw new Error('No request body set. Use a "Given I have a..." step first.');

  let parsedValue: unknown = value;
  if (value === 'null') parsedValue = null;
  else if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(Number(value))) parsedValue = Number(value);

  currentRequest.body = PayloadMutator.setField(currentRequest.body, field, parsedValue);
});

When('I remove field {string} from the payload', function (
  { currentRequest }: { currentRequest: CurrentRequest },
  field: string,
) {
  if (!currentRequest.body) throw new Error('No request body set');
  currentRequest.body = PayloadMutator.removeField(currentRequest.body, field);
});

When('I corrupt field {string} with {string}', function (
  { currentRequest }: { currentRequest: CurrentRequest },
  field: string,
  corruptionType: string,
) {
  if (!currentRequest.body) throw new Error('No request body set');
  currentRequest.body = PayloadMutator.corruptField(
    currentRequest.body,
    field,
    corruptionType as CorruptionType,
  );
});


When('I send a GET request to {string}', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
) {
  const url = resolvePath(path, instanceId);
  currentRequest.method = 'GET';
  currentRequest.endpoint = url;
  delete currentRequest.body;
  Object.assign(currentResponse, await apiClient.get(url, {}, activeRole.value));
});

When('I send a POST request to {string}', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
) {
  const url = resolvePath(path, instanceId);
  const body = currentRequest.body;
  currentRequest.method = 'POST';
  currentRequest.endpoint = url;
  Object.assign(currentResponse, await apiClient.post(url, { body }, activeRole.value));
});

When('I send a PUT request to {string}', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
) {
  const url = resolvePath(path, instanceId);
  const body = currentRequest.body;
  currentRequest.method = 'PUT';
  currentRequest.endpoint = url;
  Object.assign(currentResponse, await apiClient.put(url, { body }, activeRole.value));
});

When('I send a PATCH request to {string}', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
) {
  const url = resolvePath(path, instanceId);
  const body = currentRequest.body;
  currentRequest.method = 'PATCH';
  currentRequest.endpoint = url;
  Object.assign(currentResponse, await apiClient.patch(url, { body }, activeRole.value));
});

When('I send a DELETE request to {string}', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
) {
  const url = resolvePath(path, instanceId);
  currentRequest.method = 'DELETE';
  currentRequest.endpoint = url;
  delete currentRequest.body;
  Object.assign(currentResponse, await apiClient.delete(url, {}, activeRole.value));
});

When('I send a valid POST request to {string} with:', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    body[key] = isNaN(Number(value)) ? value : Number(value);
  }
  const url = resolvePath(path, instanceId);
  currentRequest.method = 'POST';
  currentRequest.endpoint = url;
  currentRequest.body = body;
  Object.assign(currentResponse, await apiClient.post(url, { body }, activeRole.value));
});

When('I send an invalid POST request to {string} with:', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId }: {
    apiClient: import('../../core/api-client').ApiClient;
    currentRequest: CurrentRequest;
    currentResponse: CurrentResponse;
    activeRole: { value: string };
    instanceId: number;
  },
  path: string,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    body[key] = isNaN(Number(value)) ? value : Number(value);
  }
  const url = resolvePath(path, instanceId);
  currentRequest.method = 'POST';
  currentRequest.endpoint = url;
  currentRequest.body = body;
  Object.assign(currentResponse, await apiClient.post(url, { body }, activeRole.value));
});


Then('I get the response code of {word}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  statusLabel: string,
) {
  const expected = resolveStatus(statusLabel);
  expect(
    currentResponse.status,
    `Expected ${statusLabel} (${expected}) but got ${currentResponse.status}.\nResponse body: ${JSON.stringify(currentResponse.body, null, 2)}`,
  ).to.equal(expected);
});

Then('the response status should be {word}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  statusLabel: string,
) {
  const expected = resolveStatus(statusLabel);
  expect(
    currentResponse.status,
    `Expected ${statusLabel} (${expected}) but got ${currentResponse.status}.\nResponse body: ${JSON.stringify(currentResponse.body, null, 2)}`,
  ).to.equal(expected);
});

Then('the response status should be {word} or {word}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  label1: string,
  label2: string,
) {
  const status1 = resolveStatus(label1);
  const status2 = resolveStatus(label2);
  expect(
    [status1, status2],
    `Expected ${label1} (${status1}) or ${label2} (${status2}) but got ${currentResponse.status}`,
  ).to.include(currentResponse.status);
});

Then('the response field {string} should equal {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
  expected: string,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  expect(String(actual)).to.equal(expected);
});

Then('the response field {string} should equal {float}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
  expected: number,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  expect(actual).to.be.closeTo(expected, 0.001);
});

Then('the response field {string} should be {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
  expected: string,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  if (expected === 'null') {
    expect(actual).to.be.null;
  } else if (expected === 'true') {
    expect(actual).to.be.true;
  } else if (expected === 'false') {
    expect(actual).to.be.false;
  } else {
    expect(String(actual)).to.equal(expected);
  }
});

Then('the response field {string} should not be empty', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  expect(actual, `Field "${field}" should not be empty`).to.be.ok;
});

Then('the response field {string} should be a valid UUID', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(String(actual)).to.match(uuidPattern, `Field "${field}" should be a valid UUID`);
});

Then('the response field {string} should be one of {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
  allowedValues: string,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  const allowed = allowedValues.split(',').map(v => v.trim());
  expect(allowed).to.include(actual, `Field "${field}" value "${actual}" not in [${allowed.join(', ')}]`);
});

Then('the response should contain field {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
) {
  const exists = Comparator.hasField(currentResponse.body as Record<string, unknown>, field);
  expect(exists, `Response should contain field "${field}"`).to.be.true;
});

Then('the response body should be an array', function (
  { currentResponse }: { currentResponse: CurrentResponse },
) {
  expect(Array.isArray(currentResponse.body)).to.be.true;
});

Then('the response should be an empty array', function (
  { currentResponse }: { currentResponse: CurrentResponse },
) {
  expect(Array.isArray(currentResponse.body), 'Response body should be an array').to.be.true;
  expect((currentResponse.body as unknown as unknown[]).length, 'Expected an empty array but got items').to.equal(0);
});

Then('the response body should be an array with at least {int} item(s)', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  count: number,
) {
  expect(Array.isArray(currentResponse.body)).to.be.true;
  expect((currentResponse.body as unknown as unknown[]).length).to.be.at.least(count);
});

Then('the response array should contain exactly {int} items', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  count: number,
) {
  expect(Array.isArray(currentResponse.body), 'Response body should be an array').to.be.true;
  const actual = (currentResponse.body as unknown as unknown[]).length;
  expect(actual, `Expected exactly ${count} item(s) but got ${actual}`).to.equal(count);
});

Then('each item in the response array field {string} should equal {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
  expected: string,
) {
  expect(Array.isArray(currentResponse.body), 'Response body should be an array').to.be.true;
  const items = currentResponse.body as unknown as Record<string, unknown>[];
  items.forEach((item, index) => {
    const actual = Comparator.getNestedValue(item, field);
    expect(
      String(actual),
      `Item[${index}] field "${field}" should equal "${expected}" but got "${actual}"`,
    ).to.equal(expected);
  });
});

Then('the error message should reference field {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
) {
  const body = JSON.stringify(currentResponse.body).toLowerCase();
  expect(body).to.include(field.toLowerCase(), `Error response should mention field "${field}"`);
});

Then('the error should indicate {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  expectedText: string,
) {
  const body = JSON.stringify(currentResponse.body).toLowerCase();
  expect(body).to.include(expectedText.toLowerCase());
});

Then('the response time should be under {int} milliseconds', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  maxMs: number,
) {
  expect(currentResponse.duration, `Response time should be < ${maxMs}ms`).to.be.below(maxMs);
});

Then('I store the response field {string} as {string}', function (
  { currentResponse, store }: { currentResponse: CurrentResponse; store: (k: string, v: unknown) => void },
  field: string,
  key: string,
) {
  const value = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  store(key, value);
});

Then('the response should contain required fields:', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  dataTable: DataTable,
) {
  const fields = dataTable.raw().flat();
  for (const field of fields) {
    const exists = Comparator.hasField(currentResponse.body as Record<string, unknown>, field.trim());
    expect(exists, `Required field "${field.trim()}" missing from response`).to.be.true;
  }
});

Then('the field {string} should be of type {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  field: string,
  expectedType: string,
) {
  const actual = Comparator.getNestedValue(currentResponse.body as Record<string, unknown>, field);
  expect(typeof actual).to.equal(expectedType);
});

Then('I see the error message {string}', function (
  { currentResponse }: { currentResponse: CurrentResponse },
  expectedMessage: string,
) {
  const body = currentResponse.body as unknown as Record<string, unknown>;
  expect(body).to.have.property('errorMessage');
  expect(String(body.errorMessage)).to.equal(expectedMessage);
});

