import { test as base } from 'playwright-bdd';
import type { TestInfo } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { ApiClient } from '@core/api-client';
import { RabbitClient } from '@messaging/rabbit-client';
import { ConsumerHarness } from '@messaging/consumer-harness';
import { MessagePublisher } from '@messaging/publisher';
import { DLQMonitor } from '@messaging/dlq-monitor';
import { MessageValidator } from '@messaging/message-validator';
import { DatabaseClient } from '@database/db-client';
import { SnapshotManager } from '@database/snapshot-manager';
import { CleanupManager } from '@database/cleanup-manager';
import { GLQueryBuilder } from '@database/query-builder';
import { SchemaValidator } from '@schemas/schema-validator';
import { AIEnricher, formatAnalysisHtml } from '@support/ai-enricher';
import { descriptionHtml as allureDescriptionHtml, label as allureLabel } from 'allure-js-commons';
import { config } from '@core/config';
import { logger } from '@core/logger';

// ─── State interfaces (previously in world.ts) ───────────────────

export interface CurrentRequest {
  method?: string;
  endpoint?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
}

export interface CurrentResponse {
  status?: number;
  body?: Record<string, unknown> | unknown;
  headers?: Record<string, string>;
  duration?: number;
  correlationId?: string;
}

// ─── Fixture types ───────────────────────────────────────────────

export type GLFixtures = {
  // Core HTTP
  apiClient: ApiClient;

  // Mutable per-test state (passed by reference — steps mutate .properties)
  currentRequest: CurrentRequest;
  currentResponse: CurrentResponse;
  testData: Record<string, unknown>;

  // Mutable role wrapper (auth steps set .value)
  activeRole: { value: string };

  // Read-only config
  instanceId: number;

  // Validation
  schemaValidator: SchemaValidator;

  // Messaging (lazy — only initialised when a test uses messaging steps)
  rabbitClient: RabbitClient;
  consumerHarness: ConsumerHarness;
  messagePublisher: MessagePublisher;
  dlqMonitor: DLQMonitor;
  messageValidator: MessageValidator;

  // Database (lazy — only initialised when a test uses database steps)
  dbClient: DatabaseClient;
  snapshotManager: SnapshotManager;
  cleanupManager: CleanupManager;
  queryBuilder: GLQueryBuilder;

  // Helpers
  store: (key: string, value: unknown) => void;
  retrieve: <T = unknown>(key: string) => T;

  // Auto-fixture: attaches req/resp on failure + runs AI analysis
  _afterTestHook: void;
};

// ─── Extended test object ────────────────────────────────────────

