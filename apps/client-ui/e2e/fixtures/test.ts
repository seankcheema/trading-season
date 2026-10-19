import { test as base } from '@playwright/test';
import { ApiStub, type StubOptions } from './api-stub';
import { DashboardPage, LoginPage, RegisterPage, TermsDialog } from './pages';

interface AuthFixtures {
  /**
   * Per-test stub configuration. Override it with
   * `test.use({ stubOptions: { ... } })` to seed accounts, shorten the access
   * token lifetime, or force the profile step to fail.
   */
  stubOptions: StubOptions;
  /**
   * Whether the browser has already finished the dashboard's first-run tour,
   * which otherwise covers the dashboard. Set it to false to test the tour.
   */
  tourDone: boolean;
  tourProgress: void;
  api: ApiStub;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  termsDialog: TermsDialog;
}

export const test = base.extend<AuthFixtures>({
  stubOptions: [{}, { option: true }],
  tourDone: [true, { option: true }],

  tourProgress: [
    async ({ page, tourDone }, use) => {
      if (tourDone) {
        await page.addInitScript(() => localStorage.setItem('ts.tour.done', '1'));
      }
      await use();
    },
    { auto: true },
  ],

  // Automatic so interception is always in place before the first navigation,
  // whether or not the test asks for the stub by name.
  api: [
    async ({ page, stubOptions }, use) => {
      const api = new ApiStub(stubOptions);
      await api.install(page);
      await use(api);
    },
    { auto: true },
  ],

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  termsDialog: async ({ page }, use) => {
    await use(new TermsDialog(page));
  },
});

export { expect } from '@playwright/test';
