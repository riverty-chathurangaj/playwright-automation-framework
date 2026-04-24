---
applyTo: 'features/ui/**,src/steps/ui/**,src/fixtures/ui/**,src/core/ui/**,src/pages/ui/**'
---

# UI BDD Instructions

Follow `docs/implementation-patterns.md` for UI changes.

- Author UI tests as Gherkin under `features/ui/**`, not raw Playwright specs.
- Import BDD helpers from `@ui-fixtures`.
- Use page objects under `src/pages/ui/<module>/**`.
- Export singleton page-object instances and rebind them per scenario with `bind(page)`.
- Define locators as arrow functions.
- Prefer role, label, placeholder, and text locators before test ids.
- Use CSS and XPath only as last resort.
- Keep simple click/fill actions in step definitions.
- Use page-object methods for meaningful compound user flows.
- Use Playwright `expect` for UI assertions and avoid `waitForTimeout`.
- Put tags in Gherkin: each scenario needs `@ui` plus a module tag such as `@saucedemo`.
