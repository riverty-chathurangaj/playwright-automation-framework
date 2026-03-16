import { DatabaseClient } from './db-client';
import { logger } from '../core/logger';

interface TrackedRecord {
  table: string;
  id: string;
  idColumn: string;
  description?: string;
}

export class CleanupManager {
  private trackedRecords: TrackedRecord[] = [];

  trackRecord(table: string, id: string, idColumn: string = 'id', description?: string): void {
    this.trackedRecords.push({ table, id, idColumn, description });
    logger.debug('Tracking record for cleanup', { table, id, idColumn });
  }

  async cleanup(dbClient: DatabaseClient): Promise<void> {
    if (this.trackedRecords.length === 0) return;

    logger.debug('Cleaning up test data', { count: this.trackedRecords.length });

    const toClean = [...this.trackedRecords].reverse();

    const errors: string[] = [];
    for (const record of toClean) {
      try {
        await dbClient.deleteTestData(record.table, record.id, record.idColumn);
        logger.debug('Cleaned up record', { table: record.table, id: record.id });
      } catch (error) {
        const msg = `Failed to clean ${record.table}/${record.id}: ${(error as Error).message}`;
        errors.push(msg);
        logger.warn(msg);
      }
    }

    this.trackedRecords = [];

    if (errors.length > 0) {
      logger.warn('Some cleanup operations failed', { errors });
    }
  }

  async cleanupByPrefix(
    dbClient: DatabaseClient,
    table: string,
    column: string,
    prefix: string,
  ): Promise<number> {
    const result = await dbClient.knex(table)
      .where(column, 'like', `${prefix}%`)
      .delete();

    logger.debug('Cleaned up by prefix', { table, column, prefix, deleted: result });
    return result;
  }

  getTrackedCount(): number {
    return this.trackedRecords.length;
  }

  clear(): void {
    this.trackedRecords = [];
  }
}
