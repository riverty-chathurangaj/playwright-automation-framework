@security
Feature: Security — Authentication & Authorization
  As a consumer of the GL API
  Requests without valid authentication credentials should be rejected
  to ensure the API is protected against unauthorized access

  # ── Unauthenticated access ────────────────────────────────────────────

  @security @smoke
  Scenario Outline: Unauthenticated GET requests should return Unauthorized
    Given I am not authenticated
    When I define a GET "<request>"
    Then I send the request to the API
    And the response status should be Unauthorized

    Examples:
      | request                    |
      | instances request          |
      | clients request            |
      | client departments request |
      | accounts request           |
      | transactions request       |
      | balance request            |
      | balance listing request    |
      | client balance request     |
      | balance report request     |
      | postings request           |

  @security
  Scenario Outline: Unauthenticated POST requests should return Unauthorized
    Given I am not authenticated
    When I define a POST "<request>"
    And I set "instanceId" to "2022"
    And I add query parameter "clientId" with value "67198"
    And I add query parameter "year" with value "2024"
    And I add query parameter "month" with value "1"
    Then I send the request to the API
    And the response status should be Unauthorized

    Examples:
      | request                        |
      | close accounting month request |
      | open accounting month request  |

  @security
  Scenario Outline: Unauthenticated PUT requests should return Unauthorized
    Given I am not authenticated
    When I define a PUT "<request>"
    And I set "id" to "2001"
    Then I send the request to the API
    And the response status should be Unauthorized

    Examples:
      | request                     |
      | activate instance request   |
      | deactivate instance request |

  # ── Invalid token ─────────────────────────────────────────────────────

  @security
  Scenario Outline: Invalid token GET requests should be rejected
    Given I am authenticated with an invalid token
    When I define a GET "<request>"
    Then I send the request to the API
    And the response status should be BadRequest

    Examples:
      | request                    |
      | instances request          |
      | clients request            |
      | client departments request |
      | accounts request           |
      | transactions request       |
      | balance request            |
      | balance listing request    |
      | client balance request     |
      | balance report request     |
      | postings request           |

  @security @fixme
  Scenario Outline: Invalid token POST requests should be rejected
    Given I am authenticated with an invalid token
    When I define a POST "<request>"
    And I set "instanceId" to "2022"
    And I add query parameter "clientId" with value "67198"
    And I add query parameter "year" with value "2024"
    And I add query parameter "month" with value "1"
    Then I send the request to the API
    And the response status should be Unauthorized or Forbidden

    Examples:
      | request                        |
      | close accounting month request |
      | open accounting month request  |

  @security
  Scenario Outline: Invalid token PUT requests should be rejected
    Given I am authenticated with an invalid token
    When I define a PUT "<request>"
    And I set "id" to "2001"
    Then I send the request to the API
    And the response status should be BadRequest

    Examples:
      | request                     |
      | activate instance request   |
      | deactivate instance request |

  # ── Expired token ─────────────────────────────────────────────────────

  @security
  Scenario Outline: Expired token GET requests should be rejected
    Given I am authenticated with an expired token
    When I define a GET "<request>"
    Then I send the request to the API
    And the response status should be Unauthorized or Forbidden

    Examples:
      | request                    |
      | instances request          |
      | clients request            |
      | client departments request |
      | accounts request           |
      | transactions request       |
      | balance request            |
      | balance listing request    |
      | client balance request     |
      | balance report request     |
      | postings request           |

  @security @fixme
  Scenario Outline: Expired token POST requests should be rejected
    Given I am authenticated with an expired token
    When I define a POST "<request>"
    And I set "instanceId" to "2022"
    And I add query parameter "clientId" with value "67198"
    And I add query parameter "year" with value "2024"
    And I add query parameter "month" with value "1"
    Then I send the request to the API
    And the response status should be Unauthorized or Forbidden

    Examples:
      | request                        |
      | close accounting month request |
      | open accounting month request  |

  @security
  Scenario Outline: Expired token PUT requests should be rejected
    Given I am authenticated with an expired token
    When I define a PUT "<request>"
    And I set "id" to "2001"
    Then I send the request to the API
    And the response status should be Unauthorized or Forbidden

    Examples:
      | request                     |
      | activate instance request   |
      | deactivate instance request |

