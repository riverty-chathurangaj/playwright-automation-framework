import { BasePage } from '@ui-core/base.page';

class SauceDemoCartPageObject extends BasePage {
  private static instance: SauceDemoCartPageObject;

  static getInstance(): SauceDemoCartPageObject {
    if (!SauceDemoCartPageObject.instance) {
      SauceDemoCartPageObject.instance = new SauceDemoCartPageObject();
    }

    return SauceDemoCartPageObject.instance;
  }

  pageTitle = () =>
    this.page
      .locator('[data-test="title"]')
      .or(this.page.getByText(/^your cart$/i))
      .or(this.page.getByRole('heading', { name: /your cart/i }))
      .first();

  cartContainer = () => this.page.locator('[data-test="cart-list"]').or(this.page.locator('.cart_list')).first();

  cartItem = (itemName: string) =>
    this.page
      .locator('.cart_item')
      .filter({ has: this.page.getByText(itemName, { exact: true }) })
      .first();

  waitForReady = async () => {
    await this.waitForVisible(this.pageTitle());
    await this.waitForVisible(this.cartContainer());
  };
}

export const SauceDemoCartPage = SauceDemoCartPageObject.getInstance();
