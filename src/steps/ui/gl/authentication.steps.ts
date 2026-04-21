import { expect } from '@playwright/test';
import { config } from '@shared-core/config';
import { DashboardPage } from '@ui-pages/gl/dashboard.page';
import { LoginPage } from '@ui-pages/gl/login.page';
import { Given, Then, When } from '@ui-fixtures';

Given('I am on the login page', async function () {
  await LoginPage.gotoLogin();
  await LoginPage.waitForVisible(LoginPage.usernameInput());
});

When('I enter my valid UI credentials', async function () {
  if (!config.ui.username || !config.ui.password) {
    throw new Error('UI_USERNAME and UI_PASSWORD must be set to run the valid UI login scenario.');
  }

  await LoginPage.usernameInput().fill(config.ui.username);
  await LoginPage.passwordInput().fill(config.ui.password);
});

When('I enter the username {string} and password {string}', async function ({}, username: string, password: string) {
  await LoginPage.usernameInput().fill(username);
  await LoginPage.passwordInput().fill(password);
});

When('I sign in via the login page', async function () {
  await LoginPage.loginButton().click();
});

Then('I should land on the dashboard', async function () {
  await DashboardPage.waitForReady();
  await expect(DashboardPage.readyMarker()).toBeVisible({ timeout: config.ui.defaultTimeout });
});

Then('I should see a login error', async function () {
  await expect(LoginPage.errorAlert()).toBeVisible({ timeout: config.ui.defaultTimeout });
});
