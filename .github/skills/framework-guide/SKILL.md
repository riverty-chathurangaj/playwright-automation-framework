---
name: framework-guide
description: riverty-playwright-bdd framework guide. Use when implementing or reviewing API/UI BDD features, Playwright step definitions, page objects, schemas, models, fixtures, Vault-backed config, or framework architecture in this repository.
---

# riverty-playwright-bdd Framework Guide

Use the canonical docs instead of duplicating long patterns here:

- `docs/framework-architecture.md`
- `docs/implementation-patterns.md`
- `docs/agent-playbook.md`

Key reminders:

- Author `.feature` files and step definitions, not raw Playwright specs.
- API steps use `@api-fixtures`; UI steps use `@ui-fixtures`.
- Mutate API `currentResponse` with `Object.assign`.
- Use Ajv Draft-07 JSON schemas for API contracts.
- UI page objects are singleton exports rebound with `bind(page)`.
- Generated artifacts and local settings are not source files.
