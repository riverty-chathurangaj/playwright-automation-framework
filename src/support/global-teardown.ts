import { logger } from '../core/logger';

export default async function globalTeardown(): Promise<void> {
  logger.info('========================================');
  logger.info('  TESTONAUT GL — Test Run Complete       ');
  logger.info('========================================');
}
