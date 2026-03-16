@accounts
Feature: Accounts — Get Accounts by Posting

  Background:
    Given I am authenticated as "a valid client"

  @negative
  Scenario: Non-existent postingId returns 404
    When I send a GET request to "/{instanceId}/accounts/999999"
    Then the response status should be NotFound