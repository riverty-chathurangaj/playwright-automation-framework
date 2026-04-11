import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../core/config';
import { logger } from '../core/logger';

interface PlaywrightStep {
  title: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  steps?: PlaywrightStep[];
}

interface PlaywrightResult {
  status?: string;
  duration?: number;
  retry?: number;
  error?: { message?: string; stack?: string };
  errors?: Array<{ message?: string; stack?: string }>;
  steps?: PlaywrightStep[];
}

interface PlaywrightTest {
  projectName?: string;
  results?: PlaywrightResult[];
  status?: string;
}

interface PlaywrightSpec {
  title: string;
  tags?: string[];
  tests?: PlaywrightTest[];
}

interface PlaywrightSuite {
  title: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightJsonReport {
  suites?: PlaywrightSuite[];
}

interface XrayStepResult {
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  comment: string;
  actualResult: string;
}

interface XrayTestResult {
  testKey: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  comment: string;
  steps: XrayStepResult[];
}

export class XrayReporter {
  private xrayToken?: string;
  private executionStartTime: string = new Date().toISOString();

  async authenticate(): Promise<string> {
    if (this.xrayToken) return this.xrayToken;

    if (!config.xray.clientId || !config.xray.clientSecret) {
      throw new Error('XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set to publish to Xray');
    }

    const response = await axios.post(
      `${config.xray.baseUrl}/api/v2/authenticate`,
      {
        client_id: config.xray.clientId,
        client_secret: config.xray.clientSecret,
      },
      { headers: { 'Content-Type': 'application/json' } },
    );

    this.xrayToken = response.data as string;
    return this.xrayToken;
  }

  extractXrayKey(tags: string[] = []): string | undefined {
    const tag = tags.find((value) => /^@?XRAY-/.test(value));
    return tag?.replace(/^@?XRAY-/, '');
  }

  private mapStatus(status?: string): 'PASSED' | 'FAILED' | 'SKIPPED' {
    switch (status) {
      case 'passed':
        return 'PASSED';
      case 'skipped':
        return 'SKIPPED';
      default:
        return 'FAILED';
    }
  }

  private getLatestResult(test: PlaywrightTest): PlaywrightResult | undefined {
    const results = test.results ?? [];
    if (results.length === 0) {
      return undefined;
    }
    return results[results.length - 1];
  }

  private flattenSteps(steps: PlaywrightStep[] = []): PlaywrightStep[] {
    const flattened: PlaywrightStep[] = [];

    for (const step of steps) {
      if (step.steps?.length) {
        flattened.push(...this.flattenSteps(step.steps));
        continue;
      }

      flattened.push(step);
    }

    return flattened;
  }

  private buildComment(spec: PlaywrightSpec, test: PlaywrightTest): string {
    const latest = this.getLatestResult(test);
    const errorMessages = [
      ...(latest?.errors ?? []).map((error) => error.message || error.stack || '').filter(Boolean),
      latest?.error?.message || latest?.error?.stack || '',
    ].filter(Boolean);

    if (errorMessages.length === 0) {
      return `${spec.title}${test.projectName ? ` [${test.projectName}]` : ''}`;
    }

    return `${spec.title}${test.projectName ? ` [${test.projectName}]` : ''}\n${errorMessages.join('\n')}`;
  }

  private buildSteps(test: PlaywrightTest): XrayStepResult[] {
    const latest = this.getLatestResult(test);
    const flattenedSteps = this.flattenSteps(latest?.steps);

    if (flattenedSteps.length === 0) {
      return [
        {
          status: this.mapStatus(test.status ?? latest?.status),
          comment: latest?.error?.message || '',
          actualResult: latest?.duration !== undefined ? `${Math.round(latest.duration)}ms` : '',
        },
      ];
    }

    return flattenedSteps.map((step) => ({
      status: this.mapStatus(step.error ? 'failed' : latest?.status),
      comment: step.error?.message || step.error?.stack || '',
      actualResult: step.duration !== undefined ? `${Math.round(step.duration)}ms` : '',
    }));
  }

  private collectTests(suites: PlaywrightSuite[] = []): XrayTestResult[] {
    const collected: XrayTestResult[] = [];

    const walk = (suite: PlaywrightSuite): void => {
      for (const spec of suite.specs ?? []) {
        const testKey = this.extractXrayKey(spec.tags);
        if (!testKey) {
          continue;
        }

        for (const test of spec.tests ?? []) {
          const latest = this.getLatestResult(test);
          const status = this.mapStatus(test.status ?? latest?.status);

          collected.push({
            testKey,
            status,
            comment: this.buildComment(spec, test),
            steps: this.buildSteps(test),
          });
        }
      }

      for (const child of suite.suites ?? []) {
        walk(child);
      }
    };

    for (const suite of suites) {
      walk(suite);
    }

    return collected;
  }

  async publishResults(reportPath?: string): Promise<void> {
    const playwrightReportPath = reportPath || path.resolve(process.cwd(), 'reports/playwright-report.json');

    if (!fs.existsSync(playwrightReportPath)) {
      logger.warn('Playwright report not found — skipping Xray publish', { path: playwrightReportPath });
      return;
    }

    const playwrightReport: PlaywrightJsonReport = JSON.parse(fs.readFileSync(playwrightReportPath, 'utf-8'));
    const tests = this.collectTests(playwrightReport.suites);

    if (tests.length === 0) {
      logger.info('No XRAY-tagged scenarios found in Playwright report — skipping Xray publish');
      return;
    }

    const token = await this.authenticate();
    const payload = {
      testExecutionKey: config.xray.executionKey || undefined,
      info: {
        summary: `GL API Tests - ${config.env} - ${new Date().toISOString().split('T')[0]}`,
        description: `Automated Playwright BDD execution via pw-testforge-gls | Filter: ${process.env.PLAYWRIGHT_GREP || 'all'} | Build: ${config.gitSha}`,
        startDate: this.executionStartTime,
        finishDate: new Date().toISOString(),
        testEnvironments: [config.env],
        revision: config.gitSha,
      },
      tests,
    };

    try {
      const response = await axios.post(`${config.xray.baseUrl}/api/v2/import/execution/cucumber`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('Results published to Xray', {
        executionKey: response.data?.key,
        testCount: tests.length,
      });
    } catch (error) {
      logger.error('Failed to publish to Xray', { error: (error as Error).message });
      throw error;
    }
  }
}

if (require.main === module) {
  const action = process.argv[2];
  if (action === 'publish') {
    new XrayReporter()
      .publishResults()
      .then(() => logger.info('Xray publish complete'))
      .catch((err) => {
        logger.error('Xray publish failed', { err });
        process.exit(1);
      });
  }
}
