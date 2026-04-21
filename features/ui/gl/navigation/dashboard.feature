@ui @gl-navigation
Feature: Dashboard Navigation
  As an authenticated GL UI user
  I want reusable authenticated browser coverage
  So that smoke scenarios can skip repeated UI login setup

  @authenticated @smoke
  Scenario: Authenticated user can load the dashboard
    Given I am on the dashboard
    Then the application shell should be ready

  @ui @authenticated
  Scenario Outline: Authenticated user can access a named menu item
    Given I am on the dashboard
    When I open the user menu
    Then the menu item "<label>" should be visible

    Examples:
      | label    |
      | Profile  |
      | Settings |
