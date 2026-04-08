@messaging @book-client-deposit
Feature: Utility scenarios for messaging simulations
  These scenarios are not meant to be run as part of the regular test suite, but can be used for manual testing and debugging of messaging-related features.

  @book-client-deposit
  Scenario: Publishing multiple messages with invalid message IDs should result in errors
    Given I am listening on the "general ledger posting service error" exchange
    When I publish 50 book client deposit messages with an invalid message ID to "general ledger posting service"
    Then there should be 50 errors on the "general ledger posting service error" exchange within 60 seconds
