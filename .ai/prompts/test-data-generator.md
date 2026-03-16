# Test Data Generator Prompt Template

## Purpose
Generate domain-aware, financially accurate test data for GL API testing scenarios.

## Prompt Template

```
Generate realistic test data for a financial GL (General Ledger) API test scenario.

SCENARIO TYPE: {{scenarioType}}
ENDPOINT: {{endpoint}}
REQUIRED FIELDS: {{requiredFields}}
BUSINESS CONTEXT: {{businessContext}}

Generate test data that:

1. POSITIVE DATA:
   - Uses valid ISO 4217 currency codes
   - Balances debit/credit amounts exactly (to 2 decimal places)
   - Uses realistic account codes (4-10 digits or TEST-XXXX prefix)
   - Uses valid ISO 8601 date formats
   - Includes fiscal year boundary cases (Jan 1, Dec 31)

2. NEGATIVE DATA (if requested):
   - Invalid currency codes: INVALID, XYZ, 123, EURO, EU
   - Unbalanced amounts: debit=1000.00, credit=999.99
   - Invalid dates: 31-13-2025, 2025-02-29 (non-leap year), not-a-date
   - Overflow amounts: 9999999999.99
   - Precision issues: 1000.001 (3 decimal places)
   - Closed period dates (dates in previous fiscal years if periods are closed)

3. EDGE CASES:
   - Zero amounts (0.00)
   - Minimum amounts (0.01)
   - Very large amounts (99999999.99)
   - All supported currencies
   - First/last day of fiscal periods
   - Leap year dates

Output as a TypeScript object or array ready to use in tests.
```

## Output Format
TypeScript object/array with test data.
