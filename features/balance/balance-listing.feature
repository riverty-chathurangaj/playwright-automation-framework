@balance
Feature: Balance — Balance Listing Report
  As a user of the GL API
  I should be able to retrieve account balance information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @balance @smoke
  Scenario: Get balance listing for the configured instance returns OK
    When I define a GET "balance listing request"
    Then I send the balance listing request to the API
    And I get the response code of OK

  @balance
  Scenario: Each listing entry conforms to the gl-account-balance-listing schema
    When I define a GET "balance listing request"
    Then I send the balance listing request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-account-balance-listing"

  @balance
  Scenario: Filter balance listing by date range returns OK
    When I define a GET "balance listing request"
    And I set balance listing request parameters:
      | accountingYearMonthFrom | accountingYearMonthTo |
      | 202401                  | 202412                |
    Then I send the balance listing request to the API
    And I get the response code of OK
