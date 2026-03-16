@accounts
Feature: Accounts — List GL Accounts

  Background:
    Given I am authenticated as "a valid client"

  # ── Happy path ───────────────────────────────────────────────────────────────

  @smoke
  Scenario: List accounts for the configured instance returns 200
    When I send a GET request to "/{instanceId}/accounts"
    Then the response status should be OK

  @schema
  Scenario: Each account in the response conforms to the gl-account schema
    When I send a GET request to "/{instanceId}/accounts"
    Then the response status should be OK
    And each item in the response array should match schema "gl-account"

  @regression
  Scenario: List accounts with orderBy parameter returns 200
    When I send a GET request to "/{instanceId}/accounts?orderBy=account"
    Then the response status should be OK

  # ── Negative ─────────────────────────────────────────────────────────────────

  @negative
  Scenario: Request with an invalid instanceId returns 400
    When I send a GET request to "/99999/accounts"
    Then the response status should be BadRequest
