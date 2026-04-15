# pw-testforge-gls

BDD API automation framework for the General Ledger service.

The framework uses Playwright's `APIRequestContext` for HTTP testing, `playwright-bdd` for Gherkin-to-test generation, Ajv for JSON schema validation, RabbitMQ helpers for event flows, and Knex for database verification.

## Quick Start

1. Install dependencies.
2. Copy `.env.example` to `.env.local` and fill in your local secrets.
3. Pick an environment with `TEST_ENV` and run a test command.

```bash
npm install
TEST_ENV=dev npm run test:smoke
```

PowerShell example:

```powershell
$env:TEST_ENV = 'dev'
npm run test:smoke
```

If you change any `.feature` files, run `npm run bdd:gen` before using bare `npx playwright test`. All `npm run test:*` scripts already do this for you.

## Formatting and Hooks

Husky is enabled through the `prepare` script and installs a `pre-commit` hook after `npm install`.

- `npm run format` formats the repository with Prettier
- `npm run format:check` checks formatting without changing files
- the `pre-commit` hook runs `lint-staged`, which formats staged supported files with Prettier and runs `eslint --fix` on staged JavaScript and TypeScript files

## AI Authoring Workflow

The repo now has a bundle-based AI authoring workflow for Jira/Xray-driven test planning and implementation.

1. `npm run ai:plan -- --source <jira-or-xray-id-or-url> [--source ...] [--out <slug>]`
2. Review `.ai/out/<slug>/source-context.json`, `.ai/out/<slug>/coverage-analysis.md`, and `.ai/out/<slug>/test-plan.md`
3. `npm run ai:approve -- --from <slug>`
4. `npm run ai:implement -- --from <slug>`

The workflow is intentionally human-approved. `ai:implement` refuses to write repo files until the bundle is approved.

## Environment Model

Runtime config is selected by `TEST_ENV`.

- Shared non-secret defaults live in `config/environments/<env>.env`
- Developer-specific secrets and overrides live in `.env.local`
- CI secrets come from Azure DevOps variable groups
- Legacy root `.env` is still supported as a temporary migration fallback

Supported environments right now:

- `dev`
- `test`
- `pt`

The loader applies values in this order:

1. Code defaults
2. Legacy root `.env` fallback if present
3. `config/environments/<TEST_ENV>.env`
4. `.env.local`
5. Process environment variables from CI

That means Azure DevOps variables always win, and local `.env.local` wins over the checked-in environment overlays.

## Local Configuration

Start by copying the template:

```bash
cp .env.example .env.local
```

Then set the secrets you need locally, such as:

- `AUTH_CLIENT_ID`
- `AUTH_CLIENT_SECRET`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `RABBITMQ_URL`

You can also override any non-secret value locally in `.env.local`, but the default expectation is that shared non-secret values come from `config/environments/dev.env`, `config/environments/test.env`, or `config/environments/pt.env`.

## Test Commands

### Core commands

| Command                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `npm test`                           | Generate BDD specs and run all automated tests        |
| `npm run test:smoke`                 | Run scenarios tagged `@smoke`                         |
| `npm run test:feature -- "@clients"` | Run tests by grep pattern, tag, or title              |
| `npm run test:ui`                    | Open the Playwright UI runner                         |
| `npm run bdd:gen`                    | Regenerate `.features-gen` from `.feature` files only |
| `npm run lint`                       | Run ESLint on the TypeScript source                   |
| `npm run type-check`                 | Run TypeScript in `--noEmit` mode                     |
| `npm run clean`                      | Remove generated output and reports                   |

### Project commands

Each feature belongs to a Playwright project keyed off a domain tag.

| Project            | Command                         |
| ------------------ | ------------------------------- |
| `clients`          | `npm run test:clients`          |
| `accounts`         | `npm run test:accounts`         |
| `balance`          | `npm run test:balance`          |
| `transactions`     | `npm run test:transactions`     |
| `instances`        | `npm run test:instances`        |
| `accounting-month` | `npm run test:accounting-month` |
| `postings`         | `npm run test:postings`         |
| `messaging`        | `npm run test:messaging`        |
| `security`         | `npm run test:security`         |

