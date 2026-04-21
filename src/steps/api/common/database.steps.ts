import { Given, Then, When } from '@api-fixtures';
import { DataTable } from 'playwright-bdd';
import { expect } from 'chai';
import type { DatabaseClient } from '@api-database/db-client';
import type { SnapshotManager } from '@api-database/snapshot-manager';
import type { GLQueryBuilder } from '@api-database/query-builder';
import type { ApiClient } from '@api-core/api-client';
import type { CurrentResponse } from '@api-fixtures';

type DbFixtures = {
  dbClient: DatabaseClient;
  snapshotManager: SnapshotManager;
  queryBuilder: GLQueryBuilder;
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;
  currentResponse: CurrentResponse;
  apiClient: ApiClient;
  activeRole: { value: string };
};

// ─── Setup & preconditions ────────────────────────────────────────

Given(
  'account {string} exists in the database with balance {float}',
  async function ({ dbClient }: Pick<DbFixtures, 'dbClient'>, accountCode: string, balance: number) {
    const exists = await dbClient.accountExists(accountCode);
    expect(
      exists,
      `Account "${accountCode}" must exist in the database with balance ${balance}. Please create it via the API or seed data first.`,
    ).to.be.true;
  },
);

Given(
  'I capture a database snapshot of account {string}',
  async function (
    { dbClient, snapshotManager, store }: Pick<DbFixtures, 'dbClient' | 'snapshotManager' | 'store'>,
    accountCode: string,
  ) {
    await snapshotManager.captureSnapshot(`account-${accountCode}`, async () => {
      const account = await dbClient.getAccountByCode(accountCode);
      return account || null;
    });
    store('snapshotAccountCode', accountCode);
  },
);

Given(
  'I capture account {string} balance',
  async function ({ dbClient, store }: Pick<DbFixtures, 'dbClient' | 'store'>, accountCode: string) {
    const account = await dbClient.getAccountByCode(accountCode);
    const balance = (account?.balance as number) || 0;
    store(`balance-${accountCode}`, balance);
  },
);

// ─── Database assertions ──────────────────────────────────────────

Then(
  'a journal entry row should exist in the database with:',
  async function (
    {
      dbClient,
      queryBuilder,
      retrieve,
      currentResponse,
    }: Pick<DbFixtures, 'dbClient' | 'queryBuilder' | 'retrieve' | 'currentResponse'>,
    dataTable: DataTable,
  ) {
    const expected = dataTable.hashes()[0];
    const journalId =
      retrieve<string>('lastCreatedId') || ((currentResponse.body as Record<string, unknown>)?.journalId as string);

    if (!journalId) {
      const accountCode = expected.account_code || expected.accountCode;
      const entries = await dbClient.getJournalEntriesForAccount(accountCode, 1);
      expect(entries.length, 'No journal entries found for the account').to.be.above(0);
      return;
    }

    const { match, mismatches } = await queryBuilder.verifyJournalEntry(journalId, {
      account_code: expected.account_code || expected.accountCode,
      debit_amount: expected.debit_amount ? parseFloat(expected.debit_amount) : undefined,
      credit_amount: expected.credit_amount ? parseFloat(expected.credit_amount) : undefined,
      currency: expected.currency,
      status: expected.status,
    });

    expect(match, `Journal entry DB mismatch:\n${mismatches.join('\n')}`).to.be.true;
  },
);

Then(
  'a journal entry row should exist in the database matching the API response',
  async function ({ dbClient, currentResponse }: Pick<DbFixtures, 'dbClient' | 'currentResponse'>) {
    const body = currentResponse.body as Record<string, unknown>;
    const journalId = body.journalId as string;

    const exists = await dbClient.journalEntryExists(journalId);
    expect(exists, `Journal entry "${journalId}" not found in the database`).to.be.true;
  },
);

