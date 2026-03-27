@clients
Feature: Clients
  As a user of the GL API
  I should be able to retrieve client information and client department information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @clients @smoke
  Scenario Outline: I should be able to get a list of clients for a given instance
    When I define a GET "clients request"
    And I set "instanceId" to "<instanceId>"
    Then I send the client request to the API
    And I get the response code of OK
    And the response should be an array of clients

    Examples:
      | instanceId |
      | 2001       |
      | 2002       |
      | 2003       |
      | 2004       |
      | 2021       |
      | 2022       |
      | 2023       |

  @clients @fixme #TODO: This should return either 404 or 400 with a message indicating instance not found. 500 is not appropriate.
  Scenario: Verify behavior with invalid instanceId
    When I define a GET "clients request"
    And I set "instanceId" to "99999"
    Then I send the client request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  #TODO: Would be better to have active status in the response to assert per-item correctness.
  @clients
  Scenario Outline: I should be able to get a list of clients filtered by active status
    When I define a GET "clients request"
    And I set "instanceId" to "2001"
    And I send the client request to the API
    And I get the response code of OK
    And the response should be an array of clients
    And I store the clients count as "totalCount"

    When I define a GET "clients request"
    And I set client request parameters:
      | instanceId | isActive   |
      | 2001       | <isActive> |
    And I send the client request to the API
    And I get the response code of OK
    And I store the clients count as "filteredCount"

    Then the stored count "filteredCount" should be less than "totalCount"
    And each item in the response array should match schema "client"

    Examples:
      | isActive |
      | true     |
      | false    |

  #TODO: The schema is not correct for the response in swagger.json. It should be updated to reflect the actual response.
  @clients
  Scenario: I should be able to get a list of client departments for a given instance
    When I define a GET "client departments request"
    And I set "instanceId" to "2001"
    Then I send the client departments request to the API
    And I get the response code of OK
    And the response should be an array of client departments
#    And each item in the response array should match schema "client-department"

  @clients @fixme # The API responds with empty array. Shouldn't we return 404 or 400 with a message?
  Scenario: Verify behavior with invalid instanceId on client departments
    When I define a GET "client departments request"
    And I set "instanceId" to "98294561"
    Then I send the client departments request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  # ── Unconventional input tests ─────────────────────────────────────────────
  # These tests send values of the wrong type or semantically invalid values
  @clients
  Scenario Outline: GET clients with unconventional instanceId values
    When I define a GET "clients request"
    And I set "instanceId" to "<instanceId>"
    Then I send the client request to the API
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

  @clients
  Scenario Outline: GET client departments with unconventional instanceId values
    When I define a GET "client departments request"
    And I set "instanceId" to "<instanceId>"
    Then I send the client departments request to the API
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

  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. GET /{instanceId}/clients/departments — swagger references GLClient schema for 200
  #    response, but the actual API returns a different shape (recno, name, description).
  #    The client-department.schema.json was created from the actual response, not swagger.
  # 2. The Error component schema uses camelCase (type, message, stackTrace) but the actual
  #    API serialises with PascalCase (Type, Message, StackTrace). gl-error.schema.json
  #    already accounts for this, but swagger is misleading.
  # 3. GLClient component schema has no required fields defined — all three fields
  #    (orgno, globalId, name) are nullable with no required array.
  # 4. No documentation on valid values or behavior of the orderBy query parameter
  #    on GET /{instanceId}/clients.
  # 5. GET /{instanceId}/clients returns 500 instead of 400 for invalid instanceId — the
  #    API should return a proper 4xx error.