### Reporting commands

| Command                   | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| `npm run report:generate` | Build an Allure HTML report from `reports/allure-results` |
| `npm run report:open`     | Open the generated Allure report                          |
| `npm run report:serve`    | Serve Allure directly from raw results                    |
| `npm run report`          | Generate and open the Allure report                       |

## Azure DevOps

Azure DevOps is now the primary CI path for environment-aware execution.

Use `azure-pipelines.yml` with one variable group per environment:

- `gl-tests-dev`
- `gl-tests-test`
- `gl-tests-pt`

Current pipeline behavior:

- PR validation runs smoke tests against `dev`
- Manual runs allow selecting `dev`, `test`, or `pt` and a Playwright grep pattern
- Nightly regression runs the full suite against `pt`

The existing GitHub Actions workflow remains in the repo as a temporary fallback during migration, but Azure DevOps is the primary documented runner.

## Tag Model

- Domain tags such as `@clients`, `@accounts`, and `@messaging` map directly to Playwright projects.
- `@smoke` is the main additive execution tag currently wired into npm scripts.
- `@manual` is excluded from automated project runs.
- `@fixme` is converted by `playwright-bdd` into a skipped test.
- Messaging features also use sub-domain tags such as `@book-client-deposit`.

The older cross-cutting profiles `@regression`, `@negative`, and `@schema` are not currently populated in the checked-in feature set, so they are not exposed as npm run profiles.

## How It Works

```text
features/<domain>/*.feature
        -> npm run bdd:gen
.features-gen/**/*.spec.ts
        -> playwright test
```

- `src/fixtures/index.ts` is the shared fixture entry point for `Given`, `When`, and `Then`.
- `src/steps/common/` contains reusable request, auth, schema, database, and messaging steps.
- `src/steps/<domain>/` contains domain-specific request templates and assertions.
- `src/schemas/json-schemas/` stores API response schemas.
- `src/messaging/` contains RabbitMQ helpers, validators, and exchange mappings.
- `src/database/` contains the Knex-based database client and query helpers.

Do not edit files under `.features-gen`; they are generated output.

## Reporting and Artifacts

- Playwright JSON report: `reports/playwright-report.json`
- Allure raw results: `reports/allure-results/`
- Allure HTML report: `reports/allure-report/`
- Generated specs: `.features-gen/`
- Playwright traces: `test-results/`

## Environment Variables

The framework still uses the same env var names; only the source model changed.

| Area      | Variables                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| API       | `BASE_URL`, `SERVICE_PATH`, `INSTANCE_ID`, `API_VERSION`, `API_TIMEOUT`, `TEST_ENV`                                     |
| Auth      | `AUTH_BASE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE`                                                |
| RabbitMQ  | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_DLQ`, `RABBITMQ_VHOST`, `RABBITMQ_HEARTBEAT`, `MESSAGE_WAIT_TIMEOUT`     |
| Database  | `DB_CLIENT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_QUERY_TIMEOUT`, `DB_AUTH_TYPE`, `DB_USER`, `DB_PASSWORD` |
| AI        | `AI_ENABLED`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_ENDPOINT`, `OPENAI_API_VERSION`, `AI_MODEL` |
| Jira      | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`                                                                         |
| Xray      | `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`, `XRAY_BASE_URL`, `XRAY_PROJECT_KEY`, `XRAY_EXECUTION_KEY`                       |
| Reporting | `REPORT_DIR`, `GIT_SHA`, `LOG_LEVEL`                                                                                    |

For Azure SQL passwordless authentication, set `DB_AUTH_TYPE=azure-active-directory-default` and authenticate with Azure before running tests.

## Current State

- Day-to-day execution is Playwright plus Allure.
- `npm run lint` and `npm run type-check` are both usable framework health checks.
- `docker` is intentionally not wired yet; the config loader is generic so it can be added later with a new env overlay and variable group.
