import { When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates } from '../../utils/request-templates';
import {
  applyRequestParametersFromTable,
  assertArrayResponseMatchesSchema,
  assertObjectResponseMatchesSchema,
  sendDefinedRequest,
  storeResponseArrayCount,
} from '../../utils/domain-step-helpers';
import { InstanceResponse } from '../../models/responses/instance.response';
import type { ApiClient } from '../../core/api-client';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

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

When(
  'I set instance request parameters:',
  function ({ currentRequest, store }: Pick<InstanceFixtures, 'currentRequest' | 'store'>, dataTable: DataTable) {
    applyRequestParametersFromTable({
      currentRequest,
      dataTable,
      store,
      overrideKeys: ['id', 'instanceId', 'sourceSystemId'],
    });
  },
);

Then(
  'I send the instances request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get' },
    );
  },
);

Then(
  'I send the instance by id request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: InstanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

Then(
  'I send the instance by source system request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get' },
    );
  },
);

Then(
  'I send the activate instance request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'put', includeQueryParams: false },
    );
  },
);

Then(
  'I send the deactivate instance request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, retrieve }: InstanceFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'put', includeQueryParams: false },
    );
  },
);

Then(
  'the response should be an array of instances',
  function ({ currentResponse, schemaValidator }: Pick<InstanceFixtures, 'currentResponse' | 'schemaValidator'>) {
    assertArrayResponseMatchesSchema<InstanceResponse>(currentResponse, schemaValidator, {
      schemaName: 'instance',
      entityLabel: 'instance',
    });
  },
);

Then(
  'the response should be a valid instance',
  function ({ currentResponse, schemaValidator }: Pick<InstanceFixtures, 'currentResponse' | 'schemaValidator'>) {
    assertObjectResponseMatchesSchema<InstanceResponse>(currentResponse, schemaValidator, {
      schemaName: 'instance',
      entityLabel: 'instance',
    });
  },
);

Then(
  'the response instance id should equal {string}',
  function ({ currentResponse }: Pick<InstanceFixtures, 'currentResponse'>, expectedId: string) {
    const body = currentResponse.body as unknown as InstanceResponse;
    expect(body.id, `Expected instance id to be ${expectedId} but got ${body.id}`).to.equal(Number(expectedId));
  },
);

Then(
  'I store the instances count as {string}',
  function ({ currentResponse, store }: Pick<InstanceFixtures, 'currentResponse' | 'store'>, key: string) {
    storeResponseArrayCount<InstanceResponse>(currentResponse, store, key);
  },
);

Then(
  'the instance should have isActive equal to {string}',
  function ({ currentResponse }: Pick<InstanceFixtures, 'currentResponse'>, expected: string) {
    const body = currentResponse.body as unknown as InstanceResponse;
    const expectedBool = expected === 'true';
    expect(body.isActive, `Expected instance isActive to be ${expectedBool} but got ${body.isActive}`).to.equal(
      expectedBool,
    );
  },
);
