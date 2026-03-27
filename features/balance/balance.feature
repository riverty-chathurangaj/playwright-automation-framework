@balance
Feature: Balance — Get Account Balances

  Background:
    Given I am authenticated as "a valid client"

  # ── Happy path ───────────────────────────────────────────────────────────────

  @balance @smoke
  Scenario: Get balance for the configured instance returns 200
    When I send a GET request to "/{instanceId}/balance"
    Then the response status should be OK

  @balance
  Scenario: Each balance entry conforms to the gl-account-balance schema
    When I send a GET request to "/{instanceId}/balance"
    Then the response status should be OK
    And each item in the response array should match schema "gl-account-balance"

  # ── Filtered queries ─────────────────────────────────────────────────────────

  @balance
  Scenario: Filter balance by account range returns 200
    When I send a GET request to "/{instanceId}/balance?accountfrom=1000&accountto=9999"
    Then the response status should be OK

  @balance
  Scenario: Filter balance by accounting year-month range returns 200
    When I send a GET request to "/{instanceId}/balance?accountingYearMonthFrom=202401&accountingYearMonthTo=202412"
    Then the response status should be OK

  @balance
  Scenario: Filter balance by clientId returns 200
    When I send a GET request to "/{instanceId}/balance?clientId=1"
    Then the response status should be OK

  # Ported from: GetBalancebyClientAllAccounts.feature (.NET suite)
  # Note: depends on test data inserted by the GL Test Support Service.
  # Will return 200 with empty array if BalanceTestClient data is not present.
  @balance
  Scenario: Retrieve balance for all accounts of a specific client
    When I send a GET request to "/2001/balance?orgnoClient=BalanceTestClient&accountingYearMonthFrom=202501&accountingYearMonthTo=202501"
    Then the response status should be OK

  # ── Negative ─────────────────────────────────────────────────────────────────

  @balance
  Scenario: Request with an invalid instanceId returns 400
    When I send a GET request to "/99999/balance"
    Then the response status should be BadRequest

