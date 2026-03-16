@messaging
Feature: Messaging — GL Posting Queue

  # Exchange:    finance.general-ledger-posting-service
  # Routing key: "" (empty — default direct binding)
  # Vhost:       shared
  #
  # The test harness creates a TEMPORARY queue bound to the same exchange,
  # so the real consumer is never disturbed.

  # ── Passive listen ───────────────────────────────────────────────────────────
  # Useful for smoke-testing connectivity and confirming the exchange exists.

  @smoke
  Scenario: Can connect and bind a listener to the GL posting exchange
    Given I am listening on existing exchange "finance.general-ledger-posting-service" with routing key ""
    Then no messages should be received within 3 seconds

  # ── Publish and receive ───────────────────────────────────────────────────────
  # Verifies the full round-trip: publish to exchange → received by our temp queue.

  @regression
  Scenario: Published message is received on the GL posting exchange
    Given I am listening on existing exchange "finance.general-ledger-posting-service" with routing key ""
    And I publish a message to exchange "finance.general-ledger-posting-service" with routing key "":
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
    Then I should receive 1 messages within 10 seconds
    And the message field "eventType" should equal "GLPostingCreated"
    And the message field "instanceId" should equal "2022"

  @regression
  Scenario: Published message contains expected posting fields
    Given I am listening on existing exchange "finance.general-ledger-posting-service" with routing key ""
    And I publish a message to exchange "finance.general-ledger-posting-service" with routing key "":
      """
      {
        "eventType": "GLPostingCreated",
        "instanceId": 2022,
        "postingId": 99001,
        "amount": 250.75,
        "currency": "EUR",
        "postingDate": "2026-03-11T00:00:00Z",
        "description": "EUR posting test"
      }
      """
    Then I should receive 1 messages within 10 seconds
    And the message field "currency" should equal "EUR"
    And the message field "amount" should equal "250.75"

  # ── Wait for natural messages ─────────────────────────────────────────────────
  # Run these when the GL Service is actively processing — listens for any
  # message that arrives organically on the exchange within the timeout.

  # @active-processing — only run when GL Service is actively posting transactions
  # (queue is empty in idle environments; enable manually or in a scheduled job)
  @manual
  Scenario: GL posting exchange receives messages during active processing
    Given I am listening on existing exchange "finance.general-ledger-posting-service" with routing key ""
    Then I should receive 1 messages within 30 seconds
