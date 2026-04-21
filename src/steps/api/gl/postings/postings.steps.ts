import { When, Then } from '@api-fixtures';
import { DataTable } from 'playwright-bdd';
import { config } from '@shared-core/config';
import { registerTemplates } from '@api-utils/request-templates';
import {
  applyRequestParametersFromTable,
  assertArrayResponseMatchesSchema,
  sendDefinedRequest,
} from '@api-utils/domain-step-helpers';
import type { GLPostingResponse } from '@api-models/gl/responses/gl-posting.response';
import type { ApiClient } from '@api-core/api-client';
import type { SchemaValidator } from '@api-schemas/schema-validator';
import type { CurrentRequest, CurrentResponse } from '@api-fixtures';

const apiBase = `/${config.api.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────

registerTemplates({
  'postings request': '/{instanceId}/postings',
});

type PostingFixtures = {
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
  'I set postings request query parameters:',
  function ({ currentRequest }: Pick<PostingFixtures, 'currentRequest'>, dataTable: DataTable) {
    applyRequestParametersFromTable({
      currentRequest,
      dataTable,
      parseBooleans: false,
    });
  },
);

// ── 3. Send steps ────────────────────────────────────────────────────────────

Then(
  'I send the postings request to the API',
  async function ({ apiClient, currentRequest, currentResponse, activeRole, instanceId, retrieve }: PostingFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'get', defaults: { instanceId } },
    );
  },
);

// ── 4. Response assertions ───────────────────────────────────────────────────

Then(
  'the response should be an array of postings',
  function ({ currentResponse, schemaValidator }: Pick<PostingFixtures, 'currentResponse' | 'schemaValidator'>) {
    assertArrayResponseMatchesSchema<GLPostingResponse>(currentResponse, schemaValidator, {
      schemaName: 'gl-posting',
      entityLabel: 'posting',
    });
  },
);
