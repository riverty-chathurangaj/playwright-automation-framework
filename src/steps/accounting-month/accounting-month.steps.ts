import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '../../core/config';
import { registerTemplates, resolveEndpoint } from '../../utils/request-templates';
import type { ApiClient } from '../../core/api-client';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────

registerTemplates({
  'close accounting month request': '/{instanceId}/AccountingMonth/Close',
});

type AccountingMonthFixtures = {
  apiClient: ApiClient;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  instanceId: number;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

// ── 2. Request building ──────────────────────────────────────────────────────

When('I set accounting month request parameters:', function (
  { currentRequest, store }: Pick<AccountingMonthFixtures, 'currentRequest' | 'store'>,
  dataTable: DataTable,
) {
  const row = dataTable.hashes()[0];
  const queryParams: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === 'instanceId') {
      store('instanceIdOverride', Number(value));
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

Then('I send the close accounting month request to the API', async function (
  { apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: AccountingMonthFixtures,
) {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error('No request defined. Use a "When I define a POST..." step first.');
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, { instanceId })}`;

  Object.assign(
    currentResponse,
    await apiClient.post(resolvedEndpoint, { queryParams: currentRequest.queryParams }, activeRole.value),
  );
});

