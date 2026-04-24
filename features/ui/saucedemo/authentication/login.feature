@ui @saucedemo-authentication
Feature: Sauce Demo Authentication
  As a sample UI automation user
  I want a public site that demonstrates the framework's UI patterns
  So that we have stable example coverage for login behavior

  @smoke
  Scenario: Standard user can log in to Sauce Demo
    Given I am on the Sauce Demo login page
    When I sign in to Sauce Demo as the standard user
    Then I should see the Sauce Demo inventory page

  Scenario: Invalid credentials show a login error on Sauce Demo
    Given I am on the Sauce Demo login page
    When I sign in to Sauce Demo with username "standard_user" and password "not-the-right-password"
    Then I should see a Sauce Demo login error
