# Scenario Generator Prompt

## Purpose
Generate a complete `.feature` file from a Jira ticket for the GL API test framework.
This prompt is used by `src/support/ai-enricher.ts → generateScenariosFromTicket()`.

## CLI usage
```bash
npm run ai:generate -- \
  --ticket   "GL-456: Filter balance by currency" \
  --ac       "API supports filtering by currency code; returns 400 for invalid codes" \
  --endpoint "/{instanceId}/balance" \
  --domain   balance \
  --out      balance-currency-filter.feature
```
Omit `--domain` to print to stdout instead of writing a file.

## Input Variables
- `{{ticketSummary}}` — Jira story/bug title
- `{{acceptanceCriteria}}` — AC text from the ticket
- `{{apiEndpoint}}` — Target API endpoint path
- `{{existingPatterns}}` — Optional: extra context / known step names

## Key rules enforced by the prompt
1. `@<domain>` tag before Feature keyword; repeated on every Scenario
2. Feature title format: `Domain — Subtitle`
3. Background: `Given I am authenticated as "a valid client"` (except security features)
4. **Named-request pattern** — mandatory for all domain scenarios:
   ```gherkin
   When I define a GET "balance request"
   And I set balance request parameters:
     | param1 | param2 |
     | value1 | value2 |
   Then I send the balance request to the API
   And I get the response code of OK
   ```
5. Status labels only — `OK`, `BadRequest`, `NotFound` — never raw numbers
6. Two-step array validation: domain step (non-empty) + `each item ... should match schema "x"`
7. Scenario Outline + Examples for multi-value tests
8. Standardised unconventional input Outline (`null/abc/1.5/@!$` + `@fixme` block for `-1`)
9. `@smoke` on 1–2 critical happy-path scenarios; `@schema` on schema-validation scenarios
10. Section separator comments (`# ── Happy Path ──────...`)
11. Closing `# ── Swagger schema gaps ──` comment block

## Output format
JSON (no markdown fences):
```json
{
  "featureContent": "Full .feature file content with \\n for newlines",
  "suggestedTags": ["smoke", "schema"],
  "coverageAnalysis": "2-3 sentence coverage summary"
}
```
