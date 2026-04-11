# GL Service API — Reference Documentation

> **Source:** Derived from Swagger spec (`/gl-service/swagger/v1/swagger.json`),
> the .NET test automation suite (`GeneralLedger.TestAutomationSuite`), and
> observed API behaviour during test execution.
>
> **Base URL:** Environment-specific — resolved at runtime from `TEST_ENV`
> and `config/environments/<env>.env`
> **Auth:** OAuth2 Client Credentials — Bearer token required on all endpoints

---

## Architecture Overview

The GL (General Ledger) Service is a **multi-tenant financial API**. All
transaction, account, and balance data belongs to a specific **Instance** — a
logical tenant representing a country/legal entity within Riverty. Most
endpoints require an `{instanceId}` path parameter.

```
GET /gl-service/{instanceId}/accounts
GET /gl-service/{instanceId}/balance
GET /gl-service/{instanceId}/transactions
...
```

Valid instance IDs are an enum:
`1001, 1002, 1003, 1004, 1021, 1022, 1023, 2001, 2002, 2003, 2004, 2021, 2022, 2023, 2024`

Passing an ID outside this enum currently causes the API to throw an unhandled
internal exception (HTTP 500) rather than returning 400 — this is a known bug.

---

## Authentication

All endpoints require a Bearer token obtained via OAuth2 Client Credentials:

```http
POST https://<identity-host>/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>",
  "audience": "https://<api-audience>"
}
```

The `audience` field is **mandatory** — omitting it causes the IdP to return an
encrypted JWE instead of a plain JWT, which the GL Service rejects.

**Without a token:** returns `401 Unauthorized`
**With an invalid/expired token:** returns `403 Forbidden` (Envoy gateway
behaviour — it validates the token presence but returns 403 rather than 401 for
malformed credentials)

---

## Endpoint Groups

---

### 1. Instances

Instances are the top-level tenants of the GL Service. Each instance
corresponds to a Riverty legal entity in a specific country.

#### `GET /gl-service/instances`

Returns a list of all GL instances registered in the system.

**Response shape:**

```json
[
  {
    "id": 2022,
    "name": "Riverty NO",
    "sourceSystemId": 15,
    "countryCode": "NO",
    "countryId": 3,
    "isActive": true
  }
]
```

| Field            | Type          | Description                                                 |
| ---------------- | ------------- | ----------------------------------------------------------- |
| `id`             | integer       | Instance ID — used as path parameter in all other endpoints |
| `name`           | string\|null  | Human-readable name of the instance/entity                  |
| `sourceSystemId` | integer\|null | ID of the upstream source system feeding this instance      |
| `countryCode`    | string\|null  | ISO country code (e.g. `NO`, `SE`, `DE`)                    |
| `countryId`      | integer\|null | Internal country identifier                                 |
| `isActive`       | boolean       | Whether the instance is currently active                    |

