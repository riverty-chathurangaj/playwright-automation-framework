@instances
Feature: Instances
  As a user of the GL API
  I should be able to retrieve instances and their information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @smoke
  Scenario: I should be able to get the list of all instances
    When I define a GET "instances request"
    Then I send the instances request to the API
    And I get the response code of OK
    And the response should be an array of instances
    And each item in the response array should match schema "instance"

  @smoke
  Scenario Outline: I should be able to get an instance by id
    When I define a GET "instance by id request"
    And I set "id" to "<id>"
    Then I send the instance by id request to the API
    And I get the response code of OK
    And the response should be a valid instance
    And the response instance id should equal "<id>"
    And the response should match schema "instance"

    Examples:
      | id   |
      | 2001 |
      | 2002 |
      | 2003 |
      | 2004 |

  # The API responds with 500 instead of 400, so marking this test as fixme to investigate and fix the issue
  @fixme
  Scenario: Verify behavior with invalid instance id
    When I define a GET "instance by id request"
    And I set "id" to "99999"
    Then I send the instance by id request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  Scenario Outline: I should be able to get instances filtered by mi parameter
    When I define a GET "instances request"
    And I send the instances request to the API
    And I get the response code of OK
    And the response should be an array of instances
    And I store the instances count as "totalCount"

    When I define a GET "instances request"
    And I set instance request parameters:
      | mi   |
      | <mi> |
    And I send the instances request to the API
    And I get the response code of OK
    And I store the instances count as "filteredCount"

    Then the stored count "filteredCount" should be less than "totalCount"
    And each item in the response array should match schema "instance"

    Examples:
      | mi    |
      | true  |
      | false |

  @fixme # The API responds with 403 even though the user has access to the instance, need to investigate and fix the issue
  Scenario Outline: I should be able to get an instance by source system id
    When I define a GET "instance by source system request"
    And I set "sourceSystemId" to "<sourceSystemId>"
    Then I send the instance by source system request to the API
    And I get the response code of OK

    Examples:
      | sourceSystemId |
      | 2001           |
      | 2002           |

  @fixme # Depends on source system endpoint access being resolved first
  Scenario Outline: I should be able to get an instance by source system id with mi parameter
    When I define a GET "instance by source system request"
    And I set "sourceSystemId" to "<sourceSystemId>"
    And I set instance request parameters:
      | mi   |
      | <mi> |
    Then I send the instance by source system request to the API
    And I get the response code of OK

    Examples:
      | sourceSystemId | mi    |
      | 2001           | true  |
      | 2001           | false |
      | 2002           | true  |
      | 2002           | false |

  @fixme # The API responds with 403 instead of 404, so marking this test as fixme to investigate and fix the issue
  Scenario: Verify behavior with invalid source system id
    When I define a GET "instance by source system request"
    And I set "sourceSystemId" to "99999"
    Then I send the instance by source system request to the API
    And I get the response code of NotFound

  Scenario: I should be able to deactivate an instance
    When I define a PUT "deactivate instance request"
    And I set "id" to "2001"
    Then I send the deactivate instance request to the API
    And I get the response code of OK

    When I define a GET "instance by id request"
    And I set "id" to "2001"
    Then I send the instance by id request to the API
    And I get the response code of OK
    And the response should be a valid instance
    And the instance should have isActive equal to "false"

  Scenario: I should be able to activate an instance
    When I define a PUT "activate instance request"
    And I set "id" to "2001"
    Then I send the activate instance request to the API
    And I get the response code of OK

    When I define a GET "instance by id request"
    And I set "id" to "2001"
    Then I send the instance by id request to the API
    And I get the response code of OK
    And the response should be a valid instance
    And the instance should have isActive equal to "true"

  @negative @fixme # The API responds with 500 instead of 404 or 400 with a message
  Scenario: Verify activate with invalid instance id
    When I define a PUT "activate instance request"
    And I set "id" to "99999"
    Then I send the activate instance request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  @negative @fixme # The API responds with 500 instead of 404 or 400 with a message
  Scenario: Verify deactivate with invalid instance id
    When I define a PUT "deactivate instance request"
    And I set "id" to "99999"
    Then I send the deactivate instance request to the API
    And I get the response code of BadRequest
    And the response should match schema "gl-error"

  # ── Unconventional input tests ─────────────────────────────────────────────
  # These tests send values of the wrong type or semantically invalid values
  @negative @unconventional
  Scenario Outline: GET instance by id with unconventional id values
    When I define a GET "instance by id request"
    And I set "id" to "<id>"
    Then I send the instance by id request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | id   |
      | null |
      | abc  |
      | 1.5  |
      | @!$  |

    @fixme
    Examples:
      | id |
      | -1 |

  @negative @unconventional
  Scenario Outline: GET instance by source system id with unconventional sourceSystemId values
    When I define a GET "instance by source system request"
    And I set "sourceSystemId" to "<sourceSystemId>"
    Then I send the instance by source system request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | sourceSystemId |
      | null           |
      | abc            |
      | 1.5            |
      | @!$            |

    @fixme # The API responds with 403 instead of 404, so marking this test as fixme to investigate and fix the issue
    Examples:
        | sourceSystemId |
        | -1             |

  @negative @unconventional
  Scenario Outline: PUT activate instance with unconventional id values
    When I define a PUT "activate instance request"
    And I set "id" to "<id>"
    Then I send the activate instance request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | id   |
      | null |
      | abc  |
      | 1.5  |
      | @!$  |

    @fixme
    Examples:
      | id |
      | -1 |

  @negative @unconventional
  Scenario Outline: PUT deactivate instance with unconventional id values
    When I define a PUT "deactivate instance request"
    And I set "id" to "<id>"
    Then I send the deactivate instance request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | id   |
      | null |
      | abc  |
      | 1.5  |
      | @!$  |

    @fixme
    Examples:
      | id |
      | -1 |

  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. GET /instances/source-system/{sourceSystemId}/id — no response schema defined.
  #    The 200 response body is undocumented; need a live API call to determine the shape.
  # 2. PUT /instances/{id}/activate — no response schema defined for 200.
  # 3. PUT /instances/{id}/deactivate — no response schema defined for 200.
  # 4. No error response schemas (4xx/5xx) are documented on any Instance endpoint.
  # 5. The Instance component schema uses OpenAPI nullable: true — verify against actual
  #    API response to confirm fields and nullability before tightening additionalProperties.
