# riverty-playwright-bdd — Agent Guide

BDD-only Playwright framework for API and UI automation.

The repo is modality-first:

- `features/api/**`
- `features/ui/**`
- `src/core/api/**`
- `src/core/ui/**`
- `src/core/shared/**`
- `src/fixtures/api/**`
- `src/fixtures/ui/**`
- `src/steps/api/**`
- `src/steps/ui/**`

The bundled GL implementation is a reference pack under `gl`.

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
npm run test:ui:feature -- "@gl-navigation"
npm run test:ui:runner

npm test
npm run lint
npm run type-check
```

`bdd:gen:*` must run before bare `npx playwright test`. All `npm run test:*` scripts already do that.

## Playwright Configs

- `playwright.api.config.ts`
- `playwright.ui.config.ts`

## Non-Negotiable Rules

| Rule                   | Correct                                  | Wrong                                                 |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------- |
| API step imports       | `import { When } from '@api-fixtures'`   | importing step helpers from `playwright-bdd` directly |
| UI step imports        | `import { Given } from '@ui-fixtures'`   | importing step helpers from `playwright-bdd` directly |
| Mutate API response    | `Object.assign(currentResponse, result)` | `currentResponse = result`                            |
| Array body cast        | `body as unknown as MyType[]`            | `body as MyType[]`                                    |
| HTTP status in Gherkin | `I get the response code of OK`          | `the response code should be 200`                     |
| JSON schema nullable   | `"type": ["string", "null"]`             | `"nullable": true`                                    |

## API Structure

- Common API steps: `src/steps/api/common/**`
- Reference GL API steps: `src/steps/api/gl/**`
- API fixture entrypoint: `src/fixtures/api/index.ts`
- API helpers: `src/core/api/**`
- Shared config/logger/reporting: `src/core/shared/**`
- API models: `src/models/api/**`
- API schemas: `src/schemas/api/**`

### Add a New API Endpoint

Create all three:

1. `src/models/api/<module>/responses/<entity>.response.ts`
2. `src/schemas/api/<module>/json-schemas/<entity>.schema.json`
3. `src/steps/api/<module>/<domain>.steps.ts`

Use `registerTemplates()` from `@api-utils/request-templates` for endpoint templates. Do not re-define the common API/auth/schema/database/message steps.

## UI Structure

- UI fixture entrypoint: `src/fixtures/ui/index.ts`
- Base page: `src/core/ui/base.page.ts`
- Concrete pages: `src/pages/ui/<module>/**`
- UI steps: `src/steps/ui/<module>/**`

### UI Conventions

- Use POM
- Export singleton page-object instances
- Rebind each page object per scenario with `bind(page)`
- Define locators as arrow functions
- Do not add one wrapper method per click/type action
- Reserve page-object methods for meaningful compound actions
- Keep UI step definitions thin and readable

## Tag Contract

Every scenario should carry:

- one modality tag: `@api` or `@ui`
- one module tag: for example `@gl-clients`, `@gl-security`, `@gl-navigation`

Additional tags such as `@smoke`, `@authenticated`, `@manual`, and `@fixme` are additive.

## Path Aliases

Use the modality-aware aliases from `tsconfig.json`:

| Alias              | Resolves to                 |
| ------------------ | --------------------------- |
| `@api-core/*`      | `src/core/api/*`            |
| `@ui-core/*`       | `src/core/ui/*`             |
| `@shared-core/*`   | `src/core/shared/*`         |
| `@api-database/*`  | `src/core/api/database/*`   |
| `@api-messaging/*` | `src/core/api/messaging/*`  |
| `@api-utils/*`     | `src/core/api/utils/*`      |
| `@api-fixtures`    | `src/fixtures/api/index.ts` |
| `@ui-fixtures`     | `src/fixtures/ui/index.ts`  |
| `@api-models/*`    | `src/models/api/*`          |
| `@api-schemas/*`   | `src/schemas/api/*`         |
| `@ui-pages/*`      | `src/pages/ui/*`            |

## Environment Variables

Runtime config is loaded from `src/core/shared/config.ts`.

Canonical variables:

- API: `API_BASE_URL`, `API_SERVICE_PATH`, `INSTANCE_ID`, `API_VERSION`, `API_TIMEOUT`, `MESSAGE_WAIT_TIMEOUT`
- UI: `UI_BASE_URL`, `UI_AUTH_STORAGE_PATH`, `UI_DEFAULT_TIMEOUT`, `UI_USERNAME`, `UI_PASSWORD`
- Shared: `TEST_ENV`, `REPORT_DIR`, `LOG_LEVEL`, `GIT_SHA`
- Integrations: `AUTH_*`, `RABBITMQ_*`, `DB_*`, `XRAY_*`

Checked-in non-secret overlays live in `config/environments/*.env`. Local secrets belong in `.env.local`.

## Reference Notes

- Azure SQL passwordless auth still uses `DB_AUTH_TYPE=azure-active-directory-default`
- Messaging exchange labels are registered in `src/core/api/messaging/exchanges.ts`
- Generated specs under `.features-gen/` must not be edited directly
