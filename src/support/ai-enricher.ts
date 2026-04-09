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

      const choice = response.choices[0];
      const text = choice?.message?.content?.trim();
      if (!text) {
        const finishReason = choice?.finish_reason ?? 'unknown';
        const usage = response.usage;
        logger.error('Azure OpenAI returned empty content', { finishReason, usage });
        throw new Error(
          `Azure OpenAI returned empty content (finish_reason=${finishReason}, prompt_tokens=${usage?.prompt_tokens ?? '?'}, completion_tokens=${usage?.completion_tokens ?? '?'}). ` +
            `Try increasing AI_MAX_TOKENS (current: ${config.ai.maxTokens}).`,
        );
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

    const prompt = `You are a BDD expert generating Gherkin feature files for the Testonaut GL (General Ledger) API test automation framework.

────────────────────────────────────────────────────
TASK
────────────────────────────────────────────────────
TICKET:               ${ticketSummary}
ACCEPTANCE CRITERIA:  ${acceptanceCriteria}
API ENDPOINT:         ${apiEndpoint}
EXTRA CONTEXT:        ${existingPatterns || 'None provided'}

────────────────────────────────────────────────────
STRICT RULES — follow every rule exactly
────────────────────────────────────────────────────

## 1. Feature file structure

\`\`\`gherkin
@<domain>
Feature: <Domain> — <Short subtitle>
  As a user of the GL API
  I should be able to <what the feature enables>

  Background:
    Given I am authenticated as "a valid client"
\`\`\`
- Use only ONE domain tag before the Feature keyword. Domain tag also appears on every Scenario/Scenario Outline.
- Security feature files have NO Background (authentication is what is being tested).
- Feature title format: "Domain — Subtitle". Examples: "Balance — Account Balance Filters", "Transactions — Date Range Queries".

## 2. Named-request pattern (MANDATORY for all domain scenarios)

Every scenario MUST follow this exact 3-step pattern:
\`\`\`gherkin
When I define a GET "balance request"         # or POST / PUT etc.
And I set balance request parameters:          # optional — only when params needed
  | param1    | param2    |
  | value1    | value2    |
And I set "instanceId" to "2001"              # single param override (optional)
Then I send the balance request to the API
And I get the response code of OK
\`\`\`
- NEVER use \`When I send a GET request to "..."\` for domain scenarios. That pattern is for security tests only.
- Request template names are lowercase with spaces: "balance request", "client balance request", "accounts request", etc.
- Derive the request template name from the endpoint. For \`/\${'{instanceId}'}/balance\` use "balance request".
- Use \`I set <domain> request parameters:\` with a DataTable (1 header row + 1 data row) for query parameters.
- Use \`I set "fieldName" to "value"\` only for single param overrides like instanceId.

## 3. Response status codes — labels only, NEVER numbers

Allowed labels: OK, Created, Accepted, NoContent, BadRequest, Unauthorized, Forbidden, NotFound, Conflict, UnprocessableEntity, InternalServerError
- \`I get the response code of OK\` ✅
- \`the response status should be 200\` ❌ FORBIDDEN

## 4. Array response validation — always two separate steps

\`\`\`gherkin
And the response should be an array of <entities>       # domain step: proves non-empty
And each item in the response array should match schema "<schema-name>"   # schema contract
\`\`\`
- Schema names are kebab-case: "gl-account-balance", "gl-transaction", "instance", "gl-error".
- Error responses always use: \`the response should match schema "gl-error"\`
- Never combine array check + schema validation into one step.

## 5. Scenario Outline for multi-value testing

Use Scenario Outline + Examples tables when testing the same flow across multiple values (multiple instanceIds, multiple filter values, etc.):
\`\`\`gherkin
@<domain> @smoke
Scenario Outline: I should be able to get <X> for a given instance
  When I define a GET "<X> request"
  And I set "instanceId" to "<instanceId>"
  Then I send the <X> request to the API
  And I get the response code of OK
  And the response should be an array of <X>
  And each item in the response array should match schema "<schema-name>"

  Examples:
    | instanceId |
    | 2001       |
    | 2002       |
\`\`\`

## 6. Standardised unconventional input Outline

Every domain that accepts an ID or numeric path parameter MUST include this exact pattern for each such parameter:
\`\`\`gherkin
@<domain>
Scenario Outline: <METHOD> <endpoint> with unconventional <param> values
  When I define a <METHOD> "<X> request"
  And I set "<param>" to "<value>"
  Then I send the <X> request to the API
  And the response status should be BadRequest or NotFound

  Examples:
    | value |
    | null  |
    | abc   |
    | 1.5   |
    | @!$   |

  @fixme
  Examples:
    | value |
    | -1    |
\`\`\`
- The \`@fixme\` Examples block for -1 is a known pattern — negative integers often return 500 instead of 400.
- \`the response status should be BadRequest or NotFound\` — this exact step (not an assertion with code numbers).

## 7. @fixme tag

Use \`@fixme\` on scenarios or Examples blocks where the API is known to behave incorrectly (e.g., returns 500 instead of 400). Always add an inline comment explaining the bug:
\`\`\`gherkin
@<domain> @fixme # The API responds with 500 instead of 400 — needs investigation
Scenario: Verify behavior with invalid instanceId
\`\`\`

## 8. Count comparison pattern for filter coverage

When testing that a filter reduces a result set, use the stored count pattern:
\`\`\`gherkin
When I define a GET "<X> request"
And I send the <X> request to the API
And I get the response code of OK
And I store the <X> count as "totalCount"

When I define a GET "<X> request"
And I set <X> request parameters:
  | filterParam |
  | someValue   |
And I send the <X> request to the API
And I get the response code of OK
And I store the <X> count as "filteredCount"

Then the stored count "filteredCount" should be less than "totalCount"
And each item in the response array should match schema "<schema-name>"
\`\`\`

## 9. Section separator comments

Group related scenarios with section separator comments:
\`\`\`gherkin
  # ── Happy Path ────────────────────────────────────────────────────────────────
  # These tests verify the core functionality with valid inputs.

  # ── Negative & Validation Scenarios ──────────────────────────────────────────
  # These tests verify proper error handling.

  # ── Unconventional Input Tests ────────────────────────────────────────────────
  # These tests send values of the wrong type or semantically invalid values.
\`\`\`

## 10. Closing swagger schema gaps comment block

End every feature file with a comment block documenting known swagger/documentation gaps. If none are known, write:
\`\`\`gherkin
  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # No schema gaps identified for this endpoint.
\`\`\`

## 11. Tags

- Every Scenario/Scenario Outline MUST have the \`@<domain>\` tag.
- Add \`@smoke\` to the one or two most important happy-path scenarios.
- Add \`@schema\` to scenarios that explicitly assert schema conformance.
- Do NOT use \`@regression\`, \`@negative\`, \`@critical\` — these are not in the existing framework.
- Tags go on the line immediately before the Scenario keyword, with no blank line between tag and scenario.

## 12. Comments and TODOs

Use inline \`#TODO:\` comments for known improvements or missing verifications:
\`\`\`gherkin
#TODO: Add verification for sort order once stable test data is available.
\`\`\`

────────────────────────────────────────────────────
RESPONSE FORMAT
────────────────────────────────────────────────────
Respond ONLY with a JSON object — no markdown fences, no extra text:
{
  "featureContent": "The complete .feature file content as a string with \\n for newlines",
  "suggestedTags": ["list", "of", "cross-cutting", "tags", "used"],
  "coverageAnalysis": "2-3 sentence analysis: what is covered, what is intentionally excluded, any known gaps"
}`;

    const text = await this.runPrompt(prompt);

    // Strip markdown fences if model wrapped response anyway
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      return JSON.parse(cleaned) as GeneratedFeature;
    } catch {
      return {
        featureContent: cleaned,
        suggestedTags: [],
        coverageAnalysis: 'AI returned unstructured content — review and parse manually.',
      };
    }
  }
}

