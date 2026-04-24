# riverty-playwright-bdd - Claude Context

This is a modality-first, BDD-only Playwright framework for API and UI automation. Read `docs/framework-architecture.md`, `docs/implementation-patterns.md`, and `docs/agent-playbook.md` before making framework changes.

## Always Follow

- Author tests as `.feature` files plus step definitions. Do not make raw `tests/**/*.spec.ts` the primary pattern.
- API steps import `{ Given, When, Then }` from `@api-fixtures`.
- UI steps import `{ Given, When, Then }` from `@ui-fixtures`.
- API responses are mutated with `Object.assign(currentResponse, result)`, never reassigned.
- Feature files use HTTP status labels such as `OK` and `BadRequest`, not numeric status codes.
- JSON schemas use Draft-07 nullable syntax: `"type": ["string", "null"]`.
- Generated specs in `.features-gen/` are never edited directly.

## Key Paths

| Path                        | Purpose                            |
| --------------------------- | ---------------------------------- |
| `playwright.api.config.ts`  | API BDD runtime                    |
| `playwright.ui.config.ts`   | UI BDD runtime                     |
| `src/core/shared/config.ts` | Environment-aware runtime config   |
| `src/fixtures/api/index.ts` | API fixtures and bound BDD helpers |
| `src/fixtures/ui/index.ts`  | UI fixtures and bound BDD helpers  |
| `src/steps/api/common/**`   | Reusable API step definitions      |
| `src/steps/api/gl/**`       | GL API reference steps             |
| `features/api/gl/**`        | GL API reference features          |
| `features/ui/saucedemo/**`  | SauceDemo UI sample features       |
| `src/pages/ui/saucedemo/**` | SauceDemo UI sample page objects   |
| `src/models/api/**`         | API response and test-data models  |
| `src/schemas/api/**`        | API JSON schemas and contracts     |

## UI Rules

- Page objects are singleton exports that call `bind(page)` per scenario.
- Locators are arrow functions.
- Prefer semantic Playwright locators before test ids, CSS, or XPath.
- Use Playwright web-first assertions and auto-waiting; avoid `waitForTimeout`.

## Useful Commands

```bash
npm run test:api
npm run test:api:smoke
npm run test:api:feature -- "@gl-clients"
npm run test:ui
npm run test:ui:smoke
npm run test:ui:feature -- "@saucedemo"
npm run lint
npm run type-check
```

Use the project skills in `.claude/skills/**` for framework and Playwright browser guidance. Keep `.claude/settings.local.json` local-only.
