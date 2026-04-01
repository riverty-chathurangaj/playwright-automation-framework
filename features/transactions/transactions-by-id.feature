@transactions
Feature: Transactions — Get Transaction by ID
  As a client of the GL Service API
  I want to retrieve individual transactions by their id

  # Note: Swagger only documents 200 for this endpoint — no 404 is specified.
  # Non-existent ID behaviour is marked @fixme until verified against a live run.

  Background:
    Given I am authenticated as "a valid client"

  @transactions @smoke
  Scenario: Retrieve a single transaction by voucherNo
    # Step 1 — get a valid voucherNo from the list
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2002       | 202407                  | 202407                | 1        |
    Then I send the transactions request to the API
    And I get the response code of OK
    And I store the response field "[0].voucherNo" as "txVoucherNo"

    # Step 2 — fetch that individual transaction
    When I define a GET "transactions by id request"
    And I set "instanceId" to "2002"
    And I set "id" to the stored value "txVoucherNo"
    Then I send the transactions by id request to the API
    And I get the response code of OK

  @transactions @smoke
  Scenario: Single transaction response conforms to the gl-transaction schema
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | 2002       | 202407                  | 202407                | 1        |
    Then I send the transactions request to the API
    And I get the response code of OK
    And I store the response field "[0].voucherNo" as "txVoucherNo"

    When I define a GET "transactions by id request"
    And I set "instanceId" to "2002"
    And I set "id" to the stored value "txVoucherNo"
    Then I send the transactions by id request to the API
    And I get the response code of OK
    And the response should match schema "gl-transaction"

  @transactions
  Scenario Outline: Single transaction can be retrieved across multiple instances
    When I define a GET "transactions request"
    And I set transaction request parameters:
      | instanceId   | accountingYearMonthFrom | accountingYearMonthTo | noOfRows |
      | <instanceId> | <from>                  | <to>                  | 1        |
    Then I send the transactions request to the API
    And I get the response code of OK
    And I store the response field "[0].voucherNo" as "txVoucherNo"

    When I define a GET "transactions by id request"
    And I set "instanceId" to "<instanceId>"
    And I set "id" to the stored value "txVoucherNo"
    Then I send the transactions by id request to the API
    And I get the response code of OK
    And the response should match schema "gl-transaction"

    Examples:
      | instanceId | from   | to     |
      | 2001       | 202407 | 202407 |
      | 2022       | 202407 | 202407 |

  @transactions @fixme
  # Swagger does not document 404 — actual behaviour must be verified against the live API
  Scenario: Non-existent transaction voucherNo returns NotFound
    When I define a GET "transactions by id request"
    And I set "instanceId" to "2002"
    And I set "id" to "999999999"
    Then I send the transactions by id request to the API
    And I get the response code of NotFound

  @transactions
  Scenario Outline: Invalid voucherNo format returns BadRequest or NotFound
    When I define a GET "transactions by id request"
    And I set "instanceId" to "2002"
    And I set "id" to "<id>"
    Then I send the transactions by id request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | id  |
      | abc |
      | @!$ |

    @fixme
    Examples:
      | id |
      | -1 |

  @transactions
  Scenario: Invalid instanceId on by-id request returns BadRequest
    When I define a GET "transactions by id request"
    And I set "instanceId" to "99999"
    And I set "id" to "1"
    Then I send the transactions by id request to the API
    And I get the response code of BadRequest

  # ── Swagger schema gaps ────────────────────────────────────────────────────────
  # 1. No 404 documented for non-existent ID — marked @fixme above.
  # 2. The `id` parameter type is int32 in swagger but voucherNo is int64 in the
  #    response schema — verify whether the path param is truly voucherNo or an
  #    internal database Id that differs.

