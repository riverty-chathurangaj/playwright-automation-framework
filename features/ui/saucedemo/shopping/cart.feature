@ui @saucedemo-shopping
Feature: Sauce Demo Shopping
  As a sample UI automation user
  I want a simple product flow on a public site
  So that the framework shows how to model reusable shopping journeys

  @smoke
  Scenario: Standard user can add a product to the cart
    Given I am on the Sauce Demo inventory page as the standard user
    When I add the Sauce Demo item "Sauce Labs Backpack" to the cart
    Then the Sauce Demo cart badge should show 1
    When I open the Sauce Demo cart
    Then the Sauce Demo cart should contain the item "Sauce Labs Backpack"
