import { createBdd, test as base } from 'playwright-bdd';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { config } from '@shared-core/config';
import { logger } from '@shared-core/logger';
import { SauceDemoCartPage } from '@ui-pages/saucedemo/cart.page';
import { SauceDemoInventoryPage } from '@ui-pages/saucedemo/inventory.page';
import { SauceDemoLoginPage } from '@ui-pages/saucedemo/login.page';

export type UIFixtures = {
  context: BrowserContext;
  page: Page;
  _bindPages: void;
  _afterUiTestHook: void;
};

export const test = base.extend<UIFixtures>({
  context: async ({ browser }, use: (context: BrowserContext) => Promise<void>) => {
    const context = await browser.newContext({
      baseURL: config.ui.baseUrl,
      ignoreHTTPSErrors: true,
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
      SauceDemoLoginPage.bind(page);
      SauceDemoInventoryPage.bind(page);
      SauceDemoCartPage.bind(page);

      await use();

      SauceDemoLoginPage.clearBinding();
      SauceDemoInventoryPage.clearBinding();
      SauceDemoCartPage.clearBinding();
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
