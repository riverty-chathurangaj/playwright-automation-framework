@clients
Feature: Clients
  As a user of the GL API
  I should be able to retrieve client information and client department information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @smoke
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

  @fixme #TODO: This should return either 404 or 400 with a message indicating instance not found. 500 is not appropriate.
  Scenario: Verify behavior with invalid instanceId
    When I define a GET "clients request"
    And I set "instanceId" to "99999"
    Then I send the client request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  #TODO: Would be better to have active status in the response to assert per-item correctness.
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
  Scenario: I should be able to get a list of client departments for a given instance
    When I define a GET "client departments request"
    And I set "instanceId" to "2001"
    Then I send the client departments request to the API
    And I get the response code of OK
    And the response should be an array of client departments
#    And each item in the response array should match schema "client-department"

  #TODO: Need clarify the expected behavior of orderBy for this controller endpoint.