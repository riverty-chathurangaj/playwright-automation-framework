import { Then } from '@api-fixtures';
import { expect } from 'chai';
import type { SchemaValidator } from '@api-schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '@api-fixtures';

type ContractFixtures = {
  schemaValidator: SchemaValidator;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
};

Then(
  'the response should satisfy contract {string}',
  function ({ schemaValidator, currentRequest, currentResponse }: ContractFixtures, contractName: string) {
    const endpoint = `${currentRequest.method} ${currentRequest.endpoint}`;
    const result = schemaValidator.validateContract(
      contractName,
      endpoint,
      currentResponse.body as Record<string, unknown>,
    );

    const errors = [
      ...result.missingFields.map((f: string) => `Missing required field: ${f}`),
      ...result.typeErrors,
      ...result.enumErrors,
      ...result.businessRuleErrors,
    ];

    expect(
      result.overall,
      `Contract validation failed for "${contractName}":\n${errors.map((e: string) => `  - ${e}`).join('\n')}`,
    ).to.be.true;
  },
);

Then(
  'the contract should be satisfied for {string} on {string}',
  function (
    { schemaValidator, currentResponse }: Pick<ContractFixtures, 'schemaValidator' | 'currentResponse'>,
    contractName: string,
    endpoint: string,
  ) {
    const result = schemaValidator.validateContract(
      contractName,
      endpoint,
      currentResponse.body as Record<string, unknown>,
    );

    expect(result.overall, `Contract "${contractName}" not satisfied for endpoint "${endpoint}"`).to.be.true;
  },
);

Then(
  'the response schema should be valid against contract {string}',
  function ({ schemaValidator, currentRequest, currentResponse }: ContractFixtures, contractName: string) {
    const endpoint = `${currentRequest.method} ${currentRequest.endpoint}`;
    const result = schemaValidator.validateContract(
      contractName,
      endpoint,
      currentResponse.body as Record<string, unknown>,
    );
    expect(result.schemaValid, `Contract schema validation failed for "${contractName}"`).to.be.true;
  },
);
