import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { config } from './src/core/shared/config';

const outputDir = defineBddConfig({
  features: 'features/api/**/*.feature',
  steps: ['src/steps/api/**/*.ts', 'src/fixtures/api/index.ts'],
  outputDir: '.features-gen/api',
});

export default defineConfig({
  testDir: outputDir as string,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,

  globalSetup: './src/core/api/global-setup.ts',
  globalTeardown: './src/core/shared/playwright/global-teardown.ts',

  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/playwright-api-report.json' }],
    ['allure-playwright', { resultsDir: 'reports/allure-results' }],
  ],

  use: {
    baseURL: config.api.baseUrl,
    extraHTTPHeaders: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Test-Run-Id': config.gitSha,
      'X-Framework': 'riverty-playwright-bdd',
    },
    ignoreHTTPSErrors: true,
    actionTimeout: config.api.timeout,
    trace: 'on',
  },

  projects: [
    {
      name: 'api',
      grep: /@api\b/,
      grepInvert: /@manual/,
    },
  ],

  workers: process.env.CI ? 2 : undefined,
});
