import { BasePage } from '@ui-core/base.page';

class LoginPageObject extends BasePage {
  private static instance: LoginPageObject;

  static getInstance(): LoginPageObject {
    if (!LoginPageObject.instance) {
      LoginPageObject.instance = new LoginPageObject();
    }

    return LoginPageObject.instance;
  }

  pageHeading = () =>
    this.page
      .getByTestId('login-page')
      .or(this.page.getByRole('heading', { name: /sign in|log in|login/i }))
      .or(this.page.getByText(/sign in|log in|login/i).first());

  usernameInput = () =>
    this.page
      .getByTestId('username-input')
      .or(this.page.getByLabel(/username|email/i))
      .or(this.page.getByRole('textbox', { name: /username|email/i }));

  passwordInput = () =>
    this.page
      .getByTestId('password-input')
      .or(this.page.getByLabel(/password/i))
      .or(this.page.locator('input[type="password"]'));

  loginButton = () =>
    this.page.getByTestId('login-button').or(this.page.getByRole('button', { name: /sign in|log in|login/i }));

  errorAlert = () =>
    this.page
      .getByTestId('login-error')
      .or(this.page.getByRole('alert'))
      .or(this.page.getByText(/invalid|incorrect|unable to sign in|sign in failed/i).first());

  gotoLogin = async () => {
    await this.goto('/login');
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

export const LoginPage = LoginPageObject.getInstance();
