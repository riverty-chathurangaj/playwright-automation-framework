import { BasePage } from '@ui-core/base.page';

class SauceDemoInventoryPageObject extends BasePage {
  private static instance: SauceDemoInventoryPageObject;

  static getInstance(): SauceDemoInventoryPageObject {
    if (!SauceDemoInventoryPageObject.instance) {
      SauceDemoInventoryPageObject.instance = new SauceDemoInventoryPageObject();
    }

    return SauceDemoInventoryPageObject.instance;
  }

  pageTitle = () =>
    this.page
      .locator('[data-test="title"]')
      .or(this.page.getByText(/^products$/i))
      .or(this.page.getByRole('heading', { name: /products/i }))
      .first();

  inventoryContainer = () => this.page.locator('[data-test="inventory-list"]').first();

  inventoryItem = (itemName: string) =>
    this.page
      .locator('.inventory_item')
      .filter({ has: this.page.getByText(itemName, { exact: true }) })
      .first();

  addToCartButton = (itemName: string) =>
    this.inventoryItem(itemName)
      .locator('button')
      .filter({ hasText: /add to cart/i })
      .first();

  cartLink = () =>
    this.page.locator('[data-test="shopping-cart-link"]').or(this.page.locator('.shopping_cart_link')).first();

  cartBadge = () =>
    this.page.locator('[data-test="shopping-cart-badge"]').or(this.page.locator('.shopping_cart_badge')).first();

  waitForReady = async () => {
    await this.waitForVisible(this.inventoryContainer());
    await this.waitForVisible(this.pageTitle());
  };

  addItemToCart = async (itemName: string) => {
    await this.waitForReady();
    await this.waitForVisible(this.inventoryItem(itemName));
    await this.addToCartButton(itemName).click();
  };

  openCart = async () => {
    await this.cartLink().click();
  };
}

export const SauceDemoInventoryPage = SauceDemoInventoryPageObject.getInstance();
