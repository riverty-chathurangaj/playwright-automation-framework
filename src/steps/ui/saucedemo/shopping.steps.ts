import { expect } from '@playwright/test';
import { config } from '@shared-core/config';
import { Given, Then, When } from '@ui-fixtures';
import { SauceDemoCartPage } from '@ui-pages/saucedemo/cart.page';
import { SauceDemoInventoryPage } from '@ui-pages/saucedemo/inventory.page';
import { SauceDemoLoginPage } from '@ui-pages/saucedemo/login.page';

const standardUserCredentials = {
  username: 'standard_user',
  password: 'secret_sauce',
};

Given('I am on the Sauce Demo inventory page as the standard user', async function () {
  await SauceDemoLoginPage.login(standardUserCredentials.username, standardUserCredentials.password);
  await SauceDemoInventoryPage.waitForReady();
});

When('I add the Sauce Demo item {string} to the cart', async function ({}, itemName: string) {
  await SauceDemoInventoryPage.addItemToCart(itemName);
});

When('I open the Sauce Demo cart', async function () {
  await SauceDemoInventoryPage.openCart();
  await SauceDemoCartPage.waitForReady();
});

Then('the Sauce Demo cart badge should show {int}', async function ({}, count: number) {
  await expect(SauceDemoInventoryPage.cartBadge()).toHaveText(String(count), {
    timeout: config.ui.defaultTimeout,
  });
});

Then('the Sauce Demo cart should contain the item {string}', async function ({}, itemName: string) {
  await SauceDemoCartPage.waitForReady();
  await expect(SauceDemoCartPage.cartItem(itemName)).toBeVisible({ timeout: config.ui.defaultTimeout });
});