export const test = base.extend<GLFixtures>({

  // ── Core ──────────────────────────────────────────────────────

  apiClient: async ({ request }, use: (client: ApiClient) => Promise<void>) => {
    const client = new ApiClient(config.baseUrl);
    await client.init(request);
    await use(client);
    await client.dispose();
  },

  currentRequest: async ({}, use: (r: CurrentRequest) => Promise<void>) => {
    await use({});
  },

  currentResponse: async ({}, use: (r: CurrentResponse) => Promise<void>) => {
    await use({});
  },

  testData: async ({}, use: (d: Record<string, unknown>) => Promise<void>) => {
    await use({});
  },

  activeRole: async ({}, use: (r: { value: string }) => Promise<void>) => {
    await use({ value: 'a valid client' });
  },

  instanceId: async ({}, use: (id: number) => Promise<void>) => {
    await use(config.instanceId);
  },

  schemaValidator: async ({}, use: (v: SchemaValidator) => Promise<void>) => {
    await use(new SchemaValidator());
  },

  // ── Messaging ─────────────────────────────────────────────────

  rabbitClient: async ({}, use: (c: RabbitClient) => Promise<void>) => {
    const client = new RabbitClient();
    await client.connect();
    logger.debug('RabbitMQ connected for messaging scenario');
    await use(client);
    if (client.isConnected()) {
      await client.disconnect();
    }
  },

  consumerHarness: async ({ rabbitClient }, use: (h: ConsumerHarness) => Promise<void>) => {
    const harness = new ConsumerHarness(rabbitClient);
    await use(harness);
    await harness.cleanup();
  },

  messagePublisher: async ({ rabbitClient }, use: (p: MessagePublisher) => Promise<void>) => {
    await use(new MessagePublisher(rabbitClient));
  },

  dlqMonitor: async ({ rabbitClient }, use: (m: DLQMonitor) => Promise<void>) => {
    const monitor = new DLQMonitor(rabbitClient);
    await use(monitor);
    await monitor.cleanup();
  },

  messageValidator: async ({}, use: (v: MessageValidator) => Promise<void>) => {
    await use(new MessageValidator());
  },

  // ── Database ──────────────────────────────────────────────────

  dbClient: async ({}, use: (c: DatabaseClient) => Promise<void>) => {
    const client = new DatabaseClient();
    await client.connect();
    logger.debug('Database connected for DB scenario');
    await use(client);
    if (client.isConnected()) {
      await client.disconnect();
    }
  },

  snapshotManager: async ({}, use: (m: SnapshotManager) => Promise<void>) => {
    await use(new SnapshotManager());
  },

  cleanupManager: async ({ dbClient }, use: (m: CleanupManager) => Promise<void>) => {
    const manager = new CleanupManager();
    await use(manager);
    await manager.cleanup(dbClient);
  },

  queryBuilder: async ({ dbClient }, use: (q: GLQueryBuilder) => Promise<void>) => {
    await use(new GLQueryBuilder(dbClient));
  },

  // ── Helpers ───────────────────────────────────────────────────

  store: async ({ testData }, use: (fn: (key: string, value: unknown) => void) => Promise<void>) => {
    await use((key: string, value: unknown) => {
      testData[key] = value;
    });
  },

  retrieve: async ({ testData }, use: (fn: <T = unknown>(key: string) => T) => Promise<void>) => {
    await use(<T = unknown>(key: string): T => testData[key] as T);
  },

  // ── Auto-fixture: post-test attachment + AI analysis ──────────

  _afterTestHook: [
    async (
      { currentRequest, currentResponse }: { currentRequest: CurrentRequest; currentResponse: CurrentResponse },
      use: () => Promise<void>,
      testInfo: TestInfo,
    ) => {
      await use();

      const status = testInfo.status;
      const logMethod = status === 'passed' ? 'info' : status === 'failed' ? 'error' : 'warn';
      logger.log(logMethod, `Scenario ${status?.toUpperCase()}`, {
        scenario: testInfo.title,
        duration: testInfo.duration ? `${testInfo.duration}ms` : 'N/A',
        tags: testInfo.tags?.join(', '),
      });

      // Attach request/response on failure
      if (status === 'failed' && currentRequest.endpoint) {
        await testInfo.attach('Request/Response', {
          body: JSON.stringify({ request: currentRequest, response: currentResponse }, null, 2),
          contentType: 'application/json',
        });
      }

      // AI failure analysis (optional)
      if (status === 'failed' && process.env.AI_ENABLED === 'true') {
        try {
          const enricher = new AIEnricher();
          const analysis = await enricher.analyzeFailure({
            scenarioName: testInfo.title,
            error: testInfo.errors.map((e) => e.message ?? String(e)).join('\n'),
            request: currentRequest as Record<string, unknown>,
            response: currentResponse as Record<string, unknown>,
            tags: testInfo.tags ?? [],
          });

          // Show AI analysis on the Allure Overview tab
          await allureDescriptionHtml(formatAnalysisHtml(analysis));

          // Map AI severity to Allure severity label
          const severityMap: Record<string, string> = {
            critical: 'critical',
            high: 'blocker',
            medium: 'normal',
            low: 'minor',
          };
          await allureLabel('severity', severityMap[analysis.severity] ?? 'normal');

          // Keep JSON attachment for machine readability
          await testInfo.attach('AI Failure Analysis', {
            body: JSON.stringify(analysis, null, 2),
            contentType: 'application/json',
          });
          logger.info('AI failure analysis attached', { scenario: testInfo.title });
        } catch (error) {
          logger.warn('AI failure analysis failed', { error: (error as Error).message });
        }
      }
    },
    { auto: true },
  ],
});

// ─── Bound step constructors (imported by all step files) ────────

export const { Given, When, Then } = createBdd(test);
