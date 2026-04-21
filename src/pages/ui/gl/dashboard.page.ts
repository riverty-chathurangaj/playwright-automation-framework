import { BasePage } from '@ui-core/base.page';

function toTestIdFragment(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

class DashboardPageObject extends BasePage {
  private static instance: DashboardPageObject;

  static getInstance(): DashboardPageObject {
    if (!DashboardPageObject.instance) {
      DashboardPageObject.instance = new DashboardPageObject();
    }

    return DashboardPageObject.instance;
  }

  pageHeading = () =>
    this.page
      .getByTestId('dashboard-heading')
      .or(this.page.getByRole('heading', { name: /dashboard|general ledger|overview/i }))
      .or(this.page.getByText(/dashboard|general ledger|overview/i).first());

  userMenuButton = () =>
    this.page
      .getByTestId('user-menu-button')
      .or(this.page.getByRole('button', { name: /user menu|account|profile|menu/i }));

  menuPanel = () => this.page.getByTestId('user-menu-panel').or(this.page.getByRole('menu'));

  menuItem = (label: string) =>
    this.page
      .getByTestId(`menu-item-${toTestIdFragment(label)}`)
      .or(this.page.getByRole('menuitem', { name: label }))
      .or(this.page.getByRole('link', { name: label }))
      .or(this.page.getByText(label, { exact: true }));

  readyMarker = () => this.pageHeading().or(this.userMenuButton()).or(this.applicationShell());

  gotoDashboard = async () => {
    await this.goto('/');
    await this.waitForReady();
  };

  waitForReady = async () => {
    await this.waitForVisible(this.readyMarker());
  };
}

export const DashboardPage = DashboardPageObject.getInstance();
