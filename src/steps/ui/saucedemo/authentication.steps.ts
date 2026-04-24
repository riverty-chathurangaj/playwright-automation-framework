import { expect } from '@playwright/test';
import { config } from '@shared-core/config';
import { Given, Then, When } from '@ui-fixtures';
import { SauceDemoInventoryPage } from '@ui-pages/saucedemo/inventory.page';
import { SauceDemoLoginPage } from '@ui-pages/saucedemo/login.page';

const standardUserCredentials = {
  username: 'standard_user',
  password: 'secret_sauce',
};

Given('I am on the Sauce Demo login page', async function () {
  await SauceDemoLoginPage.gotoLogin();
  await SauceDemoLoginPage.waitForVisible(SauceDemoLoginPage.usernameInput());
});

Given('I am signed in to Sauce Demo as the standard user', async function () {
  await SauceDemoLoginPage.login(standardUserCredentials.username, standardUserCredentials.password);
  await SauceDemoInventoryPage.waitForReady();
});

When('I sign in to Sauce Demo as the standard user', async function () {
  await SauceDemoLoginPage.login(standardUserCredentials.username, standardUserCredentials.password);
});

When(
  'I sign in to Sauce Demo with username {string} and password {string}',
  async function ({}, username: string, password: string) {
    await SauceDemoLoginPage.login(username, password);
  },
);

Then('I should see the Sauce Demo inventory page', async function () {
  await SauceDemoInventoryPage.waitForReady();
  await expect(SauceDemoInventoryPage.pageTitle()).toBeVisible({ timeout: config.ui.defaultTimeout });
});

Then('I should see a Sauce Demo login error', async function () {
  await expect(SauceDemoLoginPage.errorAlert()).toBeVisible({ timeout: config.ui.defaultTimeout });
});
