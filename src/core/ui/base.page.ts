import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { config } from '@shared-core/config';

export abstract class BasePage {
  private boundPage?: Page;

  bind(page: Page): this {
    this.boundPage = page;
    return this;
  }

  clearBinding(): this {
    this.boundPage = undefined;
    return this;
  }

  protected get page(): Page {
    if (!this.boundPage) {
      throw new Error(`${this.constructor.name} is not bound to a Playwright page. Bind it in the UI fixtures first.`);
    }

    return this.boundPage;
  }

  goto = async (pathname = '/') => {
    await this.page.goto(pathname);
  };

  applicationShell = () => this.page.getByTestId('app-shell').or(this.page.getByRole('main'));

  toast = (message?: string) => {
    const toast = this.page.getByTestId('toast').or(this.page.getByRole('status')).or(this.page.getByRole('alert'));
    return message ? toast.filter({ hasText: message }) : toast;
  };

  modal = (name?: string) => {
    const dialog = this.page.getByTestId('modal').or(this.page.getByRole('dialog'));
    return name ? dialog.filter({ hasText: name }) : dialog;
  };

  waitForVisible = async (locator: Locator) => {
    await locator.waitFor({ state: 'visible', timeout: config.ui.defaultTimeout });
  };

  waitForHidden = async (locator: Locator) => {
    await locator.waitFor({ state: 'hidden', timeout: config.ui.defaultTimeout });
  };

  waitForEnabled = async (locator: Locator) => {
    await expect(locator).toBeEnabled({ timeout: config.ui.defaultTimeout });
  };

  waitForApplicationShell = async () => {
    await this.waitForVisible(this.applicationShell());
  };
}
