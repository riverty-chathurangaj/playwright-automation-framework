import * as fs from 'fs';
import * as path from 'path';
import type { Browser } from '@playwright/test';
import { config } from '@shared-core/config';
import { logger } from '@shared-core/logger';
import { DashboardPage } from '@ui-pages/gl/dashboard.page';
import { LoginPage } from '@ui-pages/gl/login.page';

function resolveStorageStatePath(): string {
  return path.resolve(process.cwd(), config.ui.authStoragePath);
}

export function resetUiAuthStorageState(): void {
  const storageStatePath = resolveStorageStatePath();
  if (fs.existsSync(storageStatePath)) {
    fs.unlinkSync(storageStatePath);
  }
}

export async function ensureUiAuthStorageState(browser: Browser): Promise<string> {
  const storageStatePath = resolveStorageStatePath();
  if (fs.existsSync(storageStatePath)) {
    return storageStatePath;
  }

  if (!config.ui.username || !config.ui.password) {
    throw new Error('UI_USERNAME and UI_PASSWORD must be set to create reusable UI auth state.');
  }

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });

  const context = await browser.newContext({
    baseURL: config.ui.baseUrl,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    LoginPage.bind(page);
    DashboardPage.bind(page);

    await LoginPage.login(config.ui.username, config.ui.password);
    await DashboardPage.waitForReady();
    await context.storageState({ path: storageStatePath });

    logger.info('UI auth storage state created', {
      storageStatePath,
      baseUrl: config.ui.baseUrl,
    });
  } finally {
    LoginPage.clearBinding();
    DashboardPage.clearBinding();
    await context.close();
  }

  return storageStatePath;
}
