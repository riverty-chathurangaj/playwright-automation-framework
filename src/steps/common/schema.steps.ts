import { Then } from '../../fixtures';
import { expect } from 'chai';
import { validateSchema } from 'playwright-schema-validator';
import type { SchemaValidator } from '../../schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';
import { config } from '../../core/config';
import swagger from '../../models/test-data/fixtures/swagger.json';

type SchemaFixtures = {
  schemaValidator: SchemaValidator;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
};

Then('each item in the response array should match schema {string}', function (
  { currentResponse, schemaValidator }: Pick<SchemaFixtures, 'currentResponse' | 'schemaValidator'>,
  schemaName: string,
) {
  const body = currentResponse.body;
  expect(Array.isArray(body), `Expected response body to be an array but got: ${typeof body}`).to.be.true;

  const items = body as unknown[];
  items.forEach((item, index) => {
    const result = schemaValidator.validate(schemaName, item);
    expect(
      result.valid,
      `Schema validation failed for "${schemaName}" at item[${index}]:\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
    ).to.be.true;
  });
});

Then('the response should match schema {string}', function (
  { currentResponse, schemaValidator }: Pick<SchemaFixtures, 'currentResponse' | 'schemaValidator'>,
  schemaName: string,
) {
  const result = schemaValidator.validate(schemaName, currentResponse.body);

  expect(
    result.valid,
    `Schema validation failed for "${schemaName}":\n${result.errors?.map(e => `  [${e.path}] ${e.message}`).join('\n')}`,
  ).to.be.true;
});

Then('the response should NOT match schema {string}', function (
  { currentResponse, schemaValidator }: Pick<SchemaFixtures, 'currentResponse' | 'schemaValidator'>,
  schemaName: string,
) {
  const result = schemaValidator.validate(schemaName, currentResponse.body);
  expect(result.valid, `Expected schema "${schemaName}" validation to fail but it passed`).to.be.false;
});

Then('no new undocumented fields should be present in the response', function (
  { currentResponse, schemaValidator, retrieve }: Pick<SchemaFixtures, 'currentResponse' | 'schemaValidator' | 'retrieve'>,
) {
  const schemaName = retrieve<string>('currentSchemaContext') || 'gl-account';
  const result = schemaValidator.validate(schemaName, currentResponse.body);

  expect(
    result.valid,
    `Schema drift detected — undocumented fields present:\n${result.errors?.map(e => `  ${e.path}: ${e.message}`).join('\n')}`,
  ).to.be.true;
});

Then('no previously documented fields should be missing', function (
  { currentResponse, schemaValidator, retrieve }: Pick<SchemaFixtures, 'currentResponse' | 'schemaValidator' | 'retrieve'>,
) {
  const schemaName = retrieve<string>('currentSchemaContext') || 'gl-account';
  const result = schemaValidator.validate(schemaName, currentResponse.body);
  const missingFieldErrors = result.errors?.filter(e => e.keyword === 'required');

  expect(
    !missingFieldErrors?.length,
    `Required fields are missing:\n${missingFieldErrors?.map(e => `  ${e.path}: ${e.message}`).join('\n')}`,
  ).to.be.true;
});

Then('no field types should have changed from the baseline', function (
  { currentResponse, schemaValidator, retrieve }: Pick<SchemaFixtures, 'currentResponse' | 'schemaValidator' | 'retrieve'>,
) {
  const schemaName = retrieve<string>('currentSchemaContext') || 'gl-account';
  const result = schemaValidator.validate(schemaName, currentResponse.body);
  const typeErrors = result.errors?.filter(e => e.keyword === 'type');

  expect(
    !typeErrors?.length,
    `Field type changes detected:\n${typeErrors?.map(e => `  ${e.path}: ${e.message}`).join('\n')}`,
  ).to.be.true;
});

Then('I have the baseline schema snapshot for {string}', function (
  { schemaValidator, store }: Pick<SchemaFixtures, 'schemaValidator' | 'store'>,
  schemaName: string,
) {
  store('currentSchemaContext', schemaName);
  const available = schemaValidator.getAvailableSchemas();
  expect(
    available.includes(schemaName),
    `Schema "${schemaName}" not found. Available: ${available.join(', ')}`,
  ).to.be.true;
});

Then('the response should match swagger schema', async function (
  { currentRequest, currentResponse }: Pick<SchemaFixtures, 'currentRequest' | 'currentResponse'>,
) {
  const endpoint = `/${config.servicePath}${currentRequest.endpoint}`;
  await validateSchema({}, currentResponse.body, swagger, {
    endpoint,
    method: currentRequest.method || 'GET',
    status: currentResponse.status || 200,
  });
});
