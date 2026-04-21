import { logger } from '@shared-core/logger';

export default async function globalTeardown(): Promise<void> {
  logger.info('========================================');
  logger.info('  RIVERTY-PLAYWRIGHT-BDD — Test Run Complete');
  logger.info('========================================');
}
