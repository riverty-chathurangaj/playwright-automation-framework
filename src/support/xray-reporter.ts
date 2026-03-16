import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../core/config';
import { logger } from '../core/logger';

interface CucumberStep {
  keyword: string;
  name: string;
  result: { status: string; duration?: number; error_message?: string };
}

interface CucumberElement {
  name: string;
  tags: Array<{ name: string }>;
  steps: CucumberStep[];
  type: string;
}

interface CucumberFeature {
  name: string;
  elements: CucumberElement[];
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

  extractXrayKey(tags: Array<{ name: string }>): string | undefined {
    const tag = tags.find(t => t.name.match(/^@XRAY-/));
    return tag?.name.replace('@XRAY-', '');
  }

  mapStatus(scenario: CucumberElement): string {
    const allPassed = scenario.steps.every(s => s.result.status === 'passed');
    const anyFailed = scenario.steps.some(s => s.result.status === 'failed');
    const anySkipped = scenario.steps.some(s => s.result.status === 'skipped');

    if (allPassed) return 'PASSED';
    if (anyFailed) return 'FAILED';
    if (anySkipped) return 'SKIPPED';
    return 'TODO';
  }

  async publishResults(reportPath?: string): Promise<void> {
    const cucumberReportPath = reportPath || path.resolve(process.cwd(), 'reports/cucumber-report.json');

    if (!fs.existsSync(cucumberReportPath)) {
      logger.warn('Cucumber report not found — skipping Xray publish', { path: cucumberReportPath });
      return;
    }

    const cucumberReport: CucumberFeature[] = JSON.parse(fs.readFileSync(cucumberReportPath, 'utf-8'));
    const token = await this.authenticate();

    const tests = cucumberReport.flatMap(feature =>
      feature.elements
        .filter(el => el.type === 'scenario')
        .map(scenario => {
          const testKey = this.extractXrayKey(scenario.tags);
          return {
            testKey,
            status: this.mapStatus(scenario),
            comment: '',
            steps: scenario.steps.map(step => ({
              status: step.result.status === 'passed' ? 'PASSED' : step.result.status === 'failed' ? 'FAILED' : 'SKIPPED',
              comment: step.result.error_message || '',
              actualResult: step.result.duration ? `${Math.round(step.result.duration / 1_000_000)}ms` : '',
            })),
          };
        })
        .filter(t => t.testKey), // Only include scenarios with @XRAY- tag
    );

    if (tests.length === 0) {
      logger.info('No XRAY-tagged scenarios found — skipping Xray publish');
      return;
    }

    const payload = {
      testExecutionKey: config.xray.executionKey || undefined,
      info: {
        summary: `GL API Tests - ${config.env} - ${new Date().toISOString().split('T')[0]}`,
        description: `Automated BDD execution via Testonaut GL | Tags: ${process.env.CUCUMBER_TAGS || 'all'} | Build: ${config.gitSha}`,
        startDate: this.executionStartTime,
        finishDate: new Date().toISOString(),
        testEnvironments: [config.env],
        revision: config.gitSha,
      },
      tests,
    };

    try {
      const response = await axios.post(
        `${config.xray.baseUrl}/api/v2/import/execution/cucumber`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

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

// CLI entrypoint: ts-node src/support/xray-reporter.ts publish
if (require.main === module) {
  const action = process.argv[2];
  if (action === 'publish') {
    new XrayReporter().publishResults()
      .then(() => logger.info('Xray publish complete'))
      .catch(err => { logger.error('Xray publish failed', { err }); process.exit(1); });
  }
}
