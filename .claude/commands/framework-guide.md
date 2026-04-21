# riverty-playwright-bdd — Framework Guide & Implementation Patterns

You are helping a developer work on a **riverty-playwright-bdd** BDD test automation framework project.
When asked to implement new features, step definitions, schemas, or models, follow every pattern below exactly.

---

## Project Stack

| Concern | Library |
|---|---|
| HTTP requests | Playwright `APIRequestContext` (NOT browser) |
| BDD runner | playwright-bdd 8.x (generates `.spec.ts` from `.feature` files) |
| BDD config | `playwright.api.config.ts` via `defineBddConfig()` |
| Fixtures / state | `src/fixtures/api/index.ts` — replaces Cucumber `World` |
| Assertions | Chai 5.x (`expect(...).to.be.true`, `.to.equal`, `.to.be.at.least`) |
| Schema validation | Ajv 8.x + `ajv-formats`, JSON Schema Draft-07 |
| Type safety | TypeScript 5.x strict mode |
| Logging | Winston (`src/core/logger.ts`) |

---

## How playwright-bdd works

1. `npm run bdd:gen` — reads `.feature` files → generates `.spec.ts` in `.features-gen/`
2. `playwright test` runs the generated specs
3. Step definitions in `src/steps/**/*.ts` are auto-discovered via `playwright.api.config.ts`

**Always run `npm run bdd:gen` after changing any `.feature` file.**

---

## Critical Rules (must follow — always)

1. **Import `Given/When/Then` only from `../../fixtures`** — never from `@cucumber/cucumber` or `playwright-bdd`
2. **Never reassign `currentResponse`** — always `Object.assign(currentResponse, result)`
3. **HTTP status codes in feature files use labels, never numbers** — `OK`, `BadRequest`, `NotFound`, etc.
4. **Run `npm run bdd:gen` after every `.feature` file change**
5. **Schemas are object-type** (not array) — validate arrays with `each item in the response array should match schema`
6. **Verify response shape against a live API run** — swagger may reference the wrong component schema
7. **Domain step files register endpoints via `registerTemplates()`** — never use inline `REQUEST_TEMPLATES` const
8. **Common steps in `src/steps/api/common/` must not be re-defined in domain files** — check before adding

---

## New Controller Checklist

- [ ] Read `src/models/test-data/fixtures/swagger.json` for endpoint definition
- [ ] Make a live API call to verify actual response shape (swagger may be wrong)
- [ ] `src/models/responses/<entity>.response.ts` — TypeScript interface
- [ ] `src/schemas/json-schemas/<entity>.schema.json` — JSON Schema Draft-07
- [ ] `features/<domain>/<domain>.feature` — Gherkin with `@<domain>` tag
- [ ] `src/steps/<domain>/<domain>.steps.ts` — `registerTemplates()` + send + assertions
- [ ] Add project to `playwright.api.config.ts` projects array for new domain

---

## Tag Architecture

**Domain tags** (mutually exclusive, one per feature): Each maps to a Playwright project in `playwright.api.config.ts`.
**Cross-cutting tags** (additive): `@smoke`, `@regression`, `@negative`, `@schema` — filtered via `--grep` at CLI.
**Special tags**: `@fixme` → `test.fixme()` (skipped), `@manual` → excluded from all runs.

---

## Common Mistakes

| Mistake | Correct |
|---|---|
| `import { Given } from '@cucumber/cucumber'` | `import { Given } from '../../fixtures'` |
| `this.currentResponse = result` | `Object.assign(currentResponse, result)` |
| `currentResponse = result` (local rebind) | `Object.assign(currentResponse, result)` |
| `body as MyType[]` | `body as unknown as MyType[]` |
| Numeric codes in features (`200`, `404`) | Labels: `OK`, `NotFound` |
| Re-defining a common step in a domain file | Check `src/steps/api/common/` first |
| Using OpenAPI `nullable: true` in JSON schema | Use `["type", "null"]` (Draft-07) |
| Trusting swagger without verifying against live API | Always run the endpoint and check actual response |
| Forgetting `npm run bdd:gen` after feature changes | Run before any test run |
| One generic "send" step for all request types | Each domain gets its own named send step |
| Root-level array schema | Object schema + `each item in the response array should match schema` |
| Putting message interfaces in `src/models/responses/` | Co-locate in factory file |
| Raw exchange string in feature/step file | Register label in `src/messaging/exchanges.ts` |

---

For full implementation patterns with code examples, see `.claude/skills/framework-guide/patterns.md`.
