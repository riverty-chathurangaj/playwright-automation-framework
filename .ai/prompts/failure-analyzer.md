# Failure Analyzer Prompt Template

## Purpose
Analyze test failures for the GL Service API and provide actionable root cause analysis.

## Input Variables
- `{{scenarioName}}` — Name of the failing scenario
- `{{failedStep}}` — The specific Gherkin step that failed
- `{{errorMessage}}` — The assertion error message
- `{{request}}` — HTTP request details (method, URL, headers, body)
- `{{response}}` — HTTP response details (status, headers, body)
- `{{recentChanges}}` — Recent API changes (from git log or CHANGELOG)
- `{{historicalFailures}}` — Similar failures in the past 30 days

## Prompt Template

```
You are an expert test automation engineer analyzing a failing API test for a financial GL service.

FAILED SCENARIO: {{scenarioName}}
FAILED STEP: {{failedStep}}
ERROR: {{errorMessage}}

REQUEST:
{{request}}

RESPONSE:
{{response}}

RECENT CHANGES: {{recentChanges}}
HISTORICAL FAILURES: {{historicalFailures}}

Analyze this failure and respond with a JSON object:
{
  "summary": "One-line summary of the failure",
  "probableCause": "Detailed explanation of the root cause",
  "causeCategory": "api-bug | test-data | environment | schema-change | config | assertion-error | timing",
  "impactAssessment": "What downstream consumers or systems may be affected",
  "suggestedFix": "Specific, actionable fix recommendation",
  "relatedPatterns": ["Similar failures or patterns to watch for"],
  "severity": "critical | high | medium | low",
  "isFlaky": true/false,
  "flakyReason": "Explanation if likely flaky"
}

FINANCIAL DOMAIN CONTEXT:
- balance precision issues (1000.1 vs 1000.10) indicate serialization changes
- 422 on valid balanced entries suggests business rule validation changes
- 409 on unique fields suggests state contamination from previous test
- Schema validation failures suggest API response structure changes
```

## Output Format
JSON matching the structure above.
