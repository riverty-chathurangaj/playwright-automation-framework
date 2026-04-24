import * as fs from 'fs';
import * as path from 'path';
import { config } from '@shared-core/config';
import { logger } from '@shared-core/logger';

export default async function globalSetup(): Promise<void> {
  logger.info('========================================');
  logger.info('  RIVERTY-PLAYWRIGHT-BDD — UI Test Run Starting');
  logger.info('========================================');
  logger.info('UI configuration', {
    uiBaseUrl: config.ui.baseUrl,
    env: config.env,
    authStoragePath: config.ui.authStoragePath,
  });

  const resultsDir = path.resolve(process.cwd(), 'reports/allure-results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const envProps = [
    `UI_BASE_URL=${config.ui.baseUrl}`,
    `UI_AUTH_STORAGE_PATH=${config.ui.authStoragePath}`,
    `ENVIRONMENT=${config.env}`,
    `GIT_SHA=${config.gitSha}`,
  ].join('\n');
  fs.writeFileSync(path.join(resultsDir, 'environment.properties'), envProps);
}
