@accounts
Feature: Accounts — Get Accounts by Posting
  As a user of the GL API
  I should be able to retrieve GL account information for a specific posting

  Background:
    Given I am authenticated as "a valid client"

  @smoke
  Scenario: I should be able to get accounts by posting id
    When I define a GET "accounts by posting request"
    And I set "postingId" to "1"
    Then I send the accounts by posting request to the API
    And I get the response code of OK
    And the response should be an array of accounts
    And each item in the response array should match schema "gl-account"

  @negative
  Scenario: Non-existent postingId returns NotFound
    When I define a GET "accounts by posting request"
    And I set "postingId" to "999999"
    Then I send the accounts by posting request to the API
    And I get the response code of NotFound

  @negative
  Scenario: Invalid instanceId on accounts by posting returns error
    When I define a GET "accounts by posting request"
    And I set "instanceId" to "99999"
    And I set "postingId" to "1"
    Then I send the accounts by posting request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  # ── Unconventional input tests ─────────────────────────────────────────────
  @negative @unconventional
  Scenario Outline: GET accounts by posting with unconventional instanceId values
    When I define a GET "accounts by posting request"
    And I set "instanceId" to "<instanceId>"
    And I set "postingId" to "1"
    Then I send the accounts by posting request to the API
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

  @negative @unconventional
  Scenario Outline: GET accounts by posting with unconventional postingId values
    When I define a GET "accounts by posting request"
    And I set "postingId" to "<postingId>"
    Then I send the accounts by posting request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | postingId |
      | null      |
      | abc       |
      | 1.5       |
      | @!$       |

    @fixme
    Examples:
      | postingId |
      | -1        |

  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. No 404 response documented — swagger only shows 200, 400, 500 but the API
  #    returns 404 for non-existent postingId values.
  # 2. The 200 response references GLAccount (same as list accounts), verify if the
  #    actual response shape differs when querying by postingId.
