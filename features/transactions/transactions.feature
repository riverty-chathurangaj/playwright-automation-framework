@transactions
Feature: Transactions
  As a client of the GL Service API
  I want to retrieve transactions across multiple GL instances with various filters

  Background:
    Given I am authenticated as "a valid client"

  @transactions @smoke
  Scenario: OrgnoClient filter is accepted and applied to all returned items
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | orgnoClient | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2022       | 22121988-2  | 202511                  | 202511                | 10       |
    Then I send the transactions request to the API
    And I get the response code of OK
    And each item in the response array field "clientOrgNo" should equal "22121988-2"
    And each item in the response array should match schema "gl-transaction"

  @transactions
  Scenario Outline: Retrieve transactions for a specific instance and accounting period
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId   | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | <instanceId> | <from>                  | <to>                  | <rows>   |
    Then I send the transactions request to the API
    And I get the response code of OK
    And the response array should contain exactly <rows> items
    And each item in the response array should match schema "gl-transaction"

    Examples:
      | instanceId | from   | to     | rows |
      | 2002       | 202407 | 202407 | 10   |
      | 2021       | 202407 | 202407 | 10   |
      | 2022       | 202511 | 202511 | 10   |
      | 2001       | 202407 | 202407 | 10   |
      | 2023       | 202401 | 202410 | 10   |
      | 2003       | 202401 | 202410 | 10   |
      | 2002       | 202408 | 202409 | 5    |
      | 2021       | 202408 | 202410 | 10   |
      | 2001       | 202409 | 202409 | 10   |

  @transactions
  Scenario: Filter transactions by GL account range returns OK
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | accountFrom | accountTo | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2002       | 1000        | 9999      | 202407                  | 202407                | 10       |
    Then I send the transactions request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-transaction"

  @transactions
  Scenario: Filter transactions by voucher date range returns OK
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | accountingYearMonthFrom | voucherDateFrom          | voucherDateTo            | noOfRows |
      | 2002       | 202407                  | 2024-07-01T00:00:00.000Z | 2024-07-31T23:59:59.000Z | 10       |
    Then I send the transactions request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-transaction"

  @transactions
  Scenario: Filter transactions by registration date range returns OK
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | accountingYearMonthFrom | insFrom                  | insTo                    | noOfRows |
      | 2002       | 202407                  | 2024-07-01T00:00:00.000Z | 2024-07-31T23:59:59.000Z | 10       |
    Then I send the transactions request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-transaction"

  @transactions
  Scenario: Filter transactions by bundleNo range returns OK
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | bundleNoFrom | bundleNoTo | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2002       | 1            | 9999999    | 202407                  | 202407                | 10       |
    Then I send the transactions request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-transaction"

  @transactions
  Scenario: Filter transactions by clientId returns OK
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | clientId | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2002       | 1        | 202407                  | 202407                | 10       |
    Then I send the transactions request to the API
    And I get the response code of OK

  @transactions
  Scenario: Verify noOfRows parameter limits the result set
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2002       | 202401                  | 202412                | 3        |
    Then I send the transactions request to the API
    And I get the response code of OK
    And the response array should contain exactly 3 items

  @transactions
  Scenario: Invalid instanceId returns BadRequest with gl-error schema
    When I define a GET "transactions request"
    And I set "instanceId" to "99999"
    Then I send the transactions request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  @transactions
  Scenario Outline: Invalid format of instanceId values return BadRequest or NotFound
    When I define a GET "transactions request"
    And I set "instanceId" to "<instanceId>"
    Then I send the transactions request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | instanceId |
      | null       |
      | abc        |
      | 1.5        |
      | @!$        |

    @fixme
    Examples:
      | instanceId |
      | -1         |

  # ── Swagger schema gaps ────────────────────────────────────────────────────────
  # 1. No 404 response documented — invalid instanceId returns 400, not 404.
  # 2. The `department` and `customerNo` filter parameters are accepted but
  #    not verified here — no stable test data available for these fields.
  # 3. `bookingId` filter is accepted by the API but links to the SAP booking
  #    domain which is outside the scope of these tests.
  # 4. The transactions requests responds with transaction items but they don't have the transaction id field. Is this intentional?
  #    There is a field `voucherNo` in the response but there is no such in the actual table in the DB