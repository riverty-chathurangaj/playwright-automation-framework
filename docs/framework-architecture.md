# Framework Architecture

`riverty-playwright-bdd` is a BDD-only Playwright automation framework for API and UI coverage. It is organized by modality first so API and UI tests can evolve independently while sharing config, logging, reporting, and environment handling.

## Runtime Shape

| Layer         | API                                       | UI                         | Shared                           |
| ------------- | ----------------------------------------- | -------------------------- | -------------------------------- |
| Features      | `features/api/**`                         | `features/ui/**`           | Gherkin tags and generated specs |
| Fixtures      | `src/fixtures/api/index.ts`               | `src/fixtures/ui/index.ts` | Playwright-BDD binding style     |
| Steps         | `src/steps/api/**`                        | `src/steps/ui/**`          | Thin BDD step definitions        |
| Core          | `src/core/api/**`                         | `src/core/ui/**`           | `src/core/shared/**`             |
| Domain assets | `src/models/api/**`, `src/schemas/api/**` | `src/pages/ui/**`          | `config/environments/*.env`      |

`playwright-bdd` reads feature files and step definitions, then generates runnable Playwright specs under `.features-gen/`. The generated specs are build artifacts and must not be edited directly.

## Execution Flow

1. `npm run test:api` runs `npm run bdd:gen:api`, then Playwright with `playwright.api.config.ts`.
2. `npm run test:ui` runs `npm run bdd:gen:ui`, then Playwright with `playwright.ui.config.ts`.
3. API global setup runs shared reporting setup and database secret bootstrap before API tests use the database client.
4. UI global setup writes UI environment metadata for reporting.
5. Allure and JSON reports are written under `reports/`; Playwright traces, screenshots, and videos are written under `test-results/`.

Bare `npx playwright test` is valid only after the matching BDD generation command has already run.

## API Architecture

API tests do not launch a browser. They use Playwright request primitives through framework helpers and fixtures.

- API fixtures live in `src/fixtures/api/index.ts`.
- API common steps live in `src/steps/api/common/**`.
- Module-specific API steps live in `src/steps/api/<module>/**`.
- HTTP helpers, auth, request templates, database, and messaging live under `src/core/api/**`.
- API response models live under `src/models/api/<module>/responses/**`.
- API JSON schemas live under `src/schemas/api/<module>/json-schemas/**`.

The GL API suite under `features/api/gl/**`, `src/steps/api/gl/**`, `src/models/api/gl/**`, and `src/schemas/api/gl/**` is the bundled reference pack, not the framework identity.

## UI Architecture

UI tests use BDD feature files, UI step definitions, and page objects.

- UI fixtures live in `src/fixtures/ui/index.ts`.
- UI steps live under `src/steps/ui/<module>/**`.
- Shared page primitives live in `src/core/ui/base.page.ts`.
- Concrete page objects live in `src/pages/ui/<module>/**`.

Page objects are singleton exports that are rebound to the current Playwright `Page` per scenario via `bind(page)`. The SauceDemo files under `features/ui/saucedemo/**`, `src/pages/ui/saucedemo/**`, and `src/steps/ui/saucedemo/**` are the public sample UI pack.

## Configuration And Secrets

Runtime config is loaded from `src/core/shared/config.ts` in this order:

1. code defaults
2. legacy root `.env` fallback
3. `config/environments/<TEST_ENV>.env`
4. `.env.local`
5. process environment variables

Checked-in environment overlays must stay non-secret. Local secrets belong in `.env.local` or secure secret tooling.

Database credentials are resolved for API runs through the DB secret bootstrap:

- `DB_SECRET_SOURCE=auto` tries mounted files, Vault, then env credentials.
- `DB_SECRET_SOURCE=files` reads `/secrets/database/MsSql__UserId` and `/secrets/database/MsSql__Password`.
- `DB_SECRET_SOURCE=vault` uses AppRole settings and `VAULT_DB_SECRET_PATH`.
- `DB_SECRET_SOURCE=env` keeps the existing `DB_USER` and `DB_PASSWORD` flow.
- `DB_AUTH_TYPE=azure-active-directory-default` skips password bootstrap.

Never log secret values. Redact credentials in diagnostics and reports.

## Generated And Template Assets

Generated/runtime folders are ignored and cleaned by `npm run clean`:

- `.features-gen/`
- `.auth/`
- `.playwright/`
- `reports/`
- `test-results/`
- `playwright-report/`
- `allure-results/`

Agent-facing template assets are intentionally versioned:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md`
- `.agents/skills/**`
- `.claude/commands/**`
- `.claude/skills/**`

Machine-specific Claude settings stay local in `.claude/settings.local.json`.
