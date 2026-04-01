@security
Feature: Security — Authentication & Authorization

  @security @smoke
  Scenario: Unauthenticated request to instances endpoint returns 401
    Given I am not authenticated
    When I send a GET request to "/instances"
    Then the response status should be Unauthorized

  @security
  Scenario: Unauthenticated request to accounts endpoint returns 401
    Given I am not authenticated
    When I send a GET request to "/{instanceId}/accounts"
    Then the response status should be Unauthorized

  @security
  Scenario: Unauthenticated request to balance endpoint returns 401
    Given I am not authenticated
    When I send a GET request to "/{instanceId}/balance"
    Then the response status should be Unauthorized

  @security
  Scenario: Invalid token is rejected by the API gateway
    Given I am authenticated with an invalid token
    When I send a GET request to "/instances"
    Then the response status should be Unauthorized or Forbidden

  @security
  Scenario: Expired token is rejected by the API gateway
    Given I am authenticated with an expired token
    When I send a GET request to "/instances"
    Then the response status should be Unauthorized or Forbidden
