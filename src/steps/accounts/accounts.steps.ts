import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '../../core/config';
import { registerTemplates } from '../../utils/request-templates';
import {
  applyRequestParametersFromTable,
  assertArrayResponseMatchesSchema,
  sendDefinedRequest,
  storeResponseArrayCount,
} from '../../utils/domain-step-helpers';
import { GLAccountResponse } from '../../models/responses/gl-account.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

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

When(
  'I set account request parameters:',
  function ({ currentRequest, store }: Pick<AccountFixtures, 'currentRequest' | 'store'>, dataTable: DataTable) {
    applyRequestParametersFromTable({
      currentRequest,
      dataTable,
      store,
      overrideKeys: ['instanceId', 'postingId'],
    });
  },
);

Then(
  'I send the accounts request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: AccountFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'I send the accounts by posting request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: AccountFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'the response should be an array of accounts',
  function ({ currentResponse, schemaValidator }: Pick<AccountFixtures, 'currentResponse' | 'schemaValidator'>) {
    assertArrayResponseMatchesSchema<GLAccountResponse>(currentResponse, schemaValidator, {
      schemaName: 'gl-account',
      entityLabel: 'account',
    });
  },
);

Then(
  'I store the accounts count as {string}',
  function ({ currentResponse, store }: Pick<AccountFixtures, 'currentResponse' | 'store'>, key: string) {
    storeResponseArrayCount<GLAccountResponse>(currentResponse, store, key);
  },
);
