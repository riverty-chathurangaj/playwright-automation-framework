@api @gl-accounts
Feature: Accounts — List GL Accounts
  As a user of the GL API
  I should be able to retrieve GL account information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @api @gl-accounts @smoke
  Scenario Outline: I should be able to get a list of accounts for a given instance
    When I define a GET "accounts request"
    And I set "instanceId" to "<instanceId>"
    Then I send the accounts request to the API
    And I get the response code of OK
    And the response should be an array of accounts
    And each item in the response array should match schema "gl-account"

    Examples:
      | instanceId |
      | 2001       |
      | 2002       |

  #TODO: Add verification for order of accounts responded with
  @api @gl-accounts
  Scenario: I should be able to get accounts with orderBy parameter
    When I define a GET "accounts request"
    And I set account request parameters:
      | orderBy |
      | account |
    Then I send the accounts request to the API
    And I get the response code of OK
    And the response should be an array of accounts
    And each item in the response array should match schema "gl-account"

  @api @gl-accounts @fixme #TODO: The API responds with 500 instead of 400 or 404
  Scenario: Verify behavior with invalid instanceId on accounts
    When I define a GET "accounts request"
    And I set "instanceId" to "99999"
    Then I send the accounts request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  # ── Invalid input tests ─────────────────────────────────────────────
  # These tests send values of the wrong type or semantically invalid values
  @api @gl-accounts
  Scenario Outline: GET accounts with invalid format of instanceId values
    When I define a GET "accounts request"
    And I set "instanceId" to "<instanceId>"
    Then I send the accounts request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | instanceId |
      | null       |
      | abc        |
      | 1.5        |
      | @!$        |

    @fixme
    Examples:
      | instanceId |
      | -1         |

  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. GLAccount component schema has no required fields — both account and description
  #    are nullable with no required array defined.
  # 2. No documentation on valid values or behavior of the orderBy query parameter.
  # 3. The Error component schema uses camelCase but the actual API serialises PascalCase.
