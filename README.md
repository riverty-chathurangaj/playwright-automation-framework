# riverty-playwright-bdd

`riverty-playwright-bdd` is a BDD-only Playwright framework for both API and UI automation.

The repo is organized by modality first:

```text
features/
  api/<module>/**
  ui/<module>/**

src/
  core/api/**       # API clients, messaging, database, API helpers
  core/ui/**        # BasePage, UI auth state, UI runtime helpers
  core/shared/**    # config, logging, shared reporting/AI helpers
  fixtures/api/**
  fixtures/ui/**
  steps/api/**
  steps/ui/**
  pages/ui/**
  models/api/**
  schemas/api/**
```

The current GL suite is bundled as a reference implementation under:

- `features/api/gl/**`
- `features/ui/gl/**`
- `src/steps/api/gl/**`
- `src/steps/ui/gl/**`
- `src/pages/ui/gl/**`
- `src/models/api/gl/**`
- `src/schemas/api/gl/**`

## Quick Start

```bash
npm install
TEST_ENV=dev npm run test:api:smoke
TEST_ENV=dev npm run test:ui:smoke
```

PowerShell:

```powershell
$env:TEST_ENV = 'dev'
npm run test:api:smoke
```

Copy `.env.example` to `.env.local` for local secrets and overrides. Shared non-secret defaults live in `config/environments/<env>.env`.
Database credentials can now be resolved in this order: mounted `/secrets/database` files, direct HashiCorp Vault lookup, then `DB_USER`/`DB_PASSWORD`.

## Commands

| Command                                       | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `npm run bdd:gen:api`                         | Generate API specs from `features/api/**/*.feature` |
| `npm run bdd:gen:ui`                          | Generate UI specs from `features/ui/**/*.feature`   |
| `npm run bdd:gen`                             | Generate both API and UI specs                      |
| `npm run test:api`                            | Run all API BDD scenarios                           |
| `npm run test:api:smoke`                      | Run API smoke scenarios                             |
| `npm run test:api:feature -- "@gl-clients"`   | Run API scenarios by tag/title grep                 |
| `npm run test:api:runner`                     | Open Playwright UI mode for API specs               |
| `npm run test:ui`                             | Run all UI BDD scenarios                            |
| `npm run test:ui:smoke`                       | Run UI smoke scenarios                              |
| `npm run test:ui:feature -- "@gl-navigation"` | Run UI scenarios by tag/title grep                  |
| `npm run test:ui:runner`                      | Open Playwright UI mode for UI specs                |
| `npm test`                                    | Run both modalities sequentially                    |
| `npm run lint`                                | Run ESLint                                          |
| `npm run type-check`                          | Run TypeScript with `--noEmit`                      |
| `npm run format`                              | Format the repo with Prettier                       |
| `npm run clean`                               | Remove generated specs, reports, and auth state     |

`npm run test:*` commands already run the matching `bdd:gen:*` step. A bare `npx playwright test` does not.

## Playwright Configs

- `playwright.api.config.ts`
- `playwright.ui.config.ts`

API and UI are intentionally isolated at the Playwright config, fixture, and feature levels.

## Environment Model

Runtime config loads in this order:

1. code defaults
2. legacy root `.env` fallback
3. `config/environments/<TEST_ENV>.env`
4. `.env.local`
5. process environment variables

Supported checked-in environments today:

- `dev`
- `test`
- `pt`

Database secret bootstrap for API runs is additive:

- `DB_SECRET_SOURCE=auto` tries mounted secret files, then Vault, then env credentials
- `DB_SECRET_SOURCE=files` requires `/secrets/database/MsSql__UserId` and `/secrets/database/MsSql__Password`
- `DB_SECRET_SOURCE=vault` requires the Vault settings below
- `DB_SECRET_SOURCE=env` keeps the existing `DB_USER` and `DB_PASSWORD` flow

Canonical runtime variables:

| Area     | Variables                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API      | `API_BASE_URL`, `API_SERVICE_PATH`, `INSTANCE_ID`, `API_VERSION`, `API_TIMEOUT`, `MESSAGE_WAIT_TIMEOUT`                                                                               |
| UI       | `UI_BASE_URL`, `UI_AUTH_STORAGE_PATH`, `UI_DEFAULT_TIMEOUT`, `UI_USERNAME`, `UI_PASSWORD`                                                                                             |
| Auth     | `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE`                                                                                                              |
| RabbitMQ | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_DLQ`, `RABBITMQ_VHOST`, `RABBITMQ_HEARTBEAT`                                                                                           |
| Database | `DB_CLIENT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_QUERY_TIMEOUT`, `DB_AUTH_TYPE`, `DB_SECRET_SOURCE`, `DB_USER`, `DB_PASSWORD`                                           |
| Vault    | `VAULT_ADDR`, `VAULT_AUTH_PATH`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID`, `VAULT_NAMESPACE`, `VAULT_DB_SECRET_PATH`, `VAULT_DB_USERNAME_FIELD`, `VAULT_DB_PASSWORD_FIELD`, `VAULT_TIMEOUT` |
| Shared   | `TEST_ENV`, `REPORT_DIR`, `LOG_LEVEL`, `GIT_SHA`                                                                                                                                      |

Azure DevOps is the primary CI path. Secrets should stay in variable groups; checked-in env overlays should stay non-secret.

## Tag Contract

Every scenario should carry:

- one modality tag: `@api` or `@ui`
- one module/domain tag such as `@gl-clients`, `@gl-security`, or `@gl-navigation`

Additional additive tags are fine, for example:

- `@smoke`
- `@authenticated`
- `@manual`
- `@fixme`

## UI Conventions

- Page objects use singleton instances with per-scenario `bind(page)`
- Locator definitions are arrow functions
- Simple interactions stay in step definitions
- Page-object methods are reserved for meaningful multi-element actions
- Shared browser primitives belong in `src/core/ui/base.page.ts`
- Concrete app pages live outside core in `src/pages/ui/<module>/**`

## API Conventions

- Reusable API steps live in `src/steps/api/common/**`
- Module-specific API steps live in `src/steps/api/<module>/**`
- Response interfaces live in `src/models/api/<module>/responses/**`
- JSON schemas live in `src/schemas/api/<module>/json-schemas/**`
- Request template registration is centralized through `registerTemplates()`
- Response fixtures must mutate `currentResponse` via `Object.assign(...)`

## Reporting

- API JSON report: `reports/playwright-api-report.json`
- UI JSON report: `reports/playwright-ui-report.json`
- Allure results: `reports/allure-results/`
- Allure HTML: `reports/allure-report/`
- Generated specs: `.features-gen/`

## Current Status

- The repo is now modality-first rather than API-root with a sidecar UI layer.
- The GL suite remains the bundled reference pack, not the framework identity.
- `docker` is intentionally not wired yet; adding it later should be a new env overlay plus pipeline variable group.
