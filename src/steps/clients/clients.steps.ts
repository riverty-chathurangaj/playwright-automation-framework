import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates } from '../../utils/request-templates';
import {
  applyRequestParametersFromTable,
  assertArrayResponseMatchesSchema,
  getResponseArray,
  sendDefinedRequest,
  storeResponseArrayCount,
} from '../../utils/domain-step-helpers';
import { ClientResponse } from '../../models/responses/client.response';
import { ClientDepartmentResponse } from '../../models/responses/client-department.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

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

When(
  'I set client request parameters:',
  function ({ currentRequest, store }: Pick<ClientFixtures, 'currentRequest' | 'store'>, dataTable: DataTable) {
    applyRequestParametersFromTable({
      currentRequest,
      dataTable,
      store,
      overrideKeys: ['instanceId'],
    });
  },
);

Then(
  'I send the client request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'the response should be an array of clients',
  function ({ currentResponse, schemaValidator }: Pick<ClientFixtures, 'currentResponse' | 'schemaValidator'>) {
    assertArrayResponseMatchesSchema<ClientResponse>(currentResponse, schemaValidator, {
      schemaName: 'client',
      entityLabel: 'client',
    });
  },
);

Then(
  'I store the clients count as {string}',
  function ({ currentResponse, store }: Pick<ClientFixtures, 'currentResponse' | 'store'>, key: string) {
    storeResponseArrayCount<ClientResponse>(currentResponse, store, key);
  },
);

Then(
  'the stored count {string} should be less than {string}',
  function ({ retrieve }: Pick<ClientFixtures, 'retrieve'>, keyA: string, keyB: string) {
    const a = retrieve<number>(keyA);
    const b = retrieve<number>(keyB);
    expect(a, `Expected ${keyA} (${a}) to be less than ${keyB} (${b})`).to.be.lessThan(b);
  },
);

Then(
  'I send the client departments request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: ClientFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'the response should be an array of client departments',
  function ({ currentResponse }: Pick<ClientFixtures, 'currentResponse'>) {
    getResponseArray<ClientDepartmentResponse>(currentResponse, 'client department', 1);
  },
);