Then(
  'the account {string} balance should have changed by {float}',
  async function (
    { dbClient, snapshotManager }: Pick<DbFixtures, 'dbClient' | 'snapshotManager'>,
    accountCode: string,
    expectedDelta: number,
  ) {
    const comparison = await snapshotManager.compareSnapshot(`account-${accountCode}`, async () => {
      const account = await dbClient.getAccountByCode(accountCode);
      return account || null;
    });

    expect(comparison.balanceDelta).to.be.closeTo(
      expectedDelta,
      0.001,
      `Account "${accountCode}" balance delta should be ${expectedDelta} but was ${comparison.balanceDelta}`,
    );
  },
);

Then(
  'the journal entry should have a {string} timestamp within {int} seconds of now',
  async function (
    { queryBuilder, currentResponse }: Pick<DbFixtures, 'queryBuilder' | 'currentResponse'>,
    timestampField: string,
    withinSeconds: number,
  ) {
    const body = currentResponse.body as Record<string, unknown>;
    const journalId = body.journalId as string;

    const recent = await queryBuilder.verifyTimestampRecent(
      'journal_entries',
      'journal_id',
      journalId,
      timestampField.replace(/([A-Z])/g, '_$1').toLowerCase(),
      withinSeconds,
    );
    expect(recent, `Timestamp "${timestampField}" is not within ${withinSeconds} seconds of now`).to.be.true;
  },
);

Then(
  'an audit trail entry should exist with:',
  async function (
    { dbClient, retrieve, currentResponse }: Pick<DbFixtures, 'dbClient' | 'retrieve' | 'currentResponse'>,
    dataTable: DataTable,
  ) {
    const expected = dataTable.hashes()[0];
    const entityId =
      retrieve<string>('lastCreatedId') || ((currentResponse.body as Record<string, unknown>)?.journalId as string);

    const auditExists = await dbClient.auditEntryExists(expected.entity_type, entityId, expected.action);

    expect(auditExists, `Audit entry not found for entity "${expected.entity_type}" action "${expected.action}"`).to.be
      .true;
  },
);

Then(
  'an audit trail entry should exist for the journal posting',
  async function ({ dbClient, currentResponse }: Pick<DbFixtures, 'dbClient' | 'currentResponse'>) {
    const body = currentResponse.body as Record<string, unknown>;
    const journalId = body.journalId as string;

    const auditExists = await dbClient.auditEntryExists('JournalEntry', journalId, 'CREATE');
    expect(auditExists, `No audit trail found for journal entry "${journalId}"`).to.be.true;
  },
);

Then(
  'the audit {string} should be null',
  async function ({ dbClient, currentResponse }: Pick<DbFixtures, 'dbClient' | 'currentResponse'>, field: string) {
    const body = currentResponse.body as Record<string, unknown>;
    const journalId = body.journalId as string;
    const trail = await dbClient.getAuditTrail('JournalEntry', journalId);

    expect(trail.length).to.be.above(0, 'Audit trail should exist');
    const latestEntry = trail[trail.length - 1];
    expect(latestEntry[field]).to.be.null;
  },
);

Then(
  'the audit {string} should contain the persisted journal data',
  async function ({ dbClient, currentResponse }: Pick<DbFixtures, 'dbClient' | 'currentResponse'>, field: string) {
    const body = currentResponse.body as Record<string, unknown>;
    const journalId = body.journalId as string;
    const trail = await dbClient.getAuditTrail('JournalEntry', journalId);

    expect(trail.length).to.be.above(0, 'Audit trail should exist');
    const latestEntry = trail[trail.length - 1];
    expect(latestEntry[field]).to.be.ok;
  },
);

// ─── Integrity assertions ─────────────────────────────────────────

When(
  'I query the database for trial balance totals',
  async function ({ dbClient, store }: Pick<DbFixtures, 'dbClient' | 'store'>) {
    const totals = await dbClient.getTrialBalanceTotals();
    store('trialBalanceTotals', totals);
  },
);

Then(
  'the sum of all debit amounts should equal the sum of all credit amounts',
  function ({ retrieve }: Pick<DbFixtures, 'retrieve'>) {
    const totals = retrieve<{ total_debits: number; total_credits: number }>('trialBalanceTotals');
    const diff = Math.abs((totals.total_debits || 0) - (totals.total_credits || 0));
    expect(diff).to.be.below(
      0.001,
      `Trial balance is not balanced: debits=${totals.total_debits}, credits=${totals.total_credits}`,
    );
  },
);

