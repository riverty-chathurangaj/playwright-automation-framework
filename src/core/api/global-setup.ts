import * as fs from 'fs';
import * as path from 'path';
import { config } from '@shared-core/config';
import { logger } from '@shared-core/logger';
import { bootstrapDatabaseSecrets } from '@shared-core/secrets/database-secret-bootstrap';

export default async function globalSetup(): Promise<void> {
  await bootstrapDatabaseSecrets();

  logger.info('========================================');
  logger.info('  RIVERTY-PLAYWRIGHT-BDD — API Test Run Starting');
  logger.info('========================================');
  logger.info('Configuration', {
    baseUrl: config.api.baseUrl,
    env: config.env,
    instanceId: config.api.instanceId,
  });

  // Write Allure environment properties so reports show test context
  const resultsDir = path.resolve(process.cwd(), 'reports/allure-results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const envProps = [
    `API_BASE_URL=${config.api.baseUrl}`,
    `API_SERVICE_PATH=${config.api.servicePath}`,
    `INSTANCE_ID=${config.api.instanceId}`,
    `ENVIRONMENT=${config.env}`,
    `AUTH_AUDIENCE=${config.auth.audience}`,
    `GIT_SHA=${config.gitSha}`,
  ].join('\n');
  fs.writeFileSync(path.join(resultsDir, 'environment.properties'), envProps);
}
