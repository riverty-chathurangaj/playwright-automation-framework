import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '../../core/config';
import { registerTemplates, resolveEndpoint } from '../../utils/request-templates';
import type { ApiClient } from '../../core/api-client';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────

registerTemplates({
  'balance request': '/{instanceId}/balance',
  'balance listing request': '/{instanceId}/balance/listing',
  'client balance request': '/{instanceId}/balance/ClientBalance',
});

type BalanceFixtures = {
  apiClient: ApiClient;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  instanceId: number;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

// ── 2. Request building ──────────────────────────────────────────────────────

When('I set balance request parameters:', function (
  { currentRequest }: Pick<BalanceFixtures, 'currentRequest'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === 'true' || value === 'false') {
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

When('I set balance listing request parameters:', function (
  { currentRequest }: Pick<BalanceFixtures, 'currentRequest'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === 'true' || value === 'false') {
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

When('I set client balance request parameters:', function (
  { currentRequest }: Pick<BalanceFixtures, 'currentRequest'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === 'true' || value === 'false') {
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

Then('I send the balance request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: BalanceFixtures,
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

Then('I send the balance listing request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: BalanceFixtures,
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

Then('I send the client balance request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: BalanceFixtures,
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

