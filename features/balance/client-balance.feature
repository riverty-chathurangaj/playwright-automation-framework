@balance
Feature: Balance — Client Balance
  As a user of the GL API
  I should be able to retrieve client balance information for a given client

  Background:
    Given I am authenticated as "a valid client"

  @balance @smoke
  Scenario: Get client balance for the configured instance returns OK
    When I define a GET "client balance request"
    Then I send the client balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Filter client balance by clientId returns OK
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | clientId |
      | 1        |
    Then I send the client balance request to the API
    And I get the response code of OK

  @balance
  Scenario: Filter client balance by accounting year-month returns OK
    When I define a GET "client balance request"
    And I set client balance request parameters:
      | accountingYearMonth |
      | 202401              |
    Then I send the client balance request to the API
    And I get the response code of OK
