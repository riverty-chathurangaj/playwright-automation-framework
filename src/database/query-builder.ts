import { DatabaseClient } from './db-client';

/**
 * Domain-specific query builder — higher-level abstractions over DatabaseClient
 * that encode GL business logic and common query patterns.
 */
export class GLQueryBuilder {
  constructor(private db: DatabaseClient) {}

  // Check that trial balance is balanced (debits == credits)
  async isTrialBalanced(tolerance: number = 0.001): Promise<boolean> {
    const totals = await this.db.getTrialBalanceTotals();
    const diff = Math.abs((totals.total_debits || 0) - (totals.total_credits || 0));
    return diff <= tolerance;
  }

  // Verify account balance changed by expected delta
  async verifyBalanceDelta(
    accountCode: string,
    expectedDelta: number,
    snapshotBalance: number,
    tolerance: number = 0.001,
  ): Promise<boolean> {
    const account = await this.db.getAccountByCode(accountCode);
    if (!account) return false;
    const actualBalance = account.balance as number;
    const actualDelta = actualBalance - snapshotBalance;
    return Math.abs(actualDelta - expectedDelta) <= tolerance;
  }

  // Verify journal entry row matches expected values
  async verifyJournalEntry(
    journalId: string,
    expected: Record<string, unknown>,
  ): Promise<{ match: boolean; mismatches: string[] }> {
    const entry = await this.db.getJournalEntryById(journalId);
    if (!entry) return { match: false, mismatches: [`Journal entry ${journalId} not found in database`] };

    const mismatches: string[] = [];

    for (const [column, expectedValue] of Object.entries(expected)) {
      const actualValue = entry[column];
      const numExpected = typeof expectedValue === 'number';
      const numActual = typeof actualValue === 'number';

      if (numExpected && numActual) {
        if (Math.abs((actualValue as number) - (expectedValue as number)) > 0.001) {
          mismatches.push(`Column "${column}": expected ${expectedValue} but got ${actualValue}`);
        }
      } else if (String(actualValue) !== String(expectedValue)) {
        mismatches.push(`Column "${column}": expected "${expectedValue}" but got "${actualValue}"`);
      }
    }

    return { match: mismatches.length === 0, mismatches };
  }

  // Verify that a timestamp is within N seconds of now
  async verifyTimestampRecent(
    table: string,
    idColumn: string,
    id: string,
    timestampColumn: string,
    withinSeconds: number = 60,
  ): Promise<boolean> {
    const row = await this.db.knex(table).where({ [idColumn]: id }).first();
    if (!row) return false;

    const timestamp = new Date(row[timestampColumn] as string);
    const now = new Date();
    const diffSeconds = Math.abs((now.getTime() - timestamp.getTime()) / 1000);
    return diffSeconds <= withinSeconds;
  }

  // Get concurrent entries by correlation or batch ID
  async getConcurrentEntries(
    accountCode: string,
    count: number,
    withinSeconds: number = 30,
  ): Promise<Record<string, unknown>[]> {
    const cutoff = new Date(Date.now() - withinSeconds * 1000);
    return this.db.knex('journal_entries')
      .where({ account_code: accountCode })
      .where('created_at', '>=', cutoff)
      .orderBy('created_at', 'asc')
      .limit(count);
  }

  // Check for duplicate IDs in a table
  async hasDuplicateIds(table: string, idColumn: string): Promise<boolean> {
    const result = await this.db.knex(table)
      .select(idColumn)
      .count(`${idColumn} as count`)
      .groupBy(idColumn)
      .having(this.db.knex.raw('COUNT(??) > 1', [idColumn]));

    return result.length > 0;
  }
}
