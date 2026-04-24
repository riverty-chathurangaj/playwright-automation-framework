# Agent Playbook

This playbook describes how AI agents should work in this repository.

## Start Every Task

1. Read the user request and identify whether it touches API, UI, shared runtime, docs, CI, or template assets.
2. Inspect the relevant files before proposing or editing. Do not guess paths.
3. Check `git status --short` and preserve unrelated user changes.
4. Read `docs/framework-architecture.md` and `docs/implementation-patterns.md` when the task touches framework structure or test patterns.
5. Prefer narrow searches with `rg` and narrow test runs before broader validation.

## Choose The Right Area

| Request                        | Start Here                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Add API endpoint coverage      | `features/api/**`, `src/steps/api/**`, `src/models/api/**`, `src/schemas/api/**`                         |
| Add UI coverage                | `features/ui/**`, `src/pages/ui/**`, `src/steps/ui/**`, `src/fixtures/ui/index.ts`                       |
| Change DB or messaging support | `src/core/api/database/**`, `src/core/api/messaging/**`, `src/steps/api/common/**`                       |
| Change env/config behavior     | `src/core/shared/config.ts`, `.env.example`, `config/environments/*.env`                                 |
| Change Vault secret behavior   | `src/core/shared/secrets/**`, `src/core/api/global-setup.ts`                                             |
| Change reporting/global setup  | `src/core/shared/reporting/**`, `src/core/shared/playwright/**`, Playwright configs                      |
| Change agent guidance          | `AGENTS.md`, `CLAUDE.md`, `docs/**`, `.github/instructions/**`, `.agents/skills/**`, `.claude/skills/**` |

## Implement Safely

- Do not edit generated `.features-gen/` files.
- Do not commit reports, traces, screenshots, auth state, or local settings.
- Do not hardcode secrets or rotating credentials.
- Keep checked-in env overlays non-secret.
- Use framework path aliases instead of brittle relative imports where aliases exist.
- For UI work, follow the page-object lifecycle: singleton export, `bind(page)`, locators as arrow functions.
- For API work, reuse common steps and mutate `currentResponse` with `Object.assign`.

## Validate

Run the most relevant test first:

```bash
npm run test:api:feature -- "@gl-clients"
npm run test:ui:feature -- "@saucedemo"
```

Then run static checks:

```bash
npm run type-check
npm run lint
```

For feature-file changes, the `npm run test:*` scripts already regenerate BDD specs. If running Playwright directly, run the matching `bdd:gen:*` command first.

For documentation and agent-file work, also run:

```bash
npx prettier --check AGENTS.md CLAUDE.md README.md docs/*.md .github/**/*.md .agents/**/*.md .claude/**/*.md package.json
git diff --check
```

## Review Before Handoff

- Summarize what changed by behavior, not only by file list.
- Mention which checks ran and which did not.
- Call out environment-dependent failures separately from code failures.
- If staging or committing, stage only intentional changes.
- Keep local `.env`, `.env.local`, and `.claude/settings.local.json` private.
