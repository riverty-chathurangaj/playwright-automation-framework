---
applyTo: 'src/core/shared/**,config/**,.env.example,playwright.*.config.ts,package.json,tsconfig.json,.github/**,.agents/**,.claude/**,docs/**'
---

# Shared Runtime And Template Instructions

Follow `docs/framework-architecture.md`, `docs/implementation-patterns.md`, and `docs/agent-playbook.md`.

- Keep runtime config centralized in `src/core/shared/config.ts`.
- Keep checked-in env overlays non-secret.
- Never log secret values or commit local credentials.
- Preserve the DB secret-source contract: files, Vault, then env for `auto`; skip password bootstrap for Azure AD DB auth.
- Generated artifacts stay ignored: `.features-gen/`, `reports/`, `test-results/`, `playwright-report/`, `allure-results/`, `.auth/`, and `.playwright/`.
- Keep `.claude/settings.local.json` local-only.
- Agent-specific docs should stay short and link to canonical docs instead of duplicating long patterns.
- If changing scripts, keep `npm run test:*` wired to the matching `bdd:gen:*` command.
