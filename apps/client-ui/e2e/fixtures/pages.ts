import type { Locator, Page } from '@playwright/test';
import type { TestAccount } from './accounts';

/** Key TokenStorageService persists the session under. */
export const SESSION_STORAGE_KEY = 'ts.auth.session';

/** The session shape TokenStorageService writes to localStorage. */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly passwordToggle: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly registerLink: Locator;

  constructor(readonly page: Page) {
    this.email = page.locator('#email');
    this.password = page.locator('#password');
    this.passwordToggle = page.getByRole('button', { name: /^(Show|Hide) password$/ });
    this.submit = page.getByRole('button', { name: /^Sign(ing)? in/ });
    this.error = page.getByRole('alert');
    this.registerLink = page.getByRole('link', { name: 'Create one' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.email.waitFor();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

export class RegisterPage {
  readonly firstName: Locator;
  readonly middleName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly dateOfBirth: Locator;
  readonly ssn: Locator;
  readonly ssnToggle: Locator;
  readonly address: Locator;
  readonly traderLevel: Locator;
  readonly availableFunds: Locator;
  readonly password: Locator;
  readonly passwordToggle: Locator;
  readonly confirmPassword: Locator;
  readonly confirmPasswordToggle: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly loginLink: Locator;

  constructor(readonly page: Page) {
    this.firstName = page.locator('#firstName');
    this.middleName = page.locator('#middleName');
    this.lastName = page.locator('#lastName');
    this.email = page.locator('#email');
    this.dateOfBirth = page.locator('#dateOfBirth');
    this.ssn = page.locator('#ssn');
    this.ssnToggle = page.getByRole('button', { name: /^(Show|Hide) SSN$/ });
    this.address = page.locator('#address');
    this.traderLevel = page.locator('#traderLevel');
    this.availableFunds = page.locator('#availableFunds');
    this.password = page.locator('#password');
    this.passwordToggle = page.getByRole('button', { name: /^(Show|Hide) password$/ });
    this.confirmPassword = page.locator('#confirmPassword');
    this.confirmPasswordToggle = page.getByRole('button', {
      name: /^(Show|Hide) confirmation password$/,
    });
    this.submit = page.getByRole('button', { name: /^Creat(e|ing) account/ });
    this.error = page.getByRole('alert');
    this.loginLink = page.getByRole('link', { name: 'Sign in' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.email.waitFor();
  }

  /** Fills every field without submitting, so a test can inspect the form first. */
  async fill(account: TestAccount): Promise<void> {
    await this.firstName.fill(account.firstName);
    await this.middleName.fill(account.middleName);
    await this.lastName.fill(account.lastName);
    await this.email.fill(account.email);
    await this.dateOfBirth.fill(account.dateOfBirth);
    // The component reformats raw digits into XXX-XX-XXXX on input, so type the
    // digits and let it do so rather than pasting an already-formatted value.
    await this.ssn.fill(account.ssn.replaceAll('-', ''));
    await this.address.fill(account.address);
    await this.traderLevel.selectOption(account.traderLevel);
    await this.availableFunds.fill(String(account.availableFunds));
    await this.password.fill(account.password);
    await this.confirmPassword.fill(account.password);
  }

  async register(account: TestAccount): Promise<void> {
    await this.fill(account);
    await this.submit.click();
  }
}

/** Reads the persisted session, or null when the user is signed out. */
export async function readStoredSession(page: Page): Promise<StoredSession | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SESSION_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as StoredSession);
}

/**
 * Everything the page persists in the browser: both web storages and all
 * cookies, flattened into one string so a test can assert a secret is absent
 * from every one of them at once.
 */
export async function readAllBrowserStorage(page: Page): Promise<string> {
  const stored = await page.evaluate(() => {
    const dump = (storage: Storage) =>
      Object.keys(storage)
        .map((key) => `${key}=${storage.getItem(key)}`)
        .join('\n');
    return [dump(localStorage), dump(sessionStorage), document.cookie].join('\n');
  });
  const cookies = await page.context().cookies();
  return [stored, cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('\n')].join('\n');
}

/** The dashboard's account and cash controls. */
export class DashboardPage {
  readonly accountMenu: Locator;
  readonly accountMenuTrigger: Locator;
  readonly deposit: Locator;
  readonly withdraw: Locator;
  readonly cash: Locator;
  readonly netWorth: Locator;
  readonly portfolioValue: Locator;
  readonly assets: Locator;
  readonly recentTransactions: Locator;

  constructor(readonly page: Page) {
    this.accountMenu = page.getByTestId('account-dropdown');
    this.accountMenuTrigger = page.getByLabel('Select account');
    this.deposit = page.getByRole('button', { name: 'Deposit', exact: true });
    this.withdraw = page.getByRole('button', { name: 'Withdraw', exact: true });
    this.cash = page.getByText(/^Cash \$/);
    this.netWorth = page.getByTestId('net-worth');
    this.portfolioValue = page.getByTestId('portfolio-value');
    this.assets = page.getByTestId('assets-table');
    this.recentTransactions = page.getByTestId('recent-transactions');
  }

  /** Opens the account menu and returns the accounts it lists, in order. */
  async listedAccounts(): Promise<string[]> {
    await this.accountMenuTrigger.click();
    const items = this.accountMenu.getByRole('menuitemradio');
    const names = await items.locator('span.truncate').allTextContents();
    await this.accountMenuTrigger.click();
    return names.map((name) => name.trim());
  }

  /** Opens the new account dialog from the account menu. */
  async openNewAccount(): Promise<Locator> {
    await this.accountMenuTrigger.click();
    await this.accountMenu.getByRole('menuitem', { name: 'New account' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'New account' });
    await dialog.waitFor();
    return dialog;
  }

  async createAccount(name: string): Promise<Locator> {
    const dialog = await this.openNewAccount();
    await dialog.getByLabel('Account name').fill(name);
    await dialog.getByRole('button', { name: 'Create account' }).click();
    return dialog;
  }

  async selectAccount(name: string): Promise<void> {
    await this.accountMenuTrigger.click();
    await this.accountMenu.getByRole('menuitemradio', { name: new RegExp(`^${name} `) }).click();
  }

  /** Deposits or withdraws through the net worth card's dialog. */
  async moveCash(action: 'Deposit' | 'Withdraw', amount: string): Promise<Locator> {
    await (action === 'Deposit' ? this.deposit : this.withdraw).click();
    const dialog = this.page.getByRole('dialog', {
      name: action === 'Deposit' ? 'Deposit funds' : 'Withdraw funds',
    });
    await dialog.getByLabel('Amount').fill(amount);
    await dialog.getByRole('button', { name: action, exact: true }).click();
    return dialog;
  }
}
