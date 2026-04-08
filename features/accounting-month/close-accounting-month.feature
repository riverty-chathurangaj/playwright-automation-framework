@close-accounting-month
Feature: Close Accounting Month
  As a user of the GL API
  I should be able to close accounting months for a given instance and client

  Background:
    Given I am authenticated as "a valid client"

  @smoke @close-accounting-month
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

  @close-accounting-month
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

  @close-accounting-month
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

  @close-accounting-month
  Scenario: I should get an error when I try to close a future accounting month
    When I define a POST "close accounting month request"
    And I set "instanceId" to "2022"
    And I set accounting month request parameters:
      | clientId | year | month |
      | 67198    | 2100 | 12    |
    Then I send the close accounting month request to the API
    And I get the response code of BadRequest
    And the error should indicate "Cannot close a future accounting month"

  @close-accounting-month
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

  @close-accounting-month
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

  @close-accounting-month
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

  @close-accounting-month
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
