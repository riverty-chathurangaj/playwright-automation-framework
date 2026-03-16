@balance
Feature: Balance — Client Balance

  Background:
    Given I am authenticated as "a valid client"

  @smoke
  Scenario: Get client balance for the configured instance returns 200
    When I send a GET request to "/{instanceId}/balance/ClientBalance"
    Then the response status should be OK

  @regression
  Scenario: Filter client balance by clientId returns 200
    When I send a GET request to "/{instanceId}/balance/ClientBalance?clientId=1"
    Then the response status should be OK

  @regression
  Scenario: Filter client balance by accounting year-month returns 200
    When I send a GET request to "/{instanceId}/balance/ClientBalance?accountingYearMonth=202401"
    Then the response status should be OK