// CLI entrypoint
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');

  const args = process.argv.slice(2);
  const action = args[0];

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  }

  if (action === 'generate') {
    const ticket = getArg('--ticket');
    const ac = getArg('--ac');
    const endpoint = getArg('--endpoint');
    const domain = getArg('--domain');
    const outFile = getArg('--out');
    const patterns = getArg('--patterns');

    if (!ticket || !ac || !endpoint) {
      console.error([
        '',
        'Usage: npm run ai:generate -- \\',
        '  --ticket   "GL-123: Add balance filter by date range" \\',
        '  --ac       "User can filter balance by fromDate and toDate" \\',
        '  --endpoint "/{instanceId}/balance" \\',
        '  [--domain  balance]                    # auto-save to features/<domain>/',
        '  [--out     date-filter.feature]        # custom filename (default: derived from ticket)',
        '  [--patterns "existing step patterns"]  # optional context for the AI',
        '',
      ].join('\n'));
      process.exit(1);
    }

    console.log('\n🤖 Generating BDD scenarios via AI...\n');

    const enricher = new AIEnricher();
    enricher.generateScenariosFromTicket(ticket, ac, endpoint, patterns)
      .then((result) => {
        console.log('=== Coverage Analysis ===');
        console.log(result.coverageAnalysis);
        console.log('\n=== Suggested Tags ===');
        console.log(result.suggestedTags.join(', '));

        const featureFileName = outFile
          ? (outFile.endsWith('.feature') ? outFile : `${outFile}.feature`)
          : `${ticket.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60)}.feature`;

        if (domain) {
          const outputPath = path.join('features', domain, featureFileName);
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, result.featureContent, 'utf-8');
          console.log(`\n✅ Feature file written to: ${outputPath}`);
          console.log('   Run `npm run bdd:gen` to compile it into a Playwright spec.');
        } else {
          console.log('\n=== Generated Feature File ===');
          console.log(result.featureContent);
          console.log('\n💡 Tip: add --domain <name> to auto-save to features/<domain>/');
        }
      })
      .catch((err: Error) => {
        console.error('\n❌ AI scenario generation failed:', err.message);
        process.exit(1);
      });
  } else {
    console.log([
      '',
      'Testonaut AI CLI',
      '================',
      '',
      '  generate   Generate BDD scenarios from a ticket',
      '             npm run ai:generate -- --ticket "..." --ac "..." --endpoint "..."',
      '',
    ].join('\n'));
  }
}

