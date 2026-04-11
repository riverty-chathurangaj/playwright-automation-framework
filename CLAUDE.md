# pw-testforge-gls — Claude Code Context

This is a **Playwright BDD API test automation framework** for the GL (General Ledger) service.

## Critical rules (always apply)

- Step files import `{ Given, When, Then }` from `../../fixtures` — never from `@cucumber/cucumber` or `playwright-bdd`
- Mutate `currentResponse` via `Object.assign(currentResponse, result)` — never reassign the variable
- Cast response body via `body as unknown as MyType[]` — never a direct cast
- Status codes in feature files use labels only: `OK`, `BadRequest`, `NotFound` — never raw numbers
- Run `npm run bdd:gen` after every change to a `.feature` file
- JSON schema nullable fields use `["type", "null"]` — not OpenAPI's `nullable: true`
- Always verify response shape against a live API run — the swagger.json may reference the wrong component schema
- Domain step files register endpoints via `registerTemplates()` from `@utils/request-templates` — never use inline `REQUEST_TEMPLATES` const
- Common steps in `src/steps/common/` must not be re-defined in domain files — check before adding

## Database — Azure SQL with Entra ID

- Database is **Azure SQL Database** (`rty-app-platform-dev-shared-sql.database.windows.net` / `general-ledger`)
- Auth is **Microsoft Entra ID passwordless** — no username/password, uses `@azure/identity` via `DefaultAzureCredential`
- Knex mssql config requires `type: 'azure-active-directory-default'` at **connection root level** (not nested under `authentication` — knex maps it internally via `_generateConnection()`)
- `DB_AUTH_TYPE` env var controls the auth mode: `default` (SQL auth) or `azure-active-directory-default`
- Large tables like `Data.Transaction` need a `CreatedDate` filter to avoid query timeouts
- The `Data.Transaction` table columns: `Id`, `PartitionId`, `InstanceId`, `BundleNumber`, `ClientId`, `OrgnoClient`, `EventId`, `EventCombinationId`, `EventCombinationNumber`, `PostingId`, `PostingNumber`, `AccountingYear`, `AccountingMonth`, `AccountingYearMonth`, `Account`, `Amount`, `AmountNotRounded`, `ReceiverBankAccount`, `CustomerGuid`, `CustomerNumber`, `InvoiceNumber`, `OrderNumber`, `MerchantId`, `VoucherGuid`, `VoucherAllocationGuid`, `VoucherDate`, `ParentTransactionReference`, `Reference`, `Reference2`, `CreatedDate`, `CreatedByUser`, `ApplicationId`, `TransactionRequestLogId`

## Messaging → DB verification pattern

After publishing a RabbitMQ message and confirming consumption, verify the resulting database transactions:

1. Store the message via `store('lastPublishedMessage', message)` (done by common message steps)
2. Extract `InstanceId`, `Reference`, `sentTime`, and `Amount` from the stored message
3. Poll `Data.Transaction` by `Reference + InstanceId + CreatedDate` cutoff, waiting until rows matching the exact `±Amount` appear in `AmountNotRounded`
4. Assert both a positive and negative entry exist with matching `BundleNumber`

**Important:** The message `Amount` (a number with up to 4 decimals) maps to the `AmountNotRounded` column — NOT `Amount`. The `Amount` column stores the rounded value.

**Polling caveat:** Old records may already exist for the same `Reference`. The polling loop must check for the specific amount match — not just `rows.length > 0`.

## Message factories

RabbitMQ message templates live in `src/models/test-data/factories/`. Each factory exports a builder function with an overrides parameter:

```typescript
// src/models/test-data/factories/book-client-deposit.factory.ts
buildBookClientDepositMessage(payloadOverrides?, messageId?)
// Amount is randomized via DataGenerator.amount() — always a number, never a string
```

## Key files

| File                                          | Purpose                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/fixtures/index.ts`                       | All fixtures + `{ Given, When, Then }` exports                                         |
| `src/steps/common/`                           | Shared steps: auth, api, schema, contract, database, message                           |
| `src/steps/<domain>/<domain>.steps.ts`        | `registerTemplates()` + send step + assertions                                         |
| `src/utils/request-templates.ts`              | Central template registry: `registerTemplates()`, `getTemplate()`, `resolveEndpoint()` |
| `src/utils/http-status.ts`                    | Status label → code map: `resolveStatus('OK')` → `200`                                 |
| `src/schemas/json-schemas/*.schema.json`      | JSON Schema Draft-07, `$id` = schema name                                              |
| `src/models/responses/*.response.ts`          | TypeScript interfaces for response bodies                                              |
| `src/models/test-data/fixtures/swagger.json`  | OpenAPI spec (starting point only — verify against actual API)                         |
| `src/models/test-data/factories/*.factory.ts` | Message/payload builders with randomized data + overrides                              |
| `src/database/db-client.ts`                   | Knex database client with Azure AD auth support                                        |
| `src/core/config.ts`                          | Config — all env vars with defaults (none strictly required)                           |
| `src/core/auth-manager.ts`                    | OAuth2 client_credentials + token cache + static token injection                       |
| `playwright.config.ts`                        | BDD wiring + project/tag mapping (10 domain projects)                                  |

## For full implementation patterns

Run `/framework-guide` in this session.
