import { When, Then } from '@api-fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '@shared-core/config';
import { registerTemplates } from '@api-utils/request-templates';
import {
  applyRequestParametersFromTable,
  assertArrayResponseMatchesSchema,
  sendDefinedRequest,
} from '@api-utils/domain-step-helpers';
import { GLTransactionResponse } from '@api-models/gl/responses/gl-transaction.response';
import type { ApiClient } from '@api-core/api-client';
import type { SchemaValidator } from '@api-schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '@api-fixtures';

const apiBase = `/${config.api.servicePath}`;

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

When(
  'I set transaction request parameters:',
  function ({ currentRequest, store }: Pick<TransactionFixtures, 'currentRequest' | 'store'>, dataTable: DataTable) {
    applyRequestParametersFromTable({
      currentRequest,
      dataTable,
      store,
      overrideKeys: ['instanceId'],
    });
  },
);

// ── 3. Send steps ────────────────────────────────────────────────────────────

Then(
  'I send the transactions request to the API',
  async function ({
    apiClient,
    currentRequest,
    currentResponse,
    activeRole,
    instanceId,
    retrieve,
  }: TransactionFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'I send the transactions by id request to the API',
  async function ({
    apiClient,
    currentRequest,
    currentResponse,
    activeRole,
    instanceId,
    retrieve,
  }: TransactionFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId }, includeQueryParams: false },
    );
  },
);

// ── 4. Response assertions ───────────────────────────────────────────────────

Then(
  'the response should be an array of transactions',
  function ({ currentResponse, schemaValidator }: Pick<TransactionFixtures, 'currentResponse' | 'schemaValidator'>) {
    assertArrayResponseMatchesSchema<GLTransactionResponse>(currentResponse, schemaValidator, {
      schemaName: 'gl-transaction',
      entityLabel: 'transaction',
    });
  },
);
