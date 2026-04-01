@balance
Feature: Balance — Get Account Balances
  As a user of the GL API
  I should be able to retrieve account balance information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @balance @smoke
  Scenario: Get balance for the configured instance returns OK
    When I define a GET "balance request"
    Then I send the balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Each balance entry conforms to the gl-account-balance schema
    When I define a GET "balance request"
    Then I send the balance request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-account-balance"

  @balance
  Scenario: Filter balance by account range returns OK
    When I define a GET "balance request"
    And I set balance request parameters:
      | accountfrom | accountto |
      | 1000        | 9999      |
    Then I send the balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Filter balance by accounting year-month range returns OK
    When I define a GET "balance request"
    And I set balance request parameters:
      | accountingYearMonthFrom | accountingYearMonthTo |
      | 202401                  | 202412                |
    Then I send the balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Filter balance by clientId returns OK
    When I define a GET "balance request"
    And I set balance request parameters:
      | clientId |
      | 1        |
    Then I send the balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Retrieve balance for all accounts of a specific client
    When I define a GET "balance request"
    And I set "instanceId" to "2001"
    And I set balance request parameters:
      | orgnoClient       | accountingYearMonthFrom | accountingYearMonthTo |
      | BalanceTestClient | 202501                  | 202501                |
    Then I send the balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Request with an invalid instanceId returns BadRequest
    When I define a GET "balance request"
    And I set "instanceId" to "99999"
    Then I send the balance request to the API
    And I get the response code of BadRequest

