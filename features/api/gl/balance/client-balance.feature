@api @gl-balance
Feature: Balance — Client Balance
  As a user of the GL API
  I should be able to retrieve client balance information for a given client

  Background:
    Given I am authenticated as "a valid client"

  # ── Happy Path ────────────────────────────────────────────────────────────────
  # These tests verify the core functionality with valid inputs.

  @api @gl-balance @smoke
  Scenario: Get client balance for the configured instance returns OK
    When I define a GET "client balance request"
    Then I send the client balance request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-account-balance"

  @api @gl-balance
  Scenario: Filter client balance by clientId returns OK
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | clientId |
      | 1        |
    Then I send the client balance request to the API
    And I get the response code of OK

  @api @gl-balance
  Scenario: Filter client balance by accounting year-month returns OK
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | accountingYearMonth |
      | 202401              |
    Then I send the client balance request to the API
    And I get the response code of OK

  @api @gl-balance
  Scenario: Filter client balance by isSettlementPartner flag returns OK
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | isSettlementPartner |
      | true                |
    Then I send the client balance request to the API
    And I get the response code of OK

  # ── Negative & Validation Scenarios ──────────────────────────────────────────
  # These tests verify proper error handling for invalid inputs.

  @api @gl-balance @fixme #TODO: The API responds with 500 instead of 400 or 404
  Scenario: Request with an invalid instanceId returns BadRequest
    When I define a GET "client balance request"
    And I set "instanceId" to "99999"
    Then I send the client balance request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  @api @gl-balance
  Scenario: Request with a non-existent clientId returns empty array or error
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | clientId |
      | 999999   |
    Then I send the client balance request to the API
    And the response status should be OK or NotFound
    #TODO: Clarify expected behaviour — empty array (200) vs 404 for unknown clientId

  @api @gl-balance @fixme #TODO: The API responds with 200 + empty array instead of 400 or 404
  Scenario: Request with invalid accountingYearMonth value returns BadRequest
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | accountingYearMonth |
      | 999999              |
    Then I send the client balance request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  # ── Invalid Input Tests ────────────────────────────────────────────────
  # These tests send values of the wrong type or semantically invalid values.
  @api @gl-balance
  Scenario Outline: GET client balance with invalid format of instanceId values
    When I define a GET "client balance request"
    And I set "instanceId" to "<value>"
    Then I send the client balance request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | value |
      | null  |
      | abc   |
      | 1.5   |
      | @!$   |

    @fixme
    Examples:
      | value |
      | -1    |

  @api @gl-balance
  Scenario Outline: GET client balance with invalid format of clientId values
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | clientId   |
      | <clientId> |
    Then I send the client balance request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | clientId |
      | null     |
      | abc      |
      | 1.5      |
      | @!$      |

    @fixme
    Examples:
      | clientId |
      | -1       |

  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. The 200 response references GLAccountBalance — the same schema as the regular
  #    balance endpoint. No client-specific fields are documented separately.
  # 2. No 404 response documented — behaviour for an unknown clientId is unspecified
  #    (may return empty array or 404).
  # 3. The `account` query parameter accepts a string array but no stable test data
  #    is available to verify multi-account filtering.
  # 4. isSettlementPartner filter has no documented difference in returned data —
  #    unclear what records it includes or excludes.
