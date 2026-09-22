import { test as base } from '@playwright/test';
import { ApiStub, type StubOptions } from './api-stub';
import { DashboardPage, LoginPage, RegisterPage } from './pages';

interface AuthFixtures {
  /**
   * Per-test stub configuration. Override it with
   * `test.use({ stubOptions: { ... } })` to seed accounts, shorten the access
   * token lifetime, or force the profile step to fail.
   */
  stubOptions: StubOptions;
  api: ApiStub;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
}

export const test = base.extend<AuthFixtures>({
  stubOptions: [{}, { option: true }],

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
});

export { expect } from '@playwright/test';
