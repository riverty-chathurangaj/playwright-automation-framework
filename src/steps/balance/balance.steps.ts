import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '../../core/config';
import { registerTemplates } from '../../utils/request-templates';
import { applyRequestParametersFromTable, sendDefinedRequest } from '../../utils/domain-step-helpers';
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

When(
  'I set balance request parameters:',
  function ({ currentRequest }: Pick<BalanceFixtures, 'currentRequest'>, dataTable: DataTable) {
    applyRequestParametersFromTable({ currentRequest, dataTable });
  },
);

When(
  'I set balance listing request parameters:',
  function ({ currentRequest }: Pick<BalanceFixtures, 'currentRequest'>, dataTable: DataTable) {
    applyRequestParametersFromTable({ currentRequest, dataTable });
  },
);

When(
  'I set client balance request parameters:',
  function ({ currentRequest }: Pick<BalanceFixtures, 'currentRequest'>, dataTable: DataTable) {
    applyRequestParametersFromTable({ currentRequest, dataTable });
  },
);

// ── 3. Send steps ────────────────────────────────────────────────────────────

Then(
  'I send the balance request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: BalanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'I send the balance listing request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: BalanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'I send the client balance request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: BalanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);
