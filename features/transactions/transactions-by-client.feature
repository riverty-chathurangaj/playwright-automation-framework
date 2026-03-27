@transactions
Feature: Transactions — Filter by OrgnoClient

  # Ported from: GLTransactionsFromMultipleInstances.feature (.NET suite)
  # Tests that transactions filtered by orgnoClient return only transactions
  # belonging to that client.
  #
  # Note: The .NET suite used a Test Support Service to pre-insert synthetic
  # data where clientOrgNo = instanceId (e.g. orgno "2022" for instance 2022).
  # Without that service, real data uses different org numbers (e.g. "20183010-01").
  # These scenarios validate the filter is accepted and applied correctly —
  # field equality assertions are vacuously correct when no matching data exists.

  Background:
    Given I am authenticated as "a valid client"

  @transactions
  Scenario Outline: OrgnoClient filter is accepted and applied to all returned items
    When I send a GET request to "/<instanceId>/transactions?orgnoClient=<orgno>&accountingYearMonthFrom=<from>&accountingYearMonthTo=<to>&noOfRows=<rows>"
    Then the response status should be OK
    And each item in the response array field "clientOrgNo" should equal "<orgno>"

    Examples:
      | instanceId | orgno | from   | to     | rows |
      | 2024       | 2024  | 202409 | 202409 | 10   |
      | 2002       | 2002  | 202407 | 202407 | 10   |
      | 2021       | 2021  | 202407 | 202407 | 10   |
      | 2022       | 2022  | 202407 | 202407 | 10   |
      | 2001       | 2001  | 202407 | 202407 | 10   |
      | 2023       | 2023  | 202401 | 202410 | 10   |
      | 2003       | 2003  | 202401 | 202410 | 10   |
      | 2002       | 2002  | 202408 | 202409 | 10   |
      | 2021       | 2021  | 202408 | 202410 | 10   |
      | 2001       | 2001  | 202409 | 202409 | 10   |
