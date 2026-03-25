@accounting-month
Feature: Accounting Month — Close
  As a user of the GL API
  I should be able to close an accounting month for a given instance and client

  Background:
    Given I am authenticated as "a valid client"

  @smoke
  Scenario: I should be able to close an accounting month for a valid instance and client
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 1     |
    Then I send the close accounting month request to the API
    And I get the response code of OK

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

  # ── Negative scenarios ─────────────────────────────────────────────────────

  @negative @fixme # The API may respond with 500 instead of 400 — verify and fix tag once confirmed
  Scenario: Verify behavior with invalid instanceId
    When I define a POST "close accounting month request"
    And I set "instanceId" to "99999"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 1     |
    Then I send the close accounting month request to the API
    And I get the response code of BadRequest

  @negative
  Scenario: Verify behavior with invalid clientId
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 999999   | 2024 | 1     |
    Then I send the close accounting month request to the API
    And I get the response code of NotFound

  @negative
  Scenario: Verify behavior with invalid year
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 9999 | 1     |
    Then I send the close accounting month request to the API
    And I get the response code of BadRequest

  @negative
  Scenario: Verify behavior with invalid month value
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 13    |
    Then I send the close accounting month request to the API
    And I get the response code of BadRequest

  @negative
  Scenario: Verify behavior with month zero
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 0     |
    Then I send the close accounting month request to the API
    And I get the response code of BadRequest

  # ── Unconventional input tests ─────────────────────────────────────────────
  # These tests send values of the wrong type or semantically invalid values

  @negative @unconventional
  Scenario Outline: POST close accounting month with unconventional instanceId values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "<instanceId>"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 1        | 2024 | 1     |
    Then I send the close accounting month request to the API
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
  Scenario Outline: POST close accounting month with unconventional clientId values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId   | year | month |
      | <clientId> | 2024 | 1     |
    Then I send the close accounting month request to the API
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

  @negative @unconventional
  Scenario Outline: POST close accounting month with unconventional year values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year   | month |
      | 1        | <year> | 1     |
    Then I send the close accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | year |
      | null |
      | abc  |
      | 1.5  |
      | @!$  |

    @fixme
    Examples:
      | year |
      | -1   |

  @negative @unconventional
  Scenario Outline: POST close accounting month with unconventional month values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2001"
    And I set accounting month request parameters:
      | clientId | year | month   |
      | 1        | 2024 | <month> |
    Then I send the close accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | month |
      | null  |
      | abc   |
      | 1.5   |
      | @!$   |

    @fixme
    Examples:
      | month |
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

