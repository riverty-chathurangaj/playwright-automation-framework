import { DatabaseClient } from '@api-database/db-client';
import { logger } from '@shared-core/logger';

export class MigrationChecker {
  constructor(private db: DatabaseClient) {}

  async getCurrentVersion(): Promise<string | null> {
    try {
      const result = await this.db.queryFirst<{ version: string }>(
        'SELECT TOP 1 version FROM schema_migrations ORDER BY applied_at DESC',
      );
      return result?.version || null;
    } catch {
      logger.warn('Could not read schema_migrations table — skipping version check');
      return null;
    }
  }

  async requiredTablesExist(): Promise<{ exists: boolean; missingTables: string[] }> {
    const required = ['gl_accounts', 'journal_entries', 'audit_log'];
    const missing: string[] = [];

    for (const table of required) {
      try {
        await this.db.knex(table).count('* as count').first();
      } catch {
        missing.push(table);
      }
    }

    return { exists: missing.length === 0, missingTables: missing };
  }
}
