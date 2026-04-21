import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { config } from './src/core/shared/config';

const outputDir = defineBddConfig({
  features: 'features/ui/**/*.feature',
  steps: ['src/steps/ui/**/*.ts', 'src/fixtures/ui/index.ts'],
  outputDir: '.features-gen/ui',
});

export default defineConfig({
  testDir: outputDir as string,
  timeout: 90_000,
  expect: { timeout: config.ui.defaultTimeout },
  retries: 1,

  globalSetup: './src/core/ui/global-setup.ts',
  globalTeardown: './src/core/shared/playwright/global-teardown.ts',

  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/playwright-ui-report.json' }],
    ['allure-playwright', { resultsDir: 'reports/allure-results' }],
  ],

  use: {
    baseURL: config.ui.baseUrl,
    ignoreHTTPSErrors: true,
    actionTimeout: config.ui.defaultTimeout,
    trace: 'on',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'ui',
      grep: /@ui\b/,
      grepInvert: /@manual/,
    },
  ],

  workers: process.env.CI ? 2 : undefined,
});
