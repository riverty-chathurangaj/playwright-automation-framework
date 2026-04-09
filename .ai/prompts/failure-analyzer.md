# Failure Analyzer Prompt

## Purpose
Analyze a failing GL API test and return a structured root cause assessment.
This prompt is used by `src/support/ai-enricher.ts → analyzeFailure()`.

## Input Variables
- `{{scenarioName}}` — Gherkin scenario title
- `{{tags}}` — Scenario tags (e.g. @balance @smoke)
- `{{error}}` — Assertion error message
- `{{request}}` — HTTP request (method, URL, headers, body) as JSON
- `{{response}}` — HTTP response (status, headers, body) as JSON

## Live prompt (in ai-enricher.ts)

```
You are a test automation expert analyzing a failing API test for a financial GL (General Ledger) Service.

FAILED SCENARIO: {{scenarioName}}
TAGS: {{tags}}
ERROR: {{error}}
REQUEST: {{request}}
RESPONSE: {{response}}

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
}
```

## Output format
JSON matching the structure above.

## Allure integration
After analysis the result is:
- Rendered as an HTML table on the Allure Overview tab via `allureDescriptionHtml()`
- Severity is mapped to an Allure label: critical→critical, high→blocker, medium→normal, low→minor

## Severity / Allure label mapping
| AI severity | Allure severity label |
|---|---|
| critical | critical |
| high | blocker |
| medium | normal |
| low | minor |
