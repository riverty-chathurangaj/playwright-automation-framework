import * as dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

dotenv.config();

// ─── BDD feature/step wiring ─────────────────────────────────────
// In playwright-bdd v8, defineBddConfig() returns the outputDir string

const outputDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: [
    'src/steps/**/*.ts',
    'src/fixtures/index.ts',
  ],
  outputDir: '.features-gen',
});

// ─── Playwright config ───────────────────────────────────────────

export default defineConfig({
  testDir: outputDir as string,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  globalSetup: './src/support/global-setup.ts',
  globalTeardown: './src/support/global-teardown.ts',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-report.json' }],
    ['allure-playwright', { resultsDir: 'reports/allure-results' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Test-Run-Id': process.env.GIT_SHA || `local-${Date.now()}`,
      'X-Framework': 'testonaut-gl',
    },
    ignoreHTTPSErrors: true,
    actionTimeout: Number(process.env.API_TIMEOUT) || 30_000,
    trace: 'on'
  },

  // ─── Projects mirror Cucumber profiles ────────────────────────

  projects: [
    {
      name: 'smoke',
      grep: /@smoke/,
      grepInvert: /@manual/,
    },
    {
      name: 'regression',
      grep: /@regression/,
      grepInvert: /@manual/,
    },
    {
      name: 'negative',
      grep: /@negative/,
      grepInvert: /@manual/,
    },
    {
      name: 'schema',
      grep: /@schema/,
      grepInvert: /@manual/,
    },
    {
      name: 'security',
      grep: /@security/,
      grepInvert: /@manual/,
    },
    {
      name: 'transactions',
      grep: /@transactions/,
      grepInvert: /@manual/,
    },
    {
      name: 'messaging',
      grep: /@messaging/,
      grepInvert: /@manual/,
    },
    {
      name: 'accounts',
      grep: /@accounts/,
      grepInvert: /@manual/,
    },
    {
      name: 'clients',
      grep: /@clients/,
      grepInvert: /@manual/,
    },
    {
      name: 'balance',
      grep: /@balance/,
      grepInvert: /@manual/,
    },
    {
      name: 'default',
      grepInvert: /@manual/,
    },
  ],

  // Worker counts controlled at CLI or globally — messaging sequential by default
  workers: process.env.CI ? 2 : undefined,
});
