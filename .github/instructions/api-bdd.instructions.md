---
applyTo: 'features/api/**,src/steps/api/**,src/fixtures/api/**,src/core/api/**,src/models/api/**,src/schemas/api/**'
---

# API BDD Instructions

Follow `docs/implementation-patterns.md` for API changes.

- Author API tests as Gherkin under `features/api/**`, not raw Playwright specs.
- Import BDD helpers from `@api-fixtures`.
- Reuse common steps in `src/steps/api/common/**` before adding new steps.
- Register endpoint templates with `registerTemplates()` from `@api-utils/request-templates`.
- Mutate `currentResponse` with `Object.assign(currentResponse, result)`.
- Use Chai assertions in API step definitions.
- Use status labels in feature files, such as `OK`, `BadRequest`, and `Forbidden`.
- Store API response models under `src/models/api/<module>/responses/**`.
- Store Draft-07 schemas under `src/schemas/api/<module>/json-schemas/**`.
- Use `"type": ["string", "null"]` for nullable JSON schema fields.
- Do not introduce Zod or generic Playwright `request` test patterns as the primary API style.
