@api @gl-messaging @gl-book-partner-deposit
Feature: Booking a Partner Deposit
  A rabbitmq message published for booking a partner deposit should be consumed by the GL service.
  This should result in adding transactions to the database according to the message content.

  @gl-book-partner-deposit @smoke
  Scenario: Verify publishing a valid book partner deposit message creates transactions in the database
    Given I am listening on "general ledger posting service"
    And I define a valid message for booking a partner deposit
    When I publish the message to "general ledger posting service"
    Then I should receive 1 message within 30 seconds
    And the transactions from the book partner deposit message should exist in the database
    And the book partner deposit transactions should have the posting number "905"

  @gl-book-partner-deposit
  Scenario: Verify behavior when publishing book partner deposit message with duplicate message ID with same message content
    Given I am listening on "general ledger posting service"
    And I am listening on the "general ledger posting service error" exchange
    And I define a valid message for booking a partner deposit
    When I publish the message to "general ledger posting service"
    Then I should receive 1 message within 30 seconds
    When I publish the same message again to "general ledger posting service"
    And there should be no errors on the "general ledger posting service error" exchange

  @gl-book-partner-deposit
  Scenario: Verify an error is raised when publishing book partner deposit message with duplicate message ID with a unique message content
    Given I am listening on "general ledger posting service"
    And I am listening on the "general ledger posting service error" exchange
    And I define a valid message for booking a partner deposit
    When I publish the message to "general ledger posting service"
    Then I should receive 1 message within 30 seconds
    When I define a valid message for booking a partner deposit
    And I set the book partner deposit message ID to be the same as the previous message
    And I publish the message to "general ledger posting service"
    Then there should be an error on the "general ledger posting service error" exchange

  @gl-book-partner-deposit
  Scenario: Publishing an invalid message should result an error message on the error exchange
    Given I am listening on "general ledger posting service"
    And I am listening on the "general ledger posting service error" exchange
    When I publish a message to "general ledger posting service":
      """
      {
        "eventType": "GLPostingCreated",
        "instanceId": 2022,
        "postingId": 12345,
        "amount": 1500.00,
        "currency": "NOK",
        "postingDate": "2026-03-11T00:00:00Z",
        "description": "Test posting from automation"
      }
      """
    Then there should be an error on the "general ledger posting service error" exchange

  # TODO: Add scenario which does a book partner deposit for a month which is already closed and verify transaction is rejected by the exchange.
