import Anthropic from '@anthropic-ai/sdk';
import { config } from '../core/config';
import { logger } from '../core/logger';

export interface FailureContext {
  scenarioName: string;
  error: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  tags?: string[];
}

export interface FailureAnalysis {
  summary: string;
  probableCause: string;
  impactAssessment: string;
  suggestedFix: string;
  relatedPatterns: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface GeneratedFeature {
  featureContent: string;
  suggestedTags: string[];
  coverageAnalysis: string;
}

export class AIEnricher {
  private client: Anthropic;

  constructor() {
    if (!config.ai.apiKey) {
      throw new Error('ANTHROPIC_API_KEY must be set to use AI enrichment');
    }
    this.client = new Anthropic({ apiKey: config.ai.apiKey });
  }

  async analyzeFailure(context: FailureContext): Promise<FailureAnalysis> {
    logger.debug('Running AI failure analysis', { scenario: context.scenarioName });

    const prompt = `You are a test automation expert analyzing a failing API test for a financial GL (General Ledger) Service.

FAILED SCENARIO: ${context.scenarioName}
TAGS: ${context.tags?.join(', ') || 'none'}
ERROR: ${context.error}
REQUEST: ${JSON.stringify(context.request, null, 2)}
RESPONSE: ${JSON.stringify(context.response, null, 2)}

Analyze this failure and provide:
1. A one-line summary
2. The probable root cause (API bug, test data issue, environment issue, schema change, etc.)
3. Impact assessment (what downstream consumers or systems may be affected)
4. A specific suggested fix
5. Any related patterns that might indicate a wider issue
6. Severity: critical/high/medium/low

Respond ONLY with a JSON object matching this structure:
{
  "summary": "string",
  "probableCause": "string",
  "impactAssessment": "string",
  "suggestedFix": "string",
  "relatedPatterns": ["string"],
  "severity": "critical|high|medium|low"
}`;

    const response = await this.client.messages.create({
      model: config.ai.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected AI response type');
    }

    try {
      return JSON.parse(content.text) as FailureAnalysis;
    } catch {
      // If JSON parse fails, return a structured fallback
      return {
        summary: 'AI analysis could not parse structured response',
        probableCause: content.text.substring(0, 500),
        impactAssessment: 'Unknown',
        suggestedFix: 'Review error details manually',
        relatedPatterns: [],
        severity: 'medium',
      };
    }
  }

  async generateScenariosFromTicket(
    ticketSummary: string,
    acceptanceCriteria: string,
    apiEndpoint: string,
    existingPatterns: string = '',
  ): Promise<GeneratedFeature> {
    logger.info('Generating BDD scenarios from ticket', { ticketSummary });

    const prompt = `You are a BDD expert generating Gherkin test scenarios for a financial GL (General Ledger) API.

TICKET: ${ticketSummary}
ACCEPTANCE CRITERIA: ${acceptanceCriteria}
API ENDPOINT: ${apiEndpoint}
EXISTING PATTERNS: ${existingPatterns || 'None provided'}

Generate comprehensive Gherkin scenarios including:
- Happy path scenarios
- Negative/validation scenarios
- Edge cases specific to financial data (decimal precision, currency codes, date boundaries)
- Use appropriate tags: @smoke, @regression, @negative, @schema, @critical

Respond with JSON:
{
  "featureContent": "Feature file content as a string",
  "suggestedTags": ["tag1", "tag2"],
  "coverageAnalysis": "Brief analysis of coverage gaps"
}`;

    const response = await this.client.messages.create({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected AI response');

    return JSON.parse(content.text) as GeneratedFeature;
  }
}

// CLI entrypoint
if (require.main === module) {
  const action = process.argv[2];

  if (action === 'analyze-failures') {
    logger.info('AI failure analysis mode — run after test execution for offline analysis');
  } else if (action === 'generate') {
    logger.info('AI scenario generation mode');
    logger.info('Usage: ts-node src/support/ai-enricher.ts generate "Ticket summary" "AC" "/endpoint"');
  }
}
