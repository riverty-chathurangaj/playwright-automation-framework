# riverty-playwright-bdd — Claude Context

This repository is a modality-first, BDD-only Playwright framework for API and UI automation.

## Core Rules

- API steps import `{ Given, When, Then }` from `@api-fixtures`
- UI steps import `{ Given, When, Then }` from `@ui-fixtures`
- Mutate API responses with `Object.assign(currentResponse, result)`
- Use status labels in feature files, not numeric HTTP codes
- Run the matching `bdd:gen:*` command after feature changes if you are not using the `npm run test:*` scripts

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
| `src/steps/ui/gl/**`        | GL UI reference steps              |
| `src/pages/ui/gl/**`        | GL reference page objects          |
| `src/models/api/gl/**`      | GL API response/test-data assets   |
| `src/schemas/api/gl/**`     | GL API JSON schemas/contracts      |

## Tag Model

- Modality tags: `@api`, `@ui`
- Module tags: for example `@gl-clients`, `@gl-security`, `@gl-navigation`
- Additive tags: `@smoke`, `@authenticated`, `@manual`, `@fixme`

## Useful Commands

```bash
npm run test:api
npm run test:api:smoke
npm run test:api:feature -- "@gl-clients"
npm run test:ui
npm run test:ui:smoke
npm run test:ui:feature -- "@gl-navigation"
npm run lint
npm run type-check
```
