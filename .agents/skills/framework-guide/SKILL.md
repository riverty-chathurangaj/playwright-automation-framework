---
name: framework-guide
description: riverty-playwright-bdd framework guide. Use when implementing or reviewing API/UI BDD features, Playwright step definitions, page objects, schemas, models, fixtures, Vault-backed config, or framework architecture in this repository.
user-invocable: true
disable-model-invocation: false
---

# riverty-playwright-bdd Framework Guide

Use this skill for any framework implementation, review, cleanup, or onboarding task in this repository.

## Read Order

1. `docs/framework-architecture.md` for the system shape and runtime flow.
2. `docs/implementation-patterns.md` for coding and test-authoring rules.
3. `docs/agent-playbook.md` for safe agent workflow and validation.

## Rules To Keep In Working Memory

- Tests are authored as `.feature` files plus step definitions; generated `.features-gen/` files are not edited.
- API steps import BDD helpers from `@api-fixtures`.
- UI steps import BDD helpers from `@ui-fixtures`.
- API step definitions mutate `currentResponse` with `Object.assign`.
- API contracts use TypeScript response interfaces plus Ajv Draft-07 JSON schemas.
- UI page objects are singleton exports rebound per scenario with `bind(page)`.
- Prefer semantic UI locators and web-first assertions; avoid `waitForTimeout`.
- Local secrets, generated reports, traces, auth state, and `.claude/settings.local.json` are not template assets.

When external Playwright best practices are useful, adapt them to this framework's BDD, fixture, and page-object patterns before applying them.
