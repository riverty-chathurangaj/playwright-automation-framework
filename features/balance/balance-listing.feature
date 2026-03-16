@balance
Feature: Balance — Balance Listing Report

  Background:
    Given I am authenticated as "a valid client"

  @smoke
  Scenario: Get balance listing for the configured instance returns 200
    When I send a GET request to "/{instanceId}/balance/listing"
    Then the response status should be OK

  @schema
  Scenario: Each listing entry conforms to the gl-account-balance-listing schema
    When I send a GET request to "/{instanceId}/balance/listing"
    Then the response status should be OK
    And each item in the response array should match schema "gl-account-balance-listing"

  @regression
  Scenario: Filter balance listing by date range returns 200
    When I send a GET request to "/{instanceId}/balance/listing?accountingYearMonthFrom=202401&accountingYearMonthTo=202412"
    Then the response status should be OK
