import knex, { Knex } from 'knex';
import { config } from '@shared-core/config';
import { logDb, logger } from '@shared-core/logger';

export class DatabaseClient {
  private db!: Knex;
  private connected: boolean = false;

  async connect(): Promise<void> {
    const dbConfig = config.database;

    const knexConfig: Knex.Config = {
      client: dbConfig.client,
      connection: this.buildConnectionConfig(dbConfig),
      pool: { min: 0, max: 5 },
      acquireConnectionTimeout: 120_000,
      debug: config.logLevel === 'debug',
    };

    this.db = knex(knexConfig);

    try {
      await this.db.raw('SELECT 1');
      this.connected = true;
      logger.info('Database connected', {
        client: dbConfig.client,
        host: dbConfig.host,
        database: dbConfig.name,
        authType: dbConfig.authType,
      });
    } catch (error) {
      logger.error('Database connection failed', { error });
      throw error;
    }
  }

  private buildConnectionConfig(cfg: typeof config.database): Knex.StaticConnectionConfig {
    // Azure AD passwordless — knex maps `type` into tedious `authentication.type`
    if (cfg.client === 'mssql' && cfg.authType === 'azure-active-directory-default') {
      return {
        server: cfg.host,
        database: cfg.name,
        type: 'azure-active-directory-default',
        options: {
          encrypt: true,
          trustServerCertificate: false,
          requestTimeout: cfg.queryTimeout,
          connectTimeout: 120_000,
          port: cfg.port,
        },
      } as unknown as Knex.MsSqlConnectionConfig;
    }

    // Standard SQL auth
    const base = {
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.name,
      port: cfg.port,
    };

    if (cfg.client === 'mssql') {
      return {
        ...base,
        options: {
          encrypt: false,
          trustServerCertificate: false,
          requestTimeout: cfg.queryTimeout,
          connectTimeout: 120_000,
        },
      } as unknown as Knex.MsSqlConnectionConfig;
    }

    return base as Knex.ConnectionConfig;
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.connected = false;
      logger.debug('Database disconnected');
    }
  }

  // --- Generic query methods ---

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    logDb('raw', 'query', { sql: sql.substring(0, 100), params });
    const result = await this.db.raw(sql, params || []);
    return (result.rows || result[0] || result) as T[];
  }

  async queryFirst<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  // --- GL Account queries ---

  async getAccountByCode(accountCode: string): Promise<Record<string, unknown> | undefined> {
    logDb('SELECT', 'gl_accounts', { accountCode });
    return this.db('gl_accounts').where({ account_code: accountCode }).first();
  }

  async getAccountById(accountId: string): Promise<Record<string, unknown> | undefined> {
    return this.db('gl_accounts').where({ account_id: accountId }).first();
  }

  async accountExists(accountCode: string): Promise<boolean> {
    const result = await this.getAccountByCode(accountCode);
    return result !== undefined;
  }

  // --- Journal Entry queries ---

  async getJournalEntryById(journalId: string): Promise<Record<string, unknown> | undefined> {
    logDb('SELECT', 'journal_entries', { journalId });
    return this.db('journal_entries').where({ journal_id: journalId }).first();
  }

  async getJournalEntriesForAccount(accountCode: string, limit: number = 50): Promise<Record<string, unknown>[]> {
    return this.db('journal_entries').where({ account_code: accountCode }).orderBy('created_at', 'desc').limit(limit);
  }

  async journalEntryExists(journalId: string): Promise<boolean> {
    const result = await this.getJournalEntryById(journalId);
    return result !== undefined;
  }

  // --- Trial Balance queries ---

  async getTrialBalanceTotals(): Promise<{ total_debits: number; total_credits: number }> {
    logDb('AGGREGATE', 'journal_entries', { status: 'posted' });
    const result = await this.db('journal_entries')
      .where({ status: 'posted' })
      .select(this.db.raw('SUM(debit_amount) as total_debits'), this.db.raw('SUM(credit_amount) as total_credits'))
      .first();

    return result as { total_debits: number; total_credits: number };
  }

  // --- Audit Trail queries ---

  async getAuditTrail(entityType: string, entityId: string): Promise<Record<string, unknown>[]> {
    logDb('SELECT', 'audit_log', { entityType, entityId });
    return this.db('audit_log').where({ entity_type: entityType, entity_id: entityId }).orderBy('created_at', 'asc');
  }

  async auditEntryExists(entityType: string, entityId: string, action: string): Promise<boolean> {
    const result = await this.db('audit_log').where({ entity_type: entityType, entity_id: entityId, action }).first();
    return result !== undefined;
  }

  // --- Integrity checks ---

  async getOrphanedJournalEntries(): Promise<Record<string, unknown>[]> {
    return this.db('journal_entries as je')
      .leftJoin('gl_accounts as ga', 'je.account_code', 'ga.account_code')
      .whereNull('ga.account_code')
      .select('je.*');
  }

  async getPostedEntriesWithoutAudit(): Promise<Record<string, unknown>[]> {
    const db = this.db;
    return db('journal_entries as je')
      .leftJoin('audit_log as al', function () {
        this.on('al.entity_id', '=', 'je.journal_id').andOn('al.entity_type', '=', db.raw("'JournalEntry'"));
      })
      .where('je.status', 'posted')
      .whereNull('al.entity_id')
      .select('je.*');
  }

  // --- Transaction queries (Data.Transaction table) ---

  async getTransactionsByReference(
    instanceId: number,
    reference: string,
    createdAfter?: Date,
    partitionId?: number,
  ): Promise<Record<string, unknown>[]> {
    logDb('SELECT', 'Data.Transaction', { instanceId, reference, partitionId });
    const qb = this.db('Data.Transaction').where({ InstanceId: instanceId, Reference: reference });

    if (partitionId !== undefined) {
      qb.where('PartitionId', partitionId);
    }

    if (createdAfter) {
      qb.where('CreatedDate', '>=', createdAfter);
    }

    return qb.orderBy('Id', 'asc');
  }

  async getTransactionsByReferenceWithRetry(
    instanceId: number,
    reference: string,
    timeoutMs: number = 30_000,
    intervalMs: number = 2_000,
    createdAfter?: Date,
    partitionId?: number,
    matchPredicate: (rows: Record<string, unknown>[]) => boolean = (rows) => rows.length > 0,
  ): Promise<Record<string, unknown>[]> {
    const start = Date.now();
    const cutoff = createdAfter ?? new Date(start - 5 * 60_000); // default: last 5 minutes

    while (Date.now() - start < timeoutMs) {
      const rows = await this.getTransactionsByReference(instanceId, reference, cutoff, partitionId);
      if (matchPredicate(rows)) {
        logger.info('Transactions found in Data.Transaction', {
          instanceId,
          reference,
          count: rows.length,
          elapsedMs: Date.now() - start,
        });
        return rows;
      }
      logger.debug('No transactions yet, polling...', {
        instanceId,
        reference,
        count: rows.length,
        elapsedMs: Date.now() - start,
      });
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for transactions in Data.Transaction ` +
        `(InstanceId=${instanceId}, Reference="${reference}")`,
    );
  }

  // --- Test data setup ---

  async insertTestAccount(account: Record<string, unknown>): Promise<string> {
    logDb('INSERT', 'gl_accounts', account);
    const [id] = await this.db('gl_accounts').insert(account).returning('account_id');
    return String(id.account_id || id);
  }

  async deleteTestData(table: string, id: string, idColumn: string = 'id'): Promise<void> {
    logDb('DELETE', table, { id });
    await this.db(table)
      .where({ [idColumn]: id })
      .delete();
  }

  get knex(): Knex {
    return this.db;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
