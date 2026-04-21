@ui @gl-authentication
Feature: UI Authentication
  As a GL UI user
  I want to sign in through the browser
  So that I can access the authenticated experience

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my valid UI credentials
    And I sign in via the login page
    Then I should land on the dashboard
    And the application shell should be ready

  @ui
  Scenario: Login fails with invalid credentials
    Given I am on the login page
    When I enter the username "invalid.user@example.com" and password "invalid-password"
    And I sign in via the login page
    Then I should see a login error
