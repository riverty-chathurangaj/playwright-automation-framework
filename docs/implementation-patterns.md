# Implementation Patterns

These patterns are the source of truth for AI agents and contributors working in this framework. Generic Playwright examples must be adapted to these rules.

## BDD Authoring Model

- Author behavior in `.feature` files.
- Generate specs with `npm run bdd:gen:api`, `npm run bdd:gen:ui`, or `npm run bdd:gen`.
- Do not add raw `tests/**/*.spec.ts` files as the primary test pattern.
- Do not edit `.features-gen/` directly.
- Every scenario gets one modality tag and one module tag.

Example tags:

```gherkin
@api @gl-clients @smoke
Scenario: Client list can be retrieved
```

```gherkin
@ui @saucedemo @smoke
Scenario: Standard user can sign in
```

## Step Definition Imports

API step files import from API fixtures:

```typescript
import { Given, When, Then } from '@api-fixtures';
```

UI step files import from UI fixtures:

```typescript
import { Given, When, Then } from '@ui-fixtures';
```

Never import BDD helpers directly from `playwright-bdd` in step files.

## API Endpoint Pattern

Create these artifacts for a new API endpoint or response shape:

1. response interface under `src/models/api/<module>/responses/<entity>.response.ts`
2. Draft-07 JSON schema under `src/schemas/api/<module>/json-schemas/<entity>.schema.json`
3. module step definitions under `src/steps/api/<module>/<domain>.steps.ts`

Register endpoint templates at module load:

```typescript
import { registerTemplates } from '@api-utils/request-templates';

registerTemplates({
  'orders request': '/{instanceId}/orders',
  'order by id request': '/{instanceId}/orders/{orderId}',
});
```

Reuse common API steps before adding new ones. Common API/auth/schema/contract/database/message steps live in `src/steps/api/common/**`.

## API State And Assertions

Mutate shared response state with `Object.assign`:

```typescript
Object.assign(currentResponse, await apiClient.get(endpoint, options, activeRole.value));
```

Never reassign `currentResponse`; that only rebinds the local parameter.

Use Chai in API step definitions because the API layer already uses Chai:

```typescript
import { expect } from 'chai';

expect(currentResponse.status).to.equal(200);
```

For array response bodies, double-cast:

```typescript
const body = currentResponse.body as unknown as OrderResponse[];
```

Feature files use status labels:

```gherkin
Then I get the response code of OK
```

Do not use numeric HTTP status text in Gherkin.

## JSON Schema Pattern

Use JSON Schema Draft-07. Nullable fields use a type array:

```json
{
  "type": ["string", "null"]
}
```

Do not use OpenAPI `nullable: true` in framework JSON schemas.

Schema files should describe objects, not root arrays. For array responses, use a feature/step combination that asserts the response is an array and then validates each item against the object schema.

## Messaging And Database Patterns

- Register RabbitMQ exchange labels in `src/core/api/messaging/exchanges.ts`.
- Use message schemas under `src/core/api/messaging/message-schemas/**`.
- Keep message test-data interfaces with the factory that builds the message.
- Database helpers live under `src/core/api/database/**`.
- Database credentials come from secret bootstrap, Azure AD auth, or env config; never hardcode rotating credentials.
- When polling persisted data, wait for the specific field/value needed by the scenario, not only for any row to exist.

## UI Page Object Pattern

Use `BasePage` and singleton instances:

```typescript
export class LoginPage extends BasePage {
  usernameInput = () => this.page.getByPlaceholder('Username');
  passwordInput = () => this.page.getByPlaceholder('Password');
  loginButton = () => this.page.getByRole('button', { name: 'Login' });

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput().fill(username);
    await this.passwordInput().fill(password);
    await this.loginButton().click();
  }
}

export const loginPage = new LoginPage();
```

Bind page objects per scenario from `src/fixtures/ui/index.ts`:

```typescript
loginPage.bind(page);
```

Do not instantiate `new LoginPage(page)` inside each step. Do not add one wrapper method for every click or fill. Keep simple interactions in step definitions and reserve page-object methods for compound user actions.

## UI Locators And Waiting

Adapted from general Playwright best practices, but scoped to this framework:

- Prefer semantic locators in page objects: role, label, placeholder, text, then test id.
- Use CSS or XPath only when semantic locators are not possible.
- Define locators as arrow functions so they always use the currently bound page.
- Use Playwright web-first assertions for UI checks.
- Trust Playwright auto-waiting for actions.
- Avoid `waitForTimeout`; wait for a specific URL, response, locator state, count, or text.
- Use traces, screenshots, and `test-results/` artifacts when debugging flaky UI tests.

Example UI assertion in a step:

```typescript
import { Then } from '@ui-fixtures';
import { expect } from '@playwright/test';
import { inventoryPage } from '@ui-pages/saucedemo/inventory.page';

Then('I should see the inventory page', async function () {
  await expect(inventoryPage.title()).toHaveText('Products');
});
```

## Path Aliases

Use the modality-aware aliases from `tsconfig.json`:

| Alias              | Resolves to                 |
| ------------------ | --------------------------- |
| `@api-core/*`      | `src/core/api/*`            |
| `@ui-core/*`       | `src/core/ui/*`             |
| `@shared-core/*`   | `src/core/shared/*`         |
| `@api-database/*`  | `src/core/api/database/*`   |
| `@api-messaging/*` | `src/core/api/messaging/*`  |
| `@api-utils/*`     | `src/core/api/utils/*`      |
| `@api-fixtures`    | `src/fixtures/api/index.ts` |
| `@ui-fixtures`     | `src/fixtures/ui/index.ts`  |
| `@api-models/*`    | `src/models/api/*`          |
| `@api-schemas/*`   | `src/schemas/api/*`         |
| `@ui-pages/*`      | `src/pages/ui/*`            |

## Validation Commands

Use the narrowest relevant command first, then static checks:

```bash
npm run test:api:feature -- "@gl-clients"
npm run test:ui:feature -- "@saucedemo"
npm run type-check
npm run lint
```

Run `npm run clean` to remove generated specs, reports, auth state, and Playwright artifacts.

## Anti-Patterns

| Avoid                                         | Use Instead                                       |
| --------------------------------------------- | ------------------------------------------------- |
| raw `tests/**/*.spec.ts` as default authoring | `.feature` files plus step definitions            |
| step imports from `playwright-bdd`            | `@api-fixtures` or `@ui-fixtures`                 |
| `currentResponse = result`                    | `Object.assign(currentResponse, result)`          |
| `body as MyType[]`                            | `body as unknown as MyType[]`                     |
| `nullable: true`                              | `"type": ["string", "null"]`                      |
| Zod schemas for API contracts                 | Ajv Draft-07 JSON schemas                         |
| generic Playwright API `request` tests        | framework `ApiClient`, fixtures, and common steps |
| `new PageObject(page)` in every UI step       | singleton page objects plus `bind(page)`          |
| CSS-first UI selectors                        | semantic locators first                           |
| `waitForTimeout`                              | web-first assertions or explicit condition waits  |
| tags in Playwright `test()` titles            | tags in Gherkin scenarios/features                |
