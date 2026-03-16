@security
Feature: Security — Authentication & Authorization

  # ── No credentials ──────────────────────────────────────────────────────────

  @smoke
  Scenario: Unauthenticated request to instances endpoint returns 401
    Given I am not authenticated
    When I send a GET request to "/instances"
    Then the response status should be Unauthorized

  @regression
  Scenario: Unauthenticated request to accounts endpoint returns 401
    Given I am not authenticated
    When I send a GET request to "/{instanceId}/accounts"
    Then the response status should be Unauthorized

  @regression
  Scenario: Unauthenticated request to balance endpoint returns 401
    Given I am not authenticated
    When I send a GET request to "/{instanceId}/balance"
    Then the response status should be Unauthorized

  # ── Invalid / expired tokens ─────────────────────────────────────────────────

  @regression
  Scenario: Invalid token is rejected by the API gateway
    Given I am authenticated with an invalid token
    When I send a GET request to "/instances"
    Then the response status should be Unauthorized or Forbidden

  @regression
  Scenario: Expired token is rejected by the API gateway
    Given I am authenticated with an expired token
    When I send a GET request to "/instances"
    Then the response status should be Unauthorized or Forbidden
