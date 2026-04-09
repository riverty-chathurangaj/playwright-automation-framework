import Anthropic from '@anthropic-ai/sdk';
import OpenAI, { AzureOpenAI } from 'openai';
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
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private azureOpenaiClient?: AzureOpenAI;

  constructor() {
    if (config.ai.provider === 'anthropic') {
      if (!config.ai.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY must be set to use Anthropic AI enrichment');
      }
      this.anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });
      return;
    }

    if (config.ai.provider === 'azure-openai') {
      if (!config.ai.openaiApiKey) {
        throw new Error('OPENAI_API_KEY must be set to use Azure OpenAI AI enrichment');
      }
      if (!config.ai.openaiEndpoint) {
        throw new Error('OPENAI_ENDPOINT must be set to use Azure OpenAI AI enrichment');
      }
      this.azureOpenaiClient = new AzureOpenAI({
        endpoint: config.ai.openaiEndpoint,
        apiKey: config.ai.openaiApiKey,
        apiVersion: config.ai.openaiApiVersion,
      });
      return;
    }

    if (!config.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY must be set to use OpenAI AI enrichment');
    }
    this.openaiClient = new OpenAI({ apiKey: config.ai.openaiApiKey });
  }

  private async runPrompt(prompt: string): Promise<string> {
    if (config.ai.provider === 'anthropic') {
      const response = await this.anthropicClient!.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected Anthropic response type');
      }
      return content.text;
    }

    if (config.ai.provider === 'azure-openai') {
      const response = await this.azureOpenaiClient!.chat.completions.create({
        model: config.ai.model,
        max_completion_tokens: config.ai.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new Error('Unexpected Azure OpenAI response payload');
      }
      return text;
    }

    const response = await this.openaiClient!.responses.create({
      model: config.ai.model,
      input: prompt,
      max_output_tokens: config.ai.maxTokens,
    });

    const text = response.output_text?.trim();
    if (!text) {
      throw new Error('Unexpected OpenAI response payload');
    }
    return text;
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

    const text = await this.runPrompt(prompt);

    try {
      return JSON.parse(text) as FailureAnalysis;
    } catch {
      // If JSON parse fails, return a structured fallback
      return {
        summary: 'AI analysis could not parse structured response',
        probableCause: text.substring(0, 500),
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

    const text = await this.runPrompt(prompt);
    return JSON.parse(text) as GeneratedFeature;
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
