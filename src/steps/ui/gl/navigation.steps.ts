import { expect } from '@playwright/test';
import { config } from '@shared-core/config';
import { DashboardPage } from '@ui-pages/gl/dashboard.page';
import { Given, Then, When } from '@ui-fixtures';

Given('I am on the dashboard', async function () {
  await DashboardPage.gotoDashboard();
});

When('I open the user menu', async function () {
  await DashboardPage.userMenuButton().click();
  await DashboardPage.waitForVisible(DashboardPage.menuPanel());
});

When('I choose the menu item {string}', async function ({}, label: string) {
  await DashboardPage.menuItem(label).click();
});

Then('the application shell should be ready', async function () {
  await DashboardPage.waitForReady();
  await expect(DashboardPage.readyMarker()).toBeVisible({ timeout: config.ui.defaultTimeout });
});

Then('the menu item {string} should be visible', async function ({}, label: string) {
  await expect(DashboardPage.menuItem(label)).toBeVisible({ timeout: config.ui.defaultTimeout });
});
