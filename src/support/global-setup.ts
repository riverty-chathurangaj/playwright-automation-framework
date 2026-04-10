import * as fs from 'fs';
import * as path from 'path';
import { config } from '../core/config';
import { logger } from '../core/logger';

export default async function globalSetup(): Promise<void> {
  logger.info('========================================');
  logger.info('  PW-TESTFORGE-GLS — Test Run Starting       ');
  logger.info('========================================');
  logger.info('Configuration', {
    baseUrl: config.baseUrl,
    env: config.env,
    instanceId: config.instanceId,
  });

  // Write Allure environment properties so reports show test context
  const resultsDir = path.resolve(process.cwd(), 'reports/allure-results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const envProps = [
    `BASE_URL=${config.baseUrl}`,
    `SERVICE_PATH=${config.servicePath}`,
    `INSTANCE_ID=${config.instanceId}`,
    `ENVIRONMENT=${config.env}`,
    `AUTH_AUDIENCE=${config.auth.audience}`,
    `GIT_SHA=${config.gitSha}`,
  ].join('\n');
  fs.writeFileSync(path.join(resultsDir, 'environment.properties'), envProps);
}
