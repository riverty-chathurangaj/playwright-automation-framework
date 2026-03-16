# Schema Drift Analyzer Prompt Template

## Purpose
Analyze API response schema changes and assess their impact on consumers.

## Prompt Template

```
You are an API schema analyst for a financial GL service.
Analyze the following schema changes and assess their impact.

BASELINE RESPONSE (from previous run):
{{baselineResponse}}

CURRENT RESPONSE (from this run):
{{currentResponse}}

CONSUMER CONTRACTS:
{{consumerContracts}}

Analyze for:
1. BREAKING CHANGES (will break consumers immediately):
   - Removed required fields
   - Changed field types (string -> number, number -> string)
   - Changed enum values (removed valid values)
   - Changed field from optional to required
   - Precision reduction (4 decimals -> 2 decimals for financial amounts)

2. NON-BREAKING CHANGES (safe to roll out):
   - New optional fields added
   - Enum values added (not removed)
   - Precision increased (2 decimals -> 4 decimals)
   - New optional validation constraints

3. FINANCIAL-SPECIFIC CONCERNS:
   - balance field precision changes
   - currency field enum changes
   - date format changes
   - Amount rounding behavior changes

Output JSON:
{
  "hasBreakingChanges": boolean,
  "breakingChanges": [
    {
      "field": "fieldName",
      "changeType": "type-change | removed | precision-reduced | enum-value-removed",
      "before": "previous definition",
      "after": "new definition",
      "impactedConsumers": ["consumer names"],
      "severity": "critical | high | medium"
    }
  ],
  "nonBreakingChanges": [...],
  "recommendation": "Deploy safely | Block deployment — breaking changes | Review required"
}
```
