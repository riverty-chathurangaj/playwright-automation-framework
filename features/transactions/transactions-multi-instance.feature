@transactions
Feature: Transactions — Multi-Instance Search

  # Ported from: GLTransactionsFromMultipleInstances.feature (.NET suite)
  # Tests that transactions can be retrieved across all valid GL instances
  # for specific accounting periods, and that row limiting (noOfRows) works correctly.
  #
  # Note: instance 2024/202409 was excluded — requires test data from the
  # GL Test Support Service (not yet configured in this environment).

  Background:
    Given I am authenticated as "a valid client"

  # ── Retrieve by accounting period ────────────────────────────────────────────

  @regression
  Scenario Outline: Retrieve transactions for a specific instance and accounting period
    When I send a GET request to "/<instanceId>/transactions?accountingYearMonthFrom=<from>&accountingYearMonthTo=<to>&noOfRows=<rows>"
    Then the response status should be OK
    And the response array should contain exactly <rows> items

    Examples:
      | instanceId | from   | to     | rows |
      | 2002       | 202407 | 202407 | 10   |
      | 2021       | 202407 | 202407 | 10   |
      | 2022       | 202407 | 202407 | 10   |
      | 2001       | 202407 | 202407 | 10   |
      | 2023       | 202401 | 202410 | 10   |
      | 2003       | 202401 | 202410 | 10   |
      | 2002       | 202408 | 202409 | 5    |
      | 2021       | 202408 | 202410 | 10   |
      | 2001       | 202409 | 202409 | 10   |

  # ── Schema validation ─────────────────────────────────────────────────────────

  @schema
  Scenario: Transaction response items conform to the gl-transaction schema
    When I send a GET request to "/2022/transactions?accountingYearMonthFrom=202407&accountingYearMonthTo=202407&noOfRows=5"
    Then the response status should be OK
    And each item in the response array should match schema "gl-transaction"
