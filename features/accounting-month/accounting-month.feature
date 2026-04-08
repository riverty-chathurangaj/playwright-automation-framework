@accounting-month
Feature: Accounting Month
  As a user of the GL API
  I should be able to open and close accounting months for a given instance and client

  Background:
    Given I am authenticated as "a valid client"

# ── Open Accounting Month ─────────────────────────────────────────────────────
  @smoke @accounting-month
  Scenario: I should be able to open the current accounting month
    Given the current accounting month is closed for instance "2022" and client "67198"
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the open accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month opened."
    And the response should confirm the accounting month parameters

  @accounting-month
  Scenario: I should be able to open the previous accounting month
    Given the previous accounting month is closed for instance "2022" and client "67198"
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to previous month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the open accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month opened."
    And the response should confirm the accounting month parameters

  @accounting-month
  Scenario Outline: I should be able to open accounting months for different instances
    Given the current accounting month is closed for instance "<instanceId>" and client "<clientId>"
    When I define a POST "open accounting month request"
    And I set "instanceId" to "<instanceId>"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId   |
      | <clientId> |
    Then I send the open accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month opened."
    And the response should confirm the accounting month parameters

    Examples:
      | instanceId | clientId |
      | 2022       | 67198    |
      | 2002       | 67198    |

# ── Close Accounting Month ────────────────────────────────────────────────────
  @smoke @accounting-month
  Scenario: I should be able to close the current accounting month
    Given the current accounting month is open for instance "2022" and client "67198"
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the close accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month closed."
    And the response should confirm the accounting month parameters
    # Cleanup: reopen
    Given the current accounting month is open for instance "2022" and client "67198"

  @accounting-month
  Scenario: I should be able to close the previous accounting month
    Given the previous accounting month is open for instance "2022" and client "67198"
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to previous month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the close accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month closed."
    And the response should confirm the accounting month parameters
    # Cleanup: reopen
    Given the previous accounting month is open for instance "2022" and client "67198"

  @accounting-month
  Scenario: I should be able to reopen a previously closed accounting month
    # Setup: ensure month starts closed
    Given the current accounting month is closed for instance "2022" and client "67198"
    # Step 1: Open the month
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the open accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month opened."
    And the response should confirm the accounting month parameters
    # Step 2: Close it
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the close accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month closed."
    And the response should confirm the accounting month parameters
    # Step 3: Reopen it — should succeed (status changes to Reopened)
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the open accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month opened."
    And the response should confirm the accounting month parameters

  @accounting-month
  Scenario: I should get an error when I try to close an already closed accounting month
    # Setup: ensure the month is open
    Given the previous accounting month is open for instance "2022" and client "67198"
    # Step 1: Close it
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to previous month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the close accounting month request to the API
    And I get the response code of OK
    And the response field "message" should equal "Accounting month closed."
    And the response should confirm the accounting month parameters
    # Step 2: Try to close again — should fail
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to previous month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the close accounting month request to the API
    And I get the response code of NotFound
    And I see the error message "Accounting month is already closed."
    And the response should confirm the accounting month parameters
    # Cleanup: reopen for other tests
    Given the previous accounting month is open for instance "2022" and client "67198"


  @accounting-month
  Scenario: I should get an error when I try to open an old accounting month (not current or previous)
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to 6 months ago
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the open accounting month request to the API
    And I get the response code of BadRequest
    And the error should indicate "You can only open/reopen the current or previous accounting month"

  @accounting-month
  Scenario: I should get an error when I try to open a future accounting month
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 67198    | 2100 | 12    |
    Then I send the open accounting month request to the API
    And I get the response code of BadRequest
    And the error should indicate "You can only open/reopen the current or previous accounting month"

  @accounting-month
  Scenario Outline: POST open accounting month with invalid or unconventional instanceId values
    When I define a POST "open accounting month request"
    And I set "instanceId" to "<instanceId>"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId |
      | 67198    |
    Then I send the open accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | instanceId |
      | 99999      |
      | null       |
      | abc        |
      | 1.5        |
      | @!$        |
      | -1         |

  @accounting-month
  Scenario Outline: POST open accounting month with invalid or unconventional clientId values
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month to current month
    And I set accounting month request parameters:
      | clientId   |
      | <clientId> |
    Then I send the open accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | clientId |
      | 999999   |
      | null     |
      | abc      |
      | 1.5      |
      | @!$      |
      | -1       |

  @accounting-month
  Scenario Outline: POST open accounting month with invalid year values
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year   | month |
      | 67198    | <year> | 1     |
    Then I send the open accounting month request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | year |
      | 9999 |
      | null |
      | abc  |
      | 1.5  |
      | @!$  |
      | -1   |

  @accounting-month
  Scenario Outline: POST open accounting month with invalid month values
    When I define a POST "open accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year | month   |
      | 67198    | 2024 | <month> |
    Then I send the open accounting month request to the API
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

  @accounting-month
  Scenario: I should get an error when I try to close a future accounting month
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 67198    | 2100 | 12    |
    Then I send the close accounting month request to the API
    And I get the response code of BadRequest
    And the error should indicate "Cannot close a future accounting month"

  @accounting-month
  Scenario Outline: POST close accounting month with invalid or unconventional instanceId values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "<instanceId>"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 67198    | 2024 | 1     |
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

  @accounting-month
  Scenario Outline: POST close accounting month with invalid or unconventional clientId values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
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

  @accounting-month
  Scenario Outline: POST close accounting month with invalid or unconventional year values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year   | month |
      | 67198    | <year> | 1     |
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

  @accounting-month
  Scenario Outline: POST close accounting month with invalid or unconventional month values
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year | month   |
      | 67198    | 2024 | <month> |
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