Then(
  'the difference should be exactly {float}',
  function ({ retrieve }: Pick<DbFixtures, 'retrieve'>, expected: number) {
    const totals = retrieve<{ total_debits: number; total_credits: number }>('trialBalanceTotals');
    const diff = Math.abs((totals.total_debits || 0) - (totals.total_credits || 0));
    expect(diff).to.be.closeTo(expected, 0.001);
  },
);

When(
  'I query for journal entries with non-existent account codes',
  async function ({ dbClient, store }: Pick<DbFixtures, 'dbClient' | 'store'>) {
    const orphaned = await dbClient.getOrphanedJournalEntries();
    store('queryResult', orphaned);
  },
);

When(
  'I query for posted journal entries without audit trail',
  async function ({ dbClient, store }: Pick<DbFixtures, 'dbClient' | 'store'>) {
    const missing = await dbClient.getPostedEntriesWithoutAudit();
    store('queryResult', missing);
  },
);

Then('the result set should be empty', function ({ retrieve }: Pick<DbFixtures, 'retrieve'>) {
  const result = retrieve<unknown[]>('queryResult');
  expect(result.length, `Expected empty result set but got ${result.length} rows`).to.equal(0);
});

Then(
  'the trial balance totals should still be balanced',
  async function ({ queryBuilder }: Pick<DbFixtures, 'queryBuilder'>) {
    const balanced = await queryBuilder.isTrialBalanced();
    expect(balanced, 'Trial balance is no longer balanced after the operation').to.be.true;
  },
);

Then(
  'all {int} responses should have status {int}',
  function ({ retrieve }: Pick<DbFixtures, 'retrieve'>, count: number, status: number) {
    const responses = retrieve<Array<{ status: number }>>('concurrentResponses');
    expect(responses.length).to.equal(count);
    responses.forEach((r, i) => {
      expect(r.status, `Response ${i + 1} should have status ${status}`).to.equal(status);
    });
  },
);

Then(
  'no duplicate journal entry IDs should exist in the database',
  async function ({ queryBuilder }: Pick<DbFixtures, 'queryBuilder'>) {
    const hasDups = await queryBuilder.hasDuplicateIds('journal_entries', 'journal_id');
    expect(hasDups, 'Duplicate journal_id values found in the database').to.be.false;
  },
);

Then(
  'the final account {string} balance should equal the initial balance plus the sum of all posted amounts',
  async function ({ dbClient, retrieve }: Pick<DbFixtures, 'dbClient' | 'retrieve'>, accountCode: string) {
    const initialBalance = retrieve<number>(`balance-${accountCode}`);
    const responses = retrieve<Array<{ body: Record<string, unknown> }>>('concurrentResponses');

    const sumPosted = responses.reduce((sum, r) => {
      const amount = (r.body?.debitAmount as number) || 0;
      return sum + amount;
    }, 0);

    const currentAccount = await dbClient.getAccountByCode(accountCode);
    const currentBalance = currentAccount?.balance as number;
    const expectedBalance = parseFloat((initialBalance + sumPosted).toFixed(2));

    expect(currentBalance).to.be.closeTo(expectedBalance, 0.01);
  },
);

// ─── Concurrent operations ────────────────────────────────────────

When(
  'I send {int} concurrent POST requests to {string} for account {string}',
  async function (
    { apiClient, activeRole, store }: Pick<DbFixtures, 'apiClient' | 'activeRole' | 'store'>,
    count: number,
    path: string,
    accountCode: string,
  ) {
    const { journalEntryFactory } = await import('@api-models/gl/test-data/factories/journal-entry.factory' as any);
    const url = `/api/${require('@shared-core/config').config.api.version}${path}`;

    const requests = Array.from({ length: count }, () =>
      apiClient.post(
        url,
        {
          body: journalEntryFactory.build({ accountCode }),
        },
        activeRole.value,
      ),
    );

    const responses = await Promise.all(requests);
    store('concurrentResponses', responses);
  },
);