const severityColors: Record<string, string> = {
  critical: '#d32f2f',
  high: '#f57c00',
  medium: '#fbc02d',
  low: '#388e3c',
};

const severityEmoji: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatAnalysisHtml(analysis: FailureAnalysis): string {
  const sev = analysis.severity;
  const color = severityColors[sev] || '#666';
  const emoji = severityEmoji[sev] || '⚪';
  const patterns = analysis.relatedPatterns?.length
    ? `<ul>${analysis.relatedPatterns.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
    : '<em>None identified</em>';

  return `
<h2>🤖 AI Failure Analysis</h2>
<table>
  <tr>
    <th style="text-align:left;padding:6px 12px;width:160px">Severity</th>
    <td style="padding:6px 12px"><strong style="color:${color}">${emoji} ${escapeHtml(sev.toUpperCase())}</strong></td>
  </tr>
  <tr>
    <th style="text-align:left;padding:6px 12px">Summary</th>
    <td style="padding:6px 12px">${escapeHtml(analysis.summary)}</td>
  </tr>
  <tr>
    <th style="text-align:left;padding:6px 12px">Root Cause</th>
    <td style="padding:6px 12px">${escapeHtml(analysis.probableCause)}</td>
  </tr>
  <tr>
    <th style="text-align:left;padding:6px 12px">Impact</th>
    <td style="padding:6px 12px">${escapeHtml(analysis.impactAssessment)}</td>
  </tr>
  <tr>
    <th style="text-align:left;padding:6px 12px">Suggested Fix</th>
    <td style="padding:6px 12px">${escapeHtml(analysis.suggestedFix)}</td>
  </tr>
  <tr>
    <th style="text-align:left;padding:6px 12px;vertical-align:top">Related Patterns</th>
    <td style="padding:6px 12px">${patterns}</td>
  </tr>
</table>`.trim();
}
