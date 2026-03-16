# Scenario Generator Prompt Template

## Purpose
Generate comprehensive Gherkin BDD test scenarios from Jira ticket descriptions for the GL Service API.

## Input Variables
- `{{ticketSummary}}` — Jira story/bug summary
- `{{acceptanceCriteria}}` — AC from the ticket
- `{{apiEndpoint}}` — Target API endpoint
- `{{httpMethod}}` — HTTP method (GET, POST, PUT, DELETE)
- `{{existingSchemas}}` — Available JSON schema definitions
- `{{existingPatterns}}` — Sample existing scenarios for style consistency

## Prompt Template

```
You are an expert QA engineer for a financial GL (General Ledger) API.

JIRA TICKET: {{ticketSummary}}

ACCEPTANCE CRITERIA:
{{acceptanceCriteria}}

TARGET ENDPOINT: {{httpMethod}} {{apiEndpoint}}

AVAILABLE SCHEMAS:
{{existingSchemas}}

EXISTING TEST PATTERNS (follow this style):
{{existingPatterns}}

Generate comprehensive Gherkin scenarios including:

1. POSITIVE SCENARIOS:
   - Happy path with valid data
   - Boundary conditions (min/max valid values)
   - Different valid combinations

2. NEGATIVE SCENARIOS:
   - Missing required fields (each field tested separately)
   - Invalid field types (string where number expected, etc.)
   - Out-of-range values
   - GL-specific: unbalanced entries, invalid account codes, closed periods

3. SCHEMA & CONTRACT:
   - Response schema validation scenario
   - Contract satisfaction scenario

4. SECURITY:
   - Unauthenticated request
   - SQL injection attempt
   - XSS attempt

TAGGING RULES:
- @smoke — 1-2 critical happy path scenarios
- @regression — Full coverage scenarios
- @negative — All error condition scenarios
- @schema — Schema validation scenarios
- @contract — Contract tests
- @critical — Business-critical financial operations
- @XRAY-{KEY} — Link to Jira test key

FINANCIAL DOMAIN RULES:
- Amounts must have 2 decimal places (5000.00 not 5000)
- Currency codes must be ISO 4217 (EUR, USD, GBP, etc.)
- Debit amounts must equal credit amounts for valid entries
- Account codes follow the configured pattern

Output valid Gherkin in a feature file format.
```

## Output Format
Full .feature file content as a string, ready to save.
