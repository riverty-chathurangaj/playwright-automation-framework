import { Given, When, Then } from '../../fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import { config } from '../../core/config';
import { registerTemplates } from '../../utils/request-templates';
import { applyRequestParametersFromTable, sendDefinedRequest } from '../../utils/domain-step-helpers';
import type { ApiClient } from '../../core/api-client';
import type { CurrentRequest, CurrentResponse } from '../../fixtures';

const apiBase = `/${config.servicePath}`;

// ── 1. REQUEST_TEMPLATES ─────────────────────────────────────────────────────

registerTemplates({
  'close accounting month request': '/{instanceId}/AccountingMonth/Close',
  'open accounting month request': '/{instanceId}/AccountingMonth/Open',
});

type AccountingMonthFixtures = {
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
  'I set accounting month request parameters:',
  function (
    { currentRequest, store }: Pick<AccountingMonthFixtures, 'currentRequest' | 'store'>,
    dataTable: DataTable,
  ) {
    applyRequestParametersFromTable({
      currentRequest,
      dataTable,
      store,
      overrideKeys: ['instanceId'],
      parseBooleans: false,
    });
  },
);

// Helper: compute year/month offset from "now" in UTC to avoid timezone drift
function getUtcYearMonth(monthOffset: number): { year: number; month: number } {
  const date = new Date();
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth() + monthOffset; // 0-based + offset
  // Normalize: e.g. month = -1 → December of previous year
  const d = new Date(Date.UTC(utcYear, utcMonth, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function resolvePeriodOffset(period: string): number {
  if (period === 'current') return 0;
  if (period === 'previous') return -1;
  throw new Error(`Unknown period "${period}". Use "current" or "previous".`);
}

// ── Setup steps (ensure state, fire-and-forget — no assertions) ──────────────

Given(
  'the {word} accounting month is closed for instance {string} and client {string}',
  async function (
    { apiClient, activeRole }: Pick<AccountingMonthFixtures, 'apiClient' | 'activeRole'>,
    period: string,
    instanceId: string,
    clientId: string,
  ) {
    const { year, month } = getUtcYearMonth(resolvePeriodOffset(period));
    const endpoint = `${apiBase}/${instanceId}/AccountingMonth/Close`;
    await apiClient.post(endpoint, { queryParams: { clientId: Number(clientId), year, month } }, activeRole.value);
  },
);

Given(
  'the {word} accounting month is open for instance {string} and client {string}',
  async function (
    { apiClient, activeRole }: Pick<AccountingMonthFixtures, 'apiClient' | 'activeRole'>,
    period: string,
    instanceId: string,
    clientId: string,
  ) {
    const { year, month } = getUtcYearMonth(resolvePeriodOffset(period));
    const endpoint = `${apiBase}/${instanceId}/AccountingMonth/Open`;
    await apiClient.post(endpoint, { queryParams: { clientId: Number(clientId), year, month } }, activeRole.value);
  },
);

When(
  'I set accounting month to current month',
  function ({ currentRequest }: Pick<AccountingMonthFixtures, 'currentRequest'>) {
    const { year, month } = getUtcYearMonth(0);
    currentRequest.queryParams = { ...currentRequest.queryParams, year, month };
  },
);

When(
  'I set accounting month to previous month',
  function ({ currentRequest }: Pick<AccountingMonthFixtures, 'currentRequest'>) {
    const { year, month } = getUtcYearMonth(-1);
    currentRequest.queryParams = { ...currentRequest.queryParams, year, month };
  },
);

When(
  'I set accounting month to {int} months ago',
  function ({ currentRequest }: Pick<AccountingMonthFixtures, 'currentRequest'>, monthsAgo: number) {
    const { year, month } = getUtcYearMonth(-monthsAgo);
    currentRequest.queryParams = { ...currentRequest.queryParams, year, month };
  },
);

// ── 3. Send steps ────────────────────────────────────────────────────────────

Then(
  'I send the close accounting month request to the API',
  async function ({
    apiClient,
    currentRequest,
    currentResponse,
    activeRole,
    instanceId,
    retrieve,
  }: AccountingMonthFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'post', defaults: { instanceId } },
    );
  },
);

Then(
  'I send the open accounting month request to the API',
  async function ({
    apiClient,
    currentRequest,
    currentResponse,
    activeRole,
    instanceId,
    retrieve,
  }: AccountingMonthFixtures) {
    await sendDefinedRequest(
      { apiClient, currentRequest, currentResponse, activeRole, retrieve },
      { apiBase, requestMethod: 'post', defaults: { instanceId } },
    );
  },
);

// ── 4. Response verification ─────────────────────────────────────────────────

Then(
  'the response should confirm the accounting month parameters',
  function ({
    currentResponse,
    currentRequest,
    retrieve,
    instanceId,
  }: Pick<AccountingMonthFixtures, 'currentResponse' | 'currentRequest' | 'retrieve' | 'instanceId'>) {
    const body = currentResponse.body as unknown as Record<string, unknown>;
    const effectiveInstanceId = retrieve<number>('instanceIdOverride') ?? instanceId;
    const queryParams = currentRequest.queryParams ?? {};

    expect(body.instanceId, 'Response instanceId should match request').to.equal(effectiveInstanceId);

    if (queryParams.clientId !== undefined) {
      expect(body.clientId, 'Response clientId should match request').to.equal(Number(queryParams.clientId));
    }
    if (queryParams.year !== undefined) {
      expect(body.year, 'Response year should match request').to.equal(Number(queryParams.year));
    }
    if (queryParams.month !== undefined) {
      expect(body.month, 'Response month should match request').to.equal(Number(queryParams.month));
    }
  },
);
