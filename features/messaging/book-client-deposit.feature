@book-client-deposit
Feature: Booking a Client Deposit
  A rabbitmq message published for booking a client deposit should be consumed by the GL service.
  This should result in adding transactions to the database according to the message content.

  @book-client-deposit @smoke
  Scenario: Verify publishing a valid book client deposit message creates transactions in the database
    Given I am listening on "general ledger posting service"
    And I define a valid message for booking a client deposit
    When I publish the message to "general ledger posting service"
    Then I should receive 1 message within 30 seconds
    And the transactions from the book client deposit message should exist in the database
    And the transactions should have the posting number "904"

  @book-client-deposit
  Scenario: Verify behavior when publishing book client deposit message with duplicate message ID with same message content
    Given I am listening on "general ledger posting service"
    And I am listening on the "general ledger posting service error" exchange
    And I define a valid message for booking a client deposit
    When I publish the message to "general ledger posting service"
    Then I should receive 1 message within 30 seconds
    When I publish the same message again to "general ledger posting service"
    And there should be no errors on the "general ledger posting service error" exchange

  @book-client-deposit
  Scenario: Verify an error is raised when publishing book client deposit message with duplicate message ID with a unique message content
    Given I am listening on "general ledger posting service"
    And I am listening on the "general ledger posting service error" exchange
    And I define a valid message for booking a client deposit
    When I publish the message to "general ledger posting service"
    Then I should receive 1 message within 30 seconds
    When I define a valid message for booking a client deposit
    And I set the message ID to be the same as the previous message
    And I publish the message to "general ledger posting service"
    Then there should be an error on the "general ledger posting service error" exchange

  @book-client-deposit
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
