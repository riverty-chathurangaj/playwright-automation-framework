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
  retries: 1,

  globalSetup: './src/support/global-setup.ts',
  globalTeardown: './src/support/global-teardown.ts',

  reporter: [
    ['list'],
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

  // Domain projects only — each feature has exactly one domain tag, so no overlap.
  // Cross-cutting tags (@smoke, @regression, etc.) are filtered via --grep at CLI level.
  projects: [
    {
      name: 'clients',
      grep: /@clients\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'accounts',
      grep: /@accounts\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'balance',
      grep: /@balance\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'transactions',
      grep: /@transactions\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'instances',
      grep: /@instances\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'accounting-month',
      grep: /@accounting-month\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'postings',
      grep: /@postings\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'messaging',
      grep: /@messaging\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'security',
      grep: /@security\b/,
      grepInvert: /@manual/,
    },
    {
      name: 'report',
      grep: /@report\b/,
      grepInvert: /@manual/,
    },
  ],

  // Worker counts controlled at CLI or globally — messaging sequential by default
  workers: process.env.CI ? 2 : undefined,
});
