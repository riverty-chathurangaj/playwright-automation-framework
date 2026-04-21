import { expect } from 'chai';
import { DataTable } from 'playwright-bdd';
import type { ApiClient, RequestOptions } from '@api-core/api-client';
import type { CurrentRequest, CurrentResponse } from '@api-fixtures';
import type { SchemaValidator, ValidationError } from '@api-schemas/schema-validator';
import { resolveEndpoint } from '@api-utils/request-templates';

type PrimitiveValue = string | number | boolean;
type RequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type StoreFn = (key: string, value: unknown) => void;
type RetrieveFn = <T = unknown>(key: string) => T;

type DispatchFixtures = {
  apiClient: ApiClient;
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  activeRole: { value: string };
  retrieve: RetrieveFn;
};

type ApplyRequestParametersOptions = {
  currentRequest: CurrentRequest;
  dataTable: DataTable;
  store?: StoreFn;
  overrideKeys?: string[];
  parseBooleans?: boolean;
};

type SendDefinedRequestOptions = {
  apiBase: string;
  requestMethod: RequestMethod;
  defaults?: Record<string, string | number>;
  includeQueryParams?: boolean;
  includeBody?: boolean;
  extraOptions?: Omit<RequestOptions, 'queryParams' | 'body'>;
};

type ArraySchemaAssertionOptions = {
  schemaName: string;
  entityLabel: string;
  minimumItems?: number;
};

type ObjectSchemaAssertionOptions = {
  schemaName: string;
  entityLabel: string;
};

function parseRequestValue(value: string, parseBooleans: boolean): PrimitiveValue {
  if (parseBooleans && (value === 'true' || value === 'false')) {
    return value === 'true';
  }

  if (!Number.isNaN(Number(value)) && value !== '') {
    return Number(value);
  }

  return value;
}

function formatSchemaErrors(errors?: ValidationError[]): string {
  return (
    errors?.map((error) => `  [${error.path}] ${error.message ?? 'Unknown error'}`).join('\n') ??
    '  [root] Unknown schema validation error'
  );
}

async function invokeRequest(
  apiClient: ApiClient,
  method: RequestMethod,
  endpoint: string,
  options: RequestOptions,
  role: string,
) {
  switch (method) {
    case 'get':
      return apiClient.get(endpoint, options, role);
    case 'post':
      return apiClient.post(endpoint, options, role);
    case 'put':
      return apiClient.put(endpoint, options, role);
    case 'patch':
      return apiClient.patch(endpoint, options, role);
    case 'delete':
      return apiClient.delete(endpoint, options, role);
  }
}

export function applyRequestParametersFromTable({
  currentRequest,
  dataTable,
  store,
  overrideKeys = [],
  parseBooleans = true,
}: ApplyRequestParametersOptions): void {
  const row = dataTable.hashes()[0] ?? {};
  const queryParams: Record<string, PrimitiveValue> = {};
  const overrideKeySet = new Set(overrideKeys);

  for (const [key, value] of Object.entries(row)) {
    const parsedValue = parseRequestValue(value, parseBooleans);

    if (overrideKeySet.has(key)) {
      if (!store) {
        throw new Error(`No store fixture provided for override key "${key}".`);
      }

      store(`${key}Override`, parsedValue);
      continue;
    }

    queryParams[key] = parsedValue;
  }

  if (Object.keys(queryParams).length > 0) {
    currentRequest.queryParams = { ...currentRequest.queryParams, ...queryParams };
  }
}

export async function sendDefinedRequest(
  { apiClient, currentRequest, currentResponse, activeRole, retrieve }: DispatchFixtures,
  {
    apiBase,
    requestMethod,
    defaults = {},
    includeQueryParams = true,
    includeBody = false,
    extraOptions = {},
  }: SendDefinedRequestOptions,
): Promise<void> {
  const { method, endpoint } = currentRequest;

  if (!method || !endpoint) {
    throw new Error(`No request defined. Use a "When I define a ${requestMethod.toUpperCase()}..." step first.`);
  }

  const resolvedEndpoint = `${apiBase}${resolveEndpoint(endpoint, retrieve, defaults)}`;
  const requestOptions: RequestOptions = { ...extraOptions };

  if (includeQueryParams) {
    requestOptions.queryParams = currentRequest.queryParams;
  }

  if (includeBody) {
    requestOptions.body = currentRequest.body;
  }

  Object.assign(
    currentResponse,
    await invokeRequest(apiClient, requestMethod, resolvedEndpoint, requestOptions, activeRole.value),
  );
}

export function getResponseArray<T>(
  currentResponse: CurrentResponse,
  itemLabel: string = 'item',
  minimumItems: number = 0,
): T[] {
  const body = currentResponse.body as unknown as T[];

  expect(Array.isArray(body), 'Response body should be an array').to.be.true;

  if (minimumItems > 0) {
    expect(
      body.length,
      `Expected at least ${minimumItems} ${itemLabel} in the response but got ${body.length}`,
    ).to.be.at.least(minimumItems);
  }

  return body;
}

export function assertArrayResponseMatchesSchema<T>(
  currentResponse: CurrentResponse,
  schemaValidator: SchemaValidator,
  { schemaName, entityLabel, minimumItems = 1 }: ArraySchemaAssertionOptions,
): T[] {
  const body = getResponseArray<T>(currentResponse, entityLabel, minimumItems);

  body.forEach((item, index) => {
    const result = schemaValidator.validate(schemaName, item);
    expect(
      result.valid,
      `Schema validation failed for ${entityLabel} at index [${index}]:\n${formatSchemaErrors(result.errors)}`,
    ).to.be.true;
  });

  return body;
}

export function assertObjectResponseMatchesSchema<T>(
  currentResponse: CurrentResponse,
  schemaValidator: SchemaValidator,
  { schemaName, entityLabel }: ObjectSchemaAssertionOptions,
): T {
  const body = currentResponse.body as unknown as T;

  expect(body, 'Response body should not be null or undefined').to.not.be.null;
  expect(typeof body, 'Response body should be an object').to.equal('object');
  expect(Array.isArray(body), 'Response body should not be an array').to.be.false;

  const result = schemaValidator.validate(schemaName, body);
  expect(result.valid, `Schema validation failed for ${entityLabel}:\n${formatSchemaErrors(result.errors)}`).to.be.true;

  return body;
}

export function storeResponseArrayCount<T>(currentResponse: CurrentResponse, store: StoreFn, key: string): void {
  const body = getResponseArray<T>(currentResponse);
  store(key, body.length);
}
