import { logger } from '../core/logger';

export default async function globalTeardown(): Promise<void> {
  logger.info('========================================');
  logger.info('  PW-TESTFORGE-GLS — Test Run Complete       ');
  logger.info('========================================');
}
