import { type Page } from '@playwright/test';
import { pickFilter, expectCount, tableRows } from './fixtures/screens';
import {
  admin,
  analyst,
  customers,
  fullName,
  orders,
  shortLived,
  trader,
  usd,
} from './fixtures/scenario';
import { expect, test } from './fixtures/test';

const PRIYA = customers[2];
const JANE = customers[0];
const MARCUS = customers[1];

// The trader account the suite uses for "right password, no role" is a customer too: a
// sign-in record with the TRADER role and nothing else, so it has no profile and no accounts.
const LISTED = customers.length + 1;

const portfolio = (customer: (typeof customers)[number]) =>
  customer.accounts.reduce((total, account) => total + account.valuation, 0);

async function openCustomers(
  page: Page,
  openAsAdmin: (path?: string) => Promise<void>,
): Promise<void> {
  await openAsAdmin('/customers');
  await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible();
  await expectCount(page, LISTED, LISTED, 'customers');
}

test.describe('Customers', () => {
  test('lists every trader with what the service holds on them', async ({ page, openAsAdmin }) => {
    await openCustomers(page, openAsAdmin);

    for (const customer of customers) {
      const row = tableRows(page).filter({ hasText: customer.email });
      await expect(row).toContainText(fullName(customer));
      await expect(row).toContainText(customer.lockedForHours ? /locked/i : /active/i);
      await expect(row).toContainText(usd(customer.funds, 2));
      await expect(row).toContainText(usd(portfolio(customer), 2));
      await expect(row).toContainText(String(customer.failedLoginAttempts));
    }
  });

  test('shows a trader with no profile by their email', async ({ page, openAsAdmin }) => {
    await openCustomers(page, openAsAdmin);

    await expect(tableRows(page).filter({ hasText: trader.email })).toContainText(usd(0, 2));
  });

  test('leaves out analysts and admins, who are staff and not customers', async ({
    page,
    openAsAdmin,
  }) => {
    await openCustomers(page, openAsAdmin);

    // Ada Admin has a trading profile, so only her role keeps her out of the list.
    for (const text of [admin.email, 'Ada Admin', analyst.email, shortLived.email]) {
      await expect(tableRows(page).filter({ hasText: text })).toHaveCount(0);
    }
  });

  test('finds a customer by name, email or user ID', async ({ page, openAsAdmin }) => {
    await openCustomers(page, openAsAdmin);
    const search = page.getByPlaceholder('Name, email or user ID');

    await search.fill('priya');
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(PRIYA.email);

    await search.fill(MARCUS.email);
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(fullName(MARCUS));

    await search.fill(JANE.userId);
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(fullName(JANE));

    await search.fill('nobody by this name');
    await expect(page.getByText('No customers match these filters.')).toBeVisible();
  });

  test('narrows by status, trader level and flag, and clears them together', async ({
    page,
    openAsAdmin,
  }) => {
    await openCustomers(page, openAsAdmin);

    await pickFilter(page, 'Status', /^locked$/i);
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(PRIYA.email);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Trader level', 'Advanced');
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(MARCUS.email);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Flags', 'Failed sign-ins');
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(PRIYA.email);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Flags', 'No accounts');
    await expectCount(page, 1, LISTED, 'customers');
    await expect(tableRows(page)).toContainText(trader.email);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expectCount(page, LISTED, LISTED, 'customers');
  });

  test('sorts by a column, and back the other way', async ({ page, openAsAdmin }) => {
    await openCustomers(page, openAsAdmin);
    const sortByCash = page.getByRole('button', { name: 'Sort by Cash' });
    // The cash of each row, top to bottom: the first dollar figure in it (the second is the portfolio).
    const cash = async () =>
      (await tableRows(page).allInnerTexts()).map((text) =>
        Number(text.match(/\$([\d,]+\.\d{2})/)![1].replaceAll(',', '')),
      );
    // The trader with no profile holds none.
    const ascending = [0, ...customers.map((customer) => customer.funds)].sort((a, b) => a - b);
    const descending = [...ascending].reverse();

    // The list opens in no particular order. Whichever way the first click sorts, the second
    // sorts the other way.
    await sortByCash.click();
    let clickedAscending = false;
    await expect
      .poll(async () => {
        const shown = (await cash()).join();
        clickedAscending = shown === ascending.join();
        return clickedAscending || shown === descending.join();
      })
      .toBe(true);

    await sortByCash.click();
    await expect.poll(cash).toEqual(clickedAscending ? descending : ascending);
  });
});

test.describe('One customer', () => {
  test('opens from the list with profile, security, balances and their own orders', async ({
    page,
    openAsAdmin,
  }) => {
    await openCustomers(page, openAsAdmin);

    await tableRows(page).filter({ hasText: PRIYA.email }).getByRole('link').click();

    await expect(page).toHaveURL(new RegExp(`/customers/${PRIYA.userId}$`));
    await expect(page.getByRole('heading', { name: fullName(PRIYA), level: 1 })).toBeVisible();
    await expect(page.getByText(`${PRIYA.email} · ${PRIYA.userId} · trader`)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Account locked' })).toContainText(
      `Account locked after ${PRIYA.failedLoginAttempts} failed sign-in attempts. Unlocks automatically`,
    );
    await expect(page.getByText('Beginner', { exact: true })).toBeVisible();
    const total = PRIYA.funds + portfolio(PRIYA);
    await expect(page.getByText(usd(total))).toBeVisible();
    await expect(page.getByText(usd(PRIYA.funds, 2))).toBeVisible();
    for (const account of PRIYA.accounts) {
      await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(usd(account.valuation, 2))).toBeVisible();
    }
  });

  test("lists only that customer's orders and transfers, filterable like Orders", async ({
    page,
    openAsAdmin,
  }) => {
    await openAsAdmin(`/customers/${JANE.userId}`);
    const own = orders.filter((order) =>
      JANE.accounts.some((a) => a.accountId === order.accountId),
    );
    // Jane's account 1 also holds the one deposit.
    const rows = own.length + 1;

    await expectCount(page, rows, rows, 'rows');
    for (const order of own) {
      await expect(page.getByRole('button', { name: `Open order ${order.orderId}` })).toBeVisible();
    }
    for (const order of orders.filter((candidate) => !own.includes(candidate))) {
      await expect(page.getByRole('button', { name: `Open order ${order.orderId}` })).toHaveCount(
        0,
      );
    }

    await pickFilter(page, 'Status', /^rejected$/i);
    await expectCount(
      page,
      own.filter((order) => order.status === 'REJECTED').length,
      rows,
      'rows',
    );
  });

  test('goes back to the list', async ({ page, openAsAdmin }) => {
    await openAsAdmin(`/customers/${MARCUS.userId}`);
    await expect(page.getByRole('heading', { name: fullName(MARCUS), level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Back to customers' }).click();

    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible();
  });

  for (const [description, userId] of [
    ['one the service has never heard of', '00000000-0000-4000-8000-000000000000'],
    ['an admin, who is not a customer', admin.userId],
  ] as const) {
    test(`says it could not load ${description}`, async ({ page, openAsAdmin }) => {
      await openAsAdmin(`/customers/${userId}`);

      await expect(page.getByRole('alert')).toContainText("We couldn't load this customer.");
      await expect(page.getByRole('link', { name: 'Back to customers' })).toBeVisible();
    });
  }
});
