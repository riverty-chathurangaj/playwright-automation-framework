@api @gl-postings
Feature: Postings
  As a user of the GL API
  I should be able to retrieve posting information for a given instance

  Background:
    Given I am authenticated as "a valid client"

  @api @gl-postings @smoke
  Scenario Outline: I should be able to get a list of postings for a given instance
    When I define a GET "postings request"
    And I set "instanceId" to "<instanceId>"
    Then I send the postings request to the API
    And I get the response code of OK
    And the response should be an array of postings
    And each item in the response array should match schema "gl-posting"

    Examples:
      | instanceId |
      | 2001       |
      | 2002       |

  @api @gl-postings
  Scenario: Schema validation for postings response
    When I define a GET "postings request"
    And I set "instanceId" to "2001"
    Then I send the postings request to the API
    And I get the response code of OK
    And each item in the response array should match schema "gl-posting"

  @api @gl-postings
  Scenario: Verify behavior when getting postings for invalid instanceId
    When I define a GET "postings request"
    And I set "instanceId" to "99999"
    Then I send the postings request to the API
    And I get the response code of OK
    And the response should be an empty array

  @api @gl-postings
  Scenario: I should be able to get postings with orderBy parameter
    When I define a GET "postings request"
    And I set "instanceId" to "2001"
    And I set postings request query parameters:
      | orderBy |
      | name    |
    Then I send the postings request to the API
    And I get the response code of OK
    And the response should be an array of postings
    And each item in the response array should match schema "gl-posting"


# ── Negative & invalid input scenarios ────────────────────────────────
  @api @gl-postings
  Scenario Outline: GET postings with invalid format of instanceId values
    When I define a GET "postings request"
    And I set "instanceId" to "<instanceId>"
    Then I send the postings request to the API
    And the response status should be BadRequest or NotFound

    Examples:
      | instanceId |
      | null       |
      | abc        |
      | 1.5        |
      | @!$        |


  # ── Swagger schema gaps ────────────────────────────────────────────────────
  # 1. GET /{instanceId}/postings — the GLPosting schema has no required fields defined.
  # 2. GET /{instanceId}/postings — the orderBy query parameter has no documentation on
  #    valid values or sort direction.
  # 3. The local swagger.json references endpoints GET /{instanceId}/rules/postings and
  #    GET /{instanceId}/rules/postings/{postingId} that do not exist on the hosted
  #    swagger page — these may be deprecated or removed.
  # 4. There some posting rules and posting events requests in the swagger schemas but not displayed in hosted swagger page

