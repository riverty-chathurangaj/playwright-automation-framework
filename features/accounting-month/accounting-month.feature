@accounting-month
Feature: Close Accounting Month
  As a user of the GL API
  I should be able to close an accounting month for a given instance and client

  Background:
    Given I am authenticated as "a valid client"

  @smoke @fixme
  Scenario: I should be able to close an accounting month for a valid instance and client
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 1     |
    Then I send the close accounting month request to the API
    And I get the response code of OK

  @fixme
  Scenario Outline: I should be able to close accounting months for different instances
    When I define a POST "close accounting month request"
    And I set "instanceId" to "<instanceId>"
    And I set accounting month request parameters:
      | clientId   | year   | month   |
      | <clientId> | <year> | <month> |
    Then I send the close accounting month request to the API
    And I get the response code of OK

    Examples:
      | instanceId | clientId | year | month |
      | 2001       | 1        | 2024 | 2     |
      | 2002       | 1        | 2024 | 1     |

  Scenario: I should get an error when I try to close an already closed accounting month
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2000 | 1     |
    Then I send the close accounting month request to the API
    And I get the response code of NotFound
    And I see the error message "No open accounting month found to close for the given criteria."

# ── Negative & unconventional input scenarios ────────────────────────────────
  @negative @unconventional
  Scenario Outline: POST close accounting month with invalid or unconventional instanceId values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "<instanceId>"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 1     |
    Then I send the close accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | instanceId |
      | 99999      |
      | null       |
      | abc        |
      | 1.5        |
      | @!$        |
      | -1         |

  @negative @unconventional
  Scenario Outline: POST close accounting month with invalid or unconventional clientId values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId   | year | month |
      | <clientId> | 2024 | 1     |
    Then I send the close accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | clientId |
      | 999999   |
      | null     |
      | abc      |
      | 1.5      |
      | @!$      |
      | -1       |

  @negative @unconventional
  Scenario Outline: POST close accounting month with invalid or unconventional year values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year   | month |
      | 1        | <year> | 1     |
    Then I send the close accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | year |
      | 9999 |
      | null |
      | abc  |
      | 1.5  |
      | @!$  |
      | -1   |

  @negative @unconventional
  Scenario Outline: POST close accounting month with invalid or unconventional month values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month   |
      | 1        | 2024 | <month> |
    Then I send the close accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | month |
      | 13    |
      | 0     |
      | null  |
      | abc   |
      | 1.5   |
      | @!$   |
      | -1    |

  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. POST /{instanceId}/AccountingMonth/Close — the 200 response has no body schema
  #    defined. It is unclear whether the API returns an empty body, a success message, or
  #    some other payload. Verify against actual API response.
  # 2. Query parameters clientId, year, and month are not marked as required in swagger,
  #    but they are logically required for the operation to succeed. The API behavior when
  #    these are omitted is undocumented.
  # 3. Error responses reference ProblemDetails schema (type, title, status, detail, instance)
  #    but the actual API may return the GL-specific error format (Type, Message, StackTrace)
  #    with PascalCase keys. Verify which error format is actually returned.
  # 4. No documentation on valid ranges for year and month parameters — e.g., whether
  #    future months can be closed, or if month must be 1–12.
  # 5. No idempotency documentation — unclear what happens when closing an already-closed
  #    accounting month (second call to the same instanceId/clientId/year/month).
  # 6. No documentation on the relationship between clientId and instanceId — whether
  #    the clientId must belong to the given instanceId.

