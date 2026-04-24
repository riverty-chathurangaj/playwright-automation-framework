# riverty-playwright-bdd - Agent Guide

This repository is a BDD-only Playwright automation framework for API and UI tests. Agents should treat it as a framework/template first, with GL API tests and SauceDemo UI tests as reference implementations.

## Read First

- Architecture: `docs/framework-architecture.md`
- Implementation patterns: `docs/implementation-patterns.md`
- Agent workflow: `docs/agent-playbook.md`
- Runtime config: `src/core/shared/config.ts`
- Scripts: `package.json`

## Critical Workflow

```bash
npm run bdd:gen:api
npm run bdd:gen:ui
npm run bdd:gen

npm run test:api
npm run test:api:smoke
npm run test:api:feature -- "@gl-clients"
npm run test:api:runner

npm run test:ui
npm run test:ui:smoke
npm run test:ui:feature -- "@saucedemo"
npm run test:ui:runner

npm test
npm run lint
npm run type-check
npm run clean
```

`bdd:gen:*` must run before bare `npx playwright test`. The `npm run test:*` scripts already run the matching generation step.

## Non-Negotiable Rules

| Rule                     | Correct                                                                    | Wrong                                                 |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| API step imports         | `import { When } from '@api-fixtures'`                                     | importing step helpers from `playwright-bdd` directly |
| UI step imports          | `import { Given } from '@ui-fixtures'`                                     | importing step helpers from `playwright-bdd` directly |
| Mutate API response      | `Object.assign(currentResponse, result)`                                   | `currentResponse = result`                            |
| Array body cast          | `body as unknown as MyType[]`                                              | `body as MyType[]`                                    |
| HTTP status in Gherkin   | `I get the response code of OK`                                            | `the response code should be 200`                     |
| JSON schema nullable     | `"type": ["string", "null"]`                                               | `"nullable": true`                                    |
| UI page object lifecycle | `export const loginPage = new LoginPage();` plus `bind(page)` per scenario | `new LoginPage(page)` inside every step               |
| Generated specs          | regenerate `.features-gen/`                                                | edit `.features-gen/` directly                        |

## Repository Shape

- API features: `features/api/**`
- UI features: `features/ui/**`
- API runtime: `src/core/api/**`
- UI runtime: `src/core/ui/**`
- Shared runtime: `src/core/shared/**`
- API fixtures and steps: `src/fixtures/api/**`, `src/steps/api/**`
- UI fixtures and steps: `src/fixtures/ui/**`, `src/steps/ui/**`
- API models and schemas: `src/models/api/**`, `src/schemas/api/**`
- UI page objects: `src/pages/ui/**`

## API Patterns

- Reuse common API steps from `src/steps/api/common/**` before adding new steps.
- Module steps live under `src/steps/api/<module>/**`.
- Endpoint templates are registered with `registerTemplates()` from `@api-utils/request-templates`.
- New API response types use `src/models/api/<module>/responses/**`.
- New JSON schemas use Draft-07 under `src/schemas/api/<module>/json-schemas/**`.
- API assertions use Chai because API step definitions already use Chai.
- Database credentials can be supplied by mounted files, Vault, or env vars. Do not log secrets.

## UI Patterns

- Use POM with `src/core/ui/base.page.ts`.
- Export singleton page-object instances and rebind each scenario with `bind(page)` from `src/fixtures/ui/index.ts`.
- Define locators as arrow functions.
- Prefer semantic locators: role, label, placeholder, text, then test id. CSS and XPath are last resort.
- Keep simple clicks and fills in steps; reserve page-object methods for meaningful compound flows.
- UI assertions use Playwright `expect` and web-first assertions. Avoid `waitForTimeout`.

## Tag Contract

Every scenario should carry:

- one modality tag: `@api` or `@ui`
- one module tag, for example `@gl-clients`, `@gl-security`, or `@saucedemo`

Additional tags such as `@smoke`, `@authenticated`, `@manual`, and `@fixme` are additive.

## Generated And Local Files

Do not edit or commit generated/runtime artifacts:

- `.features-gen/`
- `reports/`
- `test-results/`
- `playwright-report/`
- `allure-results/`
- `.auth/`
- `.playwright/`
- `.claude/settings.local.json`

Local secrets belong in `.env.local` or secure secret stores. Checked-in environment overlays under `config/environments/*.env` must stay non-secret.
