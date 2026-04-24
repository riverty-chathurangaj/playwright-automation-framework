import { config } from '@shared-core/config';
import { BasePage } from '@ui-core/base.page';

class SauceDemoLoginPageObject extends BasePage {
  private static instance: SauceDemoLoginPageObject;

  static getInstance(): SauceDemoLoginPageObject {
    if (!SauceDemoLoginPageObject.instance) {
      SauceDemoLoginPageObject.instance = new SauceDemoLoginPageObject();
    }

    return SauceDemoLoginPageObject.instance;
  }

  pageHeading = () =>
    this.page
      .getByRole('heading', { name: /swag labs/i })
      .or(this.page.locator('.login_logo'))
      .or(this.page.getByText(/swag labs/i).first());

  usernameInput = () =>
    this.page.locator('[data-test="username"]').or(this.page.getByRole('textbox', { name: /username/i }));

  passwordInput = () => this.page.locator('[data-test="password"]').or(this.page.locator('input[type="password"]'));

  loginButton = () =>
    this.page.locator('[data-test="login-button"]').or(this.page.getByRole('button', { name: /login/i }));

  errorAlert = () =>
    this.page
      .locator('[data-test="error"]')
      .or(this.page.getByRole('alert'))
      .or(this.page.getByText(/epic sadface|locked out|username and password do not match/i).first());

  gotoLogin = async () => {
    await this.goto(config.ui.sauceDemoBaseUrl);
    await this.waitForVisible(this.usernameInput());
    await this.waitForEnabled(this.loginButton());
  };

  login = async (username: string, password: string) => {
    await this.gotoLogin();
    await this.usernameInput().fill(username);
    await this.passwordInput().fill(password);
    await this.loginButton().click();
  };
}

export const SauceDemoLoginPage = SauceDemoLoginPageObject.getInstance();
