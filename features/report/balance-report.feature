@report @fixme
Feature: Balance — Balance Report
  As a user of the GL API
  I should be able to retrieve balance reports for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @report @smoke
  Scenario: Get balance report for the configured instance returns OK
    When I define a GET "balance report request"
    Then I send the balance report request to the API
    And I get the response code of OK

  @report
  Scenario: Get balance report with showRevertyAcc disabled
    When I define a GET "balance report request"
    And I set balance report request parameters:
      | showRevertyAcc |
      | false          |
    Then I send the balance report request to the API
    And I get the response code of OK

  @report
  Scenario: Filter balance report by orgnoClient returns OK
    When I define a GET "balance report request"
    And I set balance report request parameters:
      | orgnoClient       |
      | BalanceTestClient |
    Then I send the balance report request to the API
    And I get the response code of OK

  @report
  Scenario: Filter balance report by accounting year-month range
    When I define a GET "balance report request"
    And I set balance report request parameters:
      | accountingYearMonthFrom | accountingYearMonthTo |
      | 202401                  | 202412                |
    Then I send the balance report request to the API
    And I get the response code of OK

  @report
  Scenario: Filter balance report by accounting period date range
    When I define a GET "balance report request"
    And I set balance report request parameters:
      | accountingPeriodFrom   | accountingPeriodTo     |
      | 2024-01-01T00:00:00Z   | 2024-12-31T23:59:59Z   |
    Then I send the balance report request to the API
    And I get the response code of OK

  @report
  Scenario: Filter balance report with combined orgnoClient and year-month filters
    When I define a GET "balance report request"
    And I set balance report request parameters:
      | orgnoClient       | accountingYearMonthFrom | accountingYearMonthTo |
      | BalanceTestClient | 202401                  | 202412                |
    Then I send the balance report request to the API
    And I get the response code of OK

  @report
  Scenario: Filter balance report with all query parameters
    When I define a GET "balance report request"
    And I set balance report request parameters:
      | orgnoClient       | accountingYearMonthFrom | accountingYearMonthTo | showRevertyAcc |
      | BalanceTestClient | 202401                  | 202412                | true           |
    Then I send the balance report request to the API
    And I get the response code of OK

  # ── Negative ─────────────────────────────────────────────────────────────────
  @report @fixme # The API currently returns 500 for invalid instanceId. It should return either 404 or 400 with a message indicating instance not found.
  Scenario: Balance report with an invalid instanceId returns BadRequest
    When I define a GET "balance report request"
    And I set "instanceId" to "99999"
    Then I send the balance report request to the API
    And I get the response code of BadRequest

  @report
  Scenario Outline: GET balance report with unconventional instanceId values
    When I define a GET "balance report request"
    And I set "instanceId" to "<instanceId>"
    Then I send the balance report request to the API
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
  # 1. No 200 response schema documented — swagger only defines 400 and 500
  #    responses for this endpoint. The actual response shape needs to be verified
  #    against a live API call before a schema/interface can be created.
  # 2. The showRevertyAcc parameter defaults to true — the effect of toggling it
  #    is not documented in swagger.
  # 3. It is unclear whether the response is an array (like /balance) or a
  #    different report-oriented structure. Verify and add schema validation once
  #    the response shape is confirmed.
  # 4. No documentation on the relationship/difference between
  #    accountingYearMonthFrom/To and accountingPeriodFrom/To — both accept
  #    date-range filtering but in different formats (YYYYMM vs ISO datetime).
  # 5. The endpoint return a HTML page without any data for all requests
