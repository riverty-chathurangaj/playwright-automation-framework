import { When, Then } from '@api-fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '@shared-core/config';
import { registerTemplates } from '@api-utils/request-templates';
import { applyRequestParametersFromTable, sendDefinedRequest } from '@api-utils/domain-step-helpers';
import type { ApiClient } from '@api-core/api-client';
import type { CurrentRequest, CurrentResponse } from '@api-fixtures';

const apiBase = `/${config.api.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────

registerTemplates({
  'balance report request': '/{instanceId}/BalanceReport',
});

type BalanceReportFixtures = {
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
  'I set balance report request parameters:',
  function ({ currentRequest }: Pick<BalanceReportFixtures, 'currentRequest'>, dataTable: DataTable) {
    applyRequestParametersFromTable({ currentRequest, dataTable });
  },
);

// ── 3. Send steps ────────────────────────────────────────────────────────────

Then(
  'I send the balance report request to the API',
  async function ({
    apiClient,
    currentRequest,
    currentResponse,
    activeRole,
    instanceId,
    retrieve,
  }: BalanceReportFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);