**Observed behaviour:** Returns 401 without a token, 403 with an invalid token,
200 or 403 with a valid M2M token (permissions depend on the client's scopes).

---

#### `GET /gl-service/instances/{id}`

Returns a single instance by its numeric ID.

**Path parameter:** `id` — integer, required

---

#### `GET /gl-service/instances/source-system/{sourceSystemId}/id`

Looks up an instance ID by the source system's identifier. Useful when
integrating with upstream systems that use their own IDs.

**Path parameter:** `sourceSystemId` — integer, required

---

#### `PUT /gl-service/instances/{id}/activate`

Activates an instance (sets `isActive = true`). Administrative operation.

---

#### `PUT /gl-service/instances/{id}/deactivate`

Deactivates an instance (sets `isActive = false`). Administrative operation.

---

### 2. Accounts

GL accounts are the chart of accounts for a given instance. Each account has
a code and description. They are the building blocks against which postings
and transactions are recorded.

#### `GET /gl-service/{instanceId}/accounts`

Returns the full list of GL accounts for the instance.

**Query parameters:**

| Parameter | Type   | Required | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `orderBy` | string | No       | Sort field (e.g. `account`) |

**Response shape:**

```json
[
  {
    "account": "1000",
    "description": "Cash and cash equivalents"
  }
]
```

| Field         | Type         | Description                             |
| ------------- | ------------ | --------------------------------------- |
| `account`     | string\|null | Account code / chart of accounts number |
| `description` | string\|null | Human-readable account description      |

**Notes:**

- Returns a flat list — no hierarchy or balance information here
- The account codes observed in real data follow numeric conventions
  (e.g. `1000`, `1500`, `2100`)
- Requesting with an invalid `instanceId` (not in the enum) causes a 500
  Internal Server Error instead of 400 — API bug

---

#### `GET /gl-service/{instanceId}/accounts/{postingId}`

Returns accounts filtered by a specific **posting definition ID**. A posting
is a rule that maps events to GL accounts — this endpoint returns the
accounts associated with a given posting rule.

**Path parameters:**

| Parameter    | Type    | Description                         |
| ------------ | ------- | ----------------------------------- |
| `instanceId` | integer | Instance ID                         |
| `postingId`  | integer | ID of the posting rule to filter by |

**Notes:**

- Returns 404 (`"Posting not found for Id {postingId}"`) if no posting with
  that ID exists for the instance
- To find valid posting IDs, first call `GET /{instanceId}/postings`

---

### 3. Balance

The balance endpoints aggregate financial positions across GL accounts. They
answer questions like: _"What was the opening balance, how much changed, and
what is the closing balance for these accounts in this period?"_

#### `GET /gl-service/{instanceId}/balance`

Returns aggregated account balances for the instance, with optional filters.

**Query parameters:**

| Parameter                 | Type     | Required | Description                                     |
| ------------------------- | -------- | -------- | ----------------------------------------------- |
| `accountfrom`             | string   | No       | Start of account code range (inclusive)         |
| `accountto`               | string   | No       | End of account code range (inclusive)           |
| `orgnoClient`             | string   | No       | Filter to a specific client organisation number |
| `accountingYearMonthFrom` | integer  | No       | Start period in `YYYYMM` format (e.g. `202501`) |
| `accountingYearMonthTo`   | integer  | No       | End period in `YYYYMM` format                   |
| `balancedateFrom`         | datetime | No       | Start date for balance date filter              |
| `balancedateTo`           | datetime | No       | End date for balance date filter                |
| `clientId`                | integer  | No       | Internal client ID filter                       |

**Response shape:**

```json
[
  {
    "account": "1500",
    "accountName": "Trade Receivables",
    "inBalance": 150000.0,
    "balanceChange": -25000.0,
    "outBalance": 125000.0
  }
]
```

| Field           | Type         | Description                                                                                                |
| --------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `account`       | string\|null | Account code                                                                                               |
| `accountName`   | string\|null | Account description                                                                                        |
| `inBalance`     | number       | Opening balance for the period (double precision)                                                          |
| `balanceChange` | number       | Net change during the period (positive = credit, negative = debit or vice versa depending on account type) |
| `outBalance`    | number       | Closing balance (`inBalance + balanceChange`)                                                              |

**Notes:**

- All three balance fields are always present — never null
- With no filters, returns all accounts with any movement
- With `accountingYearMonthFrom` only, returns from that period to present
- `inBalance + balanceChange = outBalance` — this relationship can be used
  to verify data consistency in tests
- Requesting with `instanceId=99999` (invalid) returns **200 with empty array**
  rather than 400 — the API silently ignores unknown instances on this endpoint
  (different behaviour to `/accounts` which returns 500)

---

#### `GET /gl-service/{instanceId}/balance/listing`

Returns a more detailed balance listing that includes client-level breakdown.
Extends the basic balance response with client/organisation information and
daily breakdown.

**Query parameters:** Same as `/balance`

**Response shape:**

```json
[
  {
    "account": "1500",
    "accountName": "Trade Receivables",
    "orgnoClient": "20183010-01",
    "clientName": "Acme AS",
    "inBalance": 15000.0,
    "balanceChange": -2500.0,
    "outBalance": 12500.0,
    "date": "2025-01-31T00:00:00Z",
    "accountingYearMonth": 202501,
    "ssoNumber": "SSO-001"
  }
]
```

| Field                 | Type              | Description                          |
| --------------------- | ----------------- | ------------------------------------ |
| `account`             | string\|null      | Account code                         |
| `accountName`         | string\|null      | Account description                  |
| `orgnoClient`         | string\|null      | Client's organisation number         |
| `clientName`          | string\|null      | Client's name                        |
| `inBalance`           | number            | Opening balance                      |
| `balanceChange`       | number            | Net change                           |
| `outBalance`          | number            | Closing balance                      |
| `date`                | string (datetime) | Balance date                         |
| `accountingYearMonth` | integer\|null     | Accounting period in `YYYYMM` format |
| `ssoNumber`           | string\|null      | SSO reference number                 |

**Notes:**

- More granular than `/balance` — one row per account per client per date
- Useful for per-client financial reporting

---

#### `GET /gl-service/{instanceId}/balance/ClientBalance`

Returns balances filtered for a specific client, optionally across specific
accounts and accounting periods. Purpose-built for client-facing balance views.

**Query parameters:**

| Parameter             | Type     | Required | Description                                            |
| --------------------- | -------- | -------- | ------------------------------------------------------ |
| `clientId`            | integer  | No       | Internal client ID                                     |
| `account`             | string[] | No       | Array of account codes to include                      |
| `accountingYearMonth` | integer  | No       | Specific period in `YYYYMM`                            |
| `isSettlementPartner` | boolean  | No       | Filter for settlement partner clients (default: false) |

---

#### `POST /gl-service/{instanceId}/balance/ReconciliationJob`

Triggers a reconciliation job for the instance. This is an asynchronous
administrative operation that recalculates and reconciles balance figures.

**Notes:**

- No request body required
- Likely returns immediately while the job runs in the background

---

### 4. Transactions

Transactions are the individual financial entries recorded in the general
ledger — the raw movement of money. Each transaction is tied to a GL account,
a client, a voucher, and an accounting period.

#### `GET /gl-service/{instanceId}/transactions`

Returns a list of GL transactions for the instance, with rich filtering
capabilities. This is the primary data-retrieval endpoint for financial
reporting and audit.

**Query parameters:**

| Parameter                 | Type            | Required  | Description                            |
| ------------------------- | --------------- | --------- | -------------------------------------- |
| `accountingYearMonthFrom` | integer         | **Yes\*** | Start period `YYYYMM`                  |
| `accountingYearMonthTo`   | integer         | **Yes\*** | End period `YYYYMM`                    |
| `noOfRows`                | integer         | No        | Maximum rows to return (default: 1000) |
| `accountFrom`             | string          | No        | Start of account code range            |
| `accountTo`               | string          | No        | End of account code range              |
| `orgnoClient`             | string          | No        | Filter by client organisation number   |
| `department`              | string          | No        | Filter by department                   |
| `insFrom`                 | datetime        | No        | Filter by insertion timestamp (from)   |
| `insTo`                   | datetime        | No        | Filter by insertion timestamp (to)     |
| `voucherDateFrom`         | datetime        | No        | Filter by voucher date (from)          |
| `voucherDateTo`           | datetime        | No        | Filter by voucher date (to)            |
| `bundleNoFrom`            | number          | No        | Filter by bundle number range (from)   |
| `bundleNoTo`              | number          | No        | Filter by bundle number range (to)     |
| `postingNo`               | integer         | No        | Filter by posting type number          |
| `customerNo`              | string          | No        | Filter by customer number              |
| `bookingId`               | integer (int64) | No        | Filter by specific booking ID          |
| `clientId`                | integer         | No        | Internal client ID filter              |
| `orderBy`                 | string          | No        | Sort order                             |

> \*Required in practice — the .NET test suite always provides both. Without
> them the query may return too many rows or time out.

**Response shape:**

```json
[
  {
    "voucherNo": 1234567,
    "clientOrgNo": "20183010-01",
    "clientName": "Acme AS",
    "bundleNo": 1001.0,
    "registrationDate": "2024-07-15T08:23:11Z",
    "registrationBy": "system",
    "voucherDate": "2024-07-15T00:00:00Z",
    "accountingYearMonth": 202407,
    "postingNo": 10,
    "postingName": "Payment received",
    "glAccount": "1500",
    "glAccountName": "Trade Receivables",
    "amount": -1500.0,
    "customerNo": "CUST-001",
    "invoiceNo": "INV-2024-001",
    "paymentDate": "2024-07-14T00:00:00Z",
    "settlementDate": null,
    "reference": "PAY-001",
    "bankAccount": null,
    "eventVariantId": null,
    "count": null,
    "ssoNumber": "SSO-001"
  }
]
```

| Field                 | Type            | Description                                                           |
| --------------------- | --------------- | --------------------------------------------------------------------- |
| `voucherNo`           | integer (int64) | Unique voucher number — the document ID                               |
| `clientOrgNo`         | string\|null    | Client organisation number (e.g. `20183010-01`)                       |
| `clientName`          | string\|null    | Client name                                                           |
| `bundleNo`            | number          | Bundle number — groups related transactions                           |
| `registrationDate`    | datetime        | When the transaction was recorded in the system                       |
| `registrationBy`      | string\|null    | User/system that registered the transaction                           |
| `voucherDate`         | datetime        | The accounting date of the transaction                                |
| `accountingYearMonth` | integer         | Period in `YYYYMM` format                                             |
| `postingNo`           | integer         | Posting rule number that generated this entry                         |
| `postingName`         | string\|null    | Name of the posting rule                                              |
| `glAccount`           | string\|null    | GL account code                                                       |
| `glAccountName`       | string\|null    | GL account description                                                |
| `amount`              | number          | Transaction amount (negative = debit from account, positive = credit) |
| `customerNo`          | string\|null    | Customer reference number                                             |
| `invoiceNo`           | string\|null    | Invoice reference                                                     |
| `paymentDate`         | datetime\|null  | Date payment was received/made                                        |
| `settlementDate`      | datetime\|null  | Date the transaction was settled                                      |
| `reference`           | string\|null    | Free-text reference                                                   |
| `bankAccount`         | string\|null    | Bank account reference                                                |
| `eventVariantId`      | integer\|null   | ID of the business event variant that triggered this entry            |
| `count`               | integer\|null   | Item count (context-dependent)                                        |
| `ssoNumber`           | string\|null    | SSO (Single Sign-On or Settlement) reference                          |

**Key observations from test data:**

- `clientOrgNo` uses a `{number}-{suffix}` format in real data (e.g. `20183010-01`),
  not plain integers — filtering by `orgnoClient=2022` returns no results on real data
- `noOfRows` is a hard limit — if fewer records exist than the limit, fewer are returned;
  if more exist, exactly `noOfRows` are returned (confirmed in tests: `noOfRows=10`
  returns exactly 10 items)
- `amount` can be negative — the sign convention depends on the posting rule and account type
- Multiple instances carry independent transaction ledgers — the same
  voucher number can appear in different instances

---

#### `GET /gl-service/{instanceId}/transactions/{id}`

Returns a single transaction by its ID.

**Path parameters:**

| Parameter    | Type    | Description         |
| ------------ | ------- | ------------------- |
| `instanceId` | string  | Instance identifier |
| `id`         | integer | Transaction ID      |

---

### 5. Clients

#### `GET /gl-service/{instanceId}/clients`

Returns a list of clients (organisations/companies) registered under the
instance.

**Query parameters:**

| Parameter  | Type    | Description                      |
| ---------- | ------- | -------------------------------- |
| `orderBy`  | string  | Sort field                       |
| `isActive` | boolean | Filter by active/inactive status |

**Response shape:**

```json
[
  {
    "orgno": "20183010-01",
    "globalId": 4521,
    "name": "Acme AS"
  }
]
```

| Field      | Type          | Description                                                        |
| ---------- | ------------- | ------------------------------------------------------------------ |
| `orgno`    | string\|null  | Organisation number — corresponds to `clientOrgNo` in transactions |
| `globalId` | integer\|null | Global client identifier across instances                          |
| `name`     | string\|null  | Client name                                                        |

---

#### `GET /gl-service/{instanceId}/clients/departments`

Returns the list of departments within the instance. Departments are used to
sub-categorise client activity and can be used as a filter in the transactions
endpoint.

---

### 6. Postings

Postings (also called "posting rules" or "posting definitions") are the
configuration that maps business events to GL account entries. When a business
event occurs (e.g. a payment is received), the posting rules determine which
GL accounts are debited and credited, by what amount, and how.

#### `GET /gl-service/{instanceId}/postings`

Returns the list of posting definitions for the instance.

**Query parameters:** `orderBy` (optional)

**Response shape:**

```json
[
  {
    "id": 1,
    "postingId": 10,
    "number": 10,
    "name": "Payment received",
    "description": "Records receipt of customer payment",
    "reno_AccountPlan": 3
  }
]
```

| Field              | Type          | Description                                                         |
| ------------------ | ------------- | ------------------------------------------------------------------- |
| `id`               | integer       | Internal record ID                                                  |
| `postingId`        | integer       | Posting rule identifier — referenced in transactions as `postingNo` |
| `number`           | integer\|null | Display number                                                      |
| `name`             | string\|null  | Rule name                                                           |
| `description`      | string\|null  | Detailed description                                                |
| `reno_AccountPlan` | integer       | Account plan (chart of accounts version) this rule belongs to       |

**Notes:**

- `postingNo` on a transaction corresponds to `postingId` here — use this endpoint
  to look up what a posting number means
- Valid `postingId` values are needed for the `GET /accounts/{postingId}` endpoint

---

### 7. Rules & Events

The rules engine defines how business events translate into GL postings.
Each event has variants, and each variant has posting rules that specify
which accounts to use and how to calculate amounts.

#### `GET /gl-service/{instanceId}/rules/{accountPlanId}/events`

Returns all event definitions for a given account plan.

**Path parameters:** `instanceId`, `accountPlanId` (integer)

**Response shape:**

```json
[
  {
    "instanceId": 2022,
    "accountPlanId": 3,
    "eventId": 101,
    "eventName": "PaymentReceived",
    "eventRules": [
      {
        "eventCombinationId": 1,
        "defaultCombination": true,
        "ruleExpression": "Amount > 0",
        "postings": ["P10", "P20"]
      }
    ]
  }
]
```

| Field                             | Type         | Description                                                             |
| --------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `eventId`                         | integer      | Unique event identifier                                                 |
| `eventName`                       | string\|null | Name of the business event                                              |
| `eventRules`                      | array        | Conditional rules that apply different postings based on the event data |
| `eventRules[].defaultCombination` | boolean      | Whether this rule is the fallback when no conditions match              |
| `eventRules[].ruleExpression`     | string\|null | Boolean condition evaluated against the event payload                   |
| `eventRules[].postings`           | string[]     | List of posting codes to apply when this rule matches                   |

---

#### `GET /gl-service/{instanceId}/rules/{accountPlanId}/events/{eventId}`

Returns a single event definition by ID.

---

#### `GET /gl-service/{instanceId}/rules/postings`

Returns all posting rule definitions for the instance.

---

#### `GET /gl-service/{instanceId}/rules/postings/{postingId}`

Returns a specific posting rule, including the account assignments and
amount calculation factors.

**Response shape:**

```json
{
  "instanceId": 2022,
  "postingId": 10,
  "name": "Payment received",
  "postingNo": 10,
  "postingRules": [
    {
      "account": "1500",
      "selectAmount": "PaymentAmount",
      "parameterId": 1,
      "factor": -1,
      "percentFactor": 100,
      "amountType": 1
    }
  ]
}
```

| Field                          | Type           | Description                              |
| ------------------------------ | -------------- | ---------------------------------------- |
| `postingRules[].account`       | string\|null   | GL account to post to                    |
| `postingRules[].selectAmount`  | string\|null   | Which amount field from the event to use |
| `postingRules[].factor`        | integer\|null  | Multiplier (e.g. `-1` inverts sign)      |
| `postingRules[].percentFactor` | integer\|null  | Percentage to apply                      |
| `postingRules[].amountType`    | enum (1, 2, 3) | How the amount is calculated             |

---

### 8. General Ledger — Bundle Number

#### `GET /gl-service/{instanceId}/generalledger/bundlenumber`

Returns the next available bundle number in the sequence for the instance.
Bundle numbers group related transactions together — a "bundle" represents a
single business document (e.g. a payment batch) that may create multiple
GL entries.

**BundleSeries enum values:** `0, 10, 11, 12, ..., 31`

---

### 9. Accounting Month

#### `POST /gl-service/{instanceId}/AccountingMonth/Close`

Closes the current accounting month for the instance. This is an administrative
operation that prevents new postings for the closed period and triggers
period-end calculations.

**Notes:**

- Irreversible administrative action — should only be called at period-end
- No request body required

---

### 10. SAP Integration

These endpoints expose GL data in SAP-compatible formats for integration with
SAP ERP systems. They return the same financial data as the core endpoints
but structured according to SAP conventions.

#### `GET /gl-service/{instanceId}/sap/journalentries`

Returns journal entries in SAP format. A journal entry in SAP represents a
complete accounting document with header and line items.

**Query parameters (extensive):**

| Parameter                 | Type     | Description                 |
| ------------------------- | -------- | --------------------------- |
| `clientId`                | integer  | Filter by client            |
| `orgnoClient`             | string   | Filter by client org number |
| `ssoNumber`               | string   | Filter by SSO number        |
| `groupReferences`         | string   | Filter by group reference   |
| `status`                  | string   | Filter by status            |
| `companyCode`             | string   | SAP company code            |
| `businessTransactionType` | string   | SAP transaction type        |
| `accountingDocumentType`  | string   | SAP document type           |
| `postingDateFrom/To`      | datetime | Posting date range          |
| `documentDateFrom/To`     | datetime | Document date range         |
| `createdDateFrom/To`      | datetime | Creation date range         |

**Response fields include:**

- `id`, `clientId`, `groupReferences`, `status`
- `accountingDocument`, `companyCode`, `accountingDocumentType`
- `businessTransactionType`, `originalReferenceDocumentType`
- `documentReferenceID`, `documentHeaderText`
- `documentDate`, `postingDate`, `exchangeRateDate`

**Note:** `instanceId` for SAP endpoints must be from the `GLInstance` enum — the
same values as other endpoints.

---

#### `GET /gl-service/{instanceId}/sap/bookings`

Returns SAP bookings (line items within a journal entry). A booking is a
single debit or credit line in an accounting document.

**Query parameters:**

- `id` — specific booking ID
- `journalEntryId` — all bookings for a journal entry

**Key fields:** `assignmentReference`, `currencyCode`, `debitCreditCode`,
`documentItemText`, `lineItemNumber`, `sapAccount`, `amountInCompanyCodeCurrency`,
`amountInTransactionCurrency`, `postingDate`

---

#### `GET /gl-service/{instanceId}/sap/producttax`

Returns product tax entries associated with SAP journal entries. Captures
VAT/tax calculations including corrections and deviations.

**Key fields:** `taxCode`, `sapAccount`, `taxBaseAmount`, `taxAmount`,
`correctedVAT`, `vatDeviation`, `isTaxAccount`

---

#### `GET /gl-service/{instanceId}/sap/transactions`

Returns SAP booking transactions — the lowest-level data linking GL
transactions to SAP bookings.

**Query parameters:** `bookingId`

---

### 11. Data Synchronisation

#### `GET /gl-service/data-sync/logs`

Returns synchronisation logs across all entities. Used to monitor the
pipeline that feeds data from upstream source systems into the GL Service.

---

#### `GET /gl-service/data-sync/logs/{entityName}`

Returns sync logs for a specific entity type (e.g. `Transaction`, `Client`).

---

#### `GET /gl-service/data-sync/logs/errors`

Returns only error entries from the sync logs. Use this to detect data
pipeline failures — if this returns entries, it indicates upstream data
has not been successfully imported.

---

### 12. Health

#### `GET /gl-service/health`

Returns a comprehensive health check response showing the status of all
system dependencies (databases, etc.).

```json
{
  "Entries": {
    "DbContext": {
      "Data": {},
      "Duration": "00:00:00.0123456",
      "Status": "Healthy",
      "Tags": []
    }
  },
  "Status": "Healthy",
  "TotalDuration": "00:00:00.0123456"
}
```

---

#### `GET /gl-service/health/ping`

Simple liveness check. Returns immediately with a message confirming the
service is running. Does **not** check downstream dependencies.

---

#### `GET /gl-service/health/ping-mi`

Checks connectivity to the MI (Management Infrastructure) system.

---

#### `GET /gl-service/health/ping-mi-getconnectionstrings`

Validates connection string retrieval from MI — useful for diagnosing
configuration issues in infrastructure.

---

## Known API Behaviour & Bugs

| Endpoint                                        | Observed Behaviour                                      | Expected Behaviour                        |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| Any `/{instanceId}/...` with invalid instanceId | Returns `500 Internal Server Error` (EF Core exception) | Should return `400 Bad Request`           |
| `/balance` with unknown instanceId              | Returns `200` with empty array                          | Should return `400 Bad Request`           |
| Token without `audience` field                  | IdP returns encrypted JWE                               | N/A — client must always include audience |
| Invalid token                                   | Envoy returns `403 Forbidden`                           | HTTP standard would be `401 Unauthorized` |

---

## Test Coverage Summary

| Endpoint                                  | Smoke | Regression       | Schema | Negative |
| ----------------------------------------- | ----- | ---------------- | ------ | -------- |
| `GET /instances`                          | ✓     | —                | —      | —        |
| `GET /{instanceId}/accounts`              | ✓     | ✓                | ✓      | ✓        |
| `GET /{instanceId}/accounts/{postingId}`  | —     | —                | —      | ✓        |
| `GET /{instanceId}/balance`               | ✓     | ✓                | ✓      | ✓        |
| `GET /{instanceId}/balance/listing`       | ✓     | ✓                | ✓      | —        |
| `GET /{instanceId}/balance/ClientBalance` | ✓     | ✓                | —      | —        |
| `GET /{instanceId}/transactions`          | —     | ✓ (×9 instances) | ✓      | —        |
| Security (auth/no-auth)                   | ✓     | ✓                | —      | —        |

---

_Generated from: Swagger spec v1, .NET TestAutomationSuite, and live API observation._
_Last updated: 2026-03-12_
