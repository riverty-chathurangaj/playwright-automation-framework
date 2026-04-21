import { createBdd, test as base } from 'playwright-bdd';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { config } from '@shared-core/config';
import { logger } from '@shared-core/logger';
import { DashboardPage } from '@ui-pages/gl/dashboard.page';
import { LoginPage } from '@ui-pages/gl/login.page';
import { ensureUiAuthStorageState } from '@ui-core/auth-state';

export type UIFixtures = {
  context: BrowserContext;
  page: Page;
  _bindPages: void;
  _afterUiTestHook: void;
};

function scenarioRequiresUiAuth(testInfo: TestInfo): boolean {
  return (testInfo.tags ?? []).includes('@authenticated');
}

export const test = base.extend<UIFixtures>({
  context: async ({ browser }, use: (context: BrowserContext) => Promise<void>, testInfo: TestInfo) => {
    const storageState = scenarioRequiresUiAuth(testInfo) ? await ensureUiAuthStorageState(browser) : undefined;

    const context = await browser.newContext({
      baseURL: config.ui.baseUrl,
      ignoreHTTPSErrors: true,
      storageState,
    });

    await use(context);
    await context.close();
  },

  page: async ({ context }, use: (page: Page) => Promise<void>) => {
    const page = await context.newPage();
    await use(page);
  },

  _bindPages: [
    async ({ page }, use: () => Promise<void>) => {
      LoginPage.bind(page);
      DashboardPage.bind(page);

      await use();

      LoginPage.clearBinding();
      DashboardPage.clearBinding();
    },
    { auto: true },
  ],

  _afterUiTestHook: [
    async ({ page }: { page: Page }, use: () => Promise<void>, testInfo: TestInfo) => {
      await use();

      const status = testInfo.status;
      const logMethod = status === 'passed' ? 'info' : status === 'failed' ? 'error' : 'warn';
      logger.log(logMethod, `UI scenario ${status?.toUpperCase()}`, {
        scenario: testInfo.title,
        duration: testInfo.duration ? `${testInfo.duration}ms` : 'N/A',
        tags: testInfo.tags?.join(', '),
      });

      if (status === 'failed') {
        await testInfo.attach('UI Screenshot', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }
    },
    { auto: true },
  ],
});

export const { Given, When, Then } = createBdd(test);
