# GitHub Copilot Instructions

This repository is a BDD-only Playwright framework for API and UI automation. Before making changes, use these canonical docs:

- `docs/framework-architecture.md`
- `docs/implementation-patterns.md`
- `docs/agent-playbook.md`

## Core Rules

- Author tests as `.feature` files plus step definitions. Do not add raw `tests/**/*.spec.ts` files as the default pattern.
- API steps import from `@api-fixtures`; UI steps import from `@ui-fixtures`.
- API response state is mutated with `Object.assign(currentResponse, result)`.
- Feature files use status labels like `OK` and `BadRequest`, not numeric status codes.
- API schemas use Ajv Draft-07 JSON schema files, not Zod.
- UI page objects are singleton exports rebound per scenario with `bind(page)`.
- Prefer semantic UI locators and Playwright web-first assertions. Avoid `waitForTimeout`.
- Do not edit `.features-gen/` directly.

## Validation

Use focused commands first, then static checks:

```bash
npm run test:api:feature -- "@gl-clients"
npm run test:ui:feature -- "@saucedemo"
npm run type-check
npm run lint
```

`npm run test:*` scripts already run BDD generation. If running bare Playwright commands, run the matching `npm run bdd:gen:*` first.
