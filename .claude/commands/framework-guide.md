# riverty-playwright-bdd Framework Guide

Use this command when working on the Playwright BDD automation framework.

Read these files before implementing:

- `docs/framework-architecture.md`
- `docs/implementation-patterns.md`
- `docs/agent-playbook.md`

Core rules:

- Author `.feature` files plus step definitions.
- API steps import from `@api-fixtures`.
- UI steps import from `@ui-fixtures`.
- Mutate API `currentResponse` with `Object.assign`.
- Use Draft-07 JSON schemas for API contracts.
- Use singleton UI page objects rebound with `bind(page)`.
- Do not edit `.features-gen/` directly.
