import { newAccount } from './fixtures/accounts';
import type { SeedAccount } from './fixtures/api-stub';
import { expect, test } from './fixtures/test';

const USER = newAccount();

// The stubbed market quotes AAPL at $225.80 (+0.91%) and MSFT at $420.50 (-0.83%), so with these
// costs AAPL is up $51.60 and MSFT is down $29.50.
const SEED: SeedAccount = {
  email: USER.email,
  password: USER.password,
  hasProfile: true,
  availableFunds: 5000,
  tradingAccounts: [
    {
      name: 'Trading',
      holdings: [
        { symbol: 'AAPL', quantity: 2, averageCost: 200 },
        { symbol: 'MSFT', quantity: 1, averageCost: 450 },
      ],
    },
  ],
};

// rgb() of the gain and loss colors in src/styles.css.
const GAIN = 'rgb(37, 235, 105)';
const LOSS = 'rgb(255, 61, 90)';

test.use({ stubOptions: { accounts: [SEED] } });

test.beforeEach(async ({ page, loginPage }) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test.describe('assets dialog', () => {
  test('View all lists every holding with portfolio totals and weights', async ({
    page,
    dashboardPage,
  }) => {
    await expect(dashboardPage.assets.getByTestId('asset-row-AAPL')).toBeVisible();

    await page.getByTestId('open-assets').click();
    const dialog = page.getByRole('dialog', { name: 'Assets' });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByTestId('assets-summary-market-value')).toHaveText('$872.10');
    await expect(dialog.getByTestId('assets-summary-cost-basis')).toHaveText('$850.00');
    await expect(dialog.getByTestId('assets-summary-unrealized')).toHaveText('+$22.10');
    await expect(dialog.getByTestId('assets-summary-unrealized')).toHaveCSS('color', GAIN);
    await expect(dialog.getByTestId('assets-summary-positions')).toHaveText('2');
    await expect(dialog.getByTestId('assets-count')).toHaveText('2 assets');

    // Largest position first: $451.60 of AAPL against $420.50 of MSFT.
    const rows = dialog.locator('[data-testid^="assets-dialog-row-"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-AAPL');
    await expect(rows.first().getByTestId('assets-weight')).toHaveText('51.8%');
    await expect(rows.last().getByTestId('assets-weight')).toHaveText('48.2%');
    await expect(rows.first()).toContainText('Apple Inc.');
    await expect(rows.first()).toContainText('+$51.60');
    await expect(rows.first()).toContainText('+12.90%');
    await expect(rows.last()).toContainText('-$29.50');
    await expect(rows.last()).toContainText('-6.56%');
    await expect(rows.last().getByTestId('assets-weight')).toBeVisible();
    await expect(rows.last().locator('span.text-loss').first()).toHaveCSS('color', LOSS);

    await dialog.getByRole('button', { name: 'Close assets' }).click();
    await expect(dialog).toBeHidden();
  });

  test('sorts by any column and flips direction on a second click', async ({ page }) => {
    await page.getByTestId('open-assets').click();
    const dialog = page.getByRole('dialog', { name: 'Assets' });
    const rows = dialog.locator('[data-testid^="assets-dialog-row-"]');
    await expect(rows).toHaveCount(2);

    const returns = dialog.getByRole('button', { name: 'Sort by Return' });
    await returns.click();
    await expect(returns).toHaveAttribute('data-sort', 'desc');
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-AAPL');
    await returns.click();
    await expect(returns).toHaveAttribute('data-sort', 'asc');
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-MSFT');

    // Another column takes over, descending first.
    await dialog.getByRole('button', { name: 'Sort by Price' }).click();
    await expect(returns).not.toHaveAttribute('data-sort', /.*/);
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-MSFT');
    await dialog.getByRole('button', { name: 'Sort by Asset' }).click();
    await dialog.getByRole('button', { name: 'Sort by Asset' }).click();
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-AAPL');
  });

  test('filters by gain or loss and by symbol or company name', async ({ page }) => {
    await page.getByTestId('open-assets').click();
    const dialog = page.getByRole('dialog', { name: 'Assets' });
    const rows = dialog.locator('[data-testid^="assets-dialog-row-"]');
    await expect(rows).toHaveCount(2);

    await dialog.getByTestId('assets-filter-gainers').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-AAPL');
    await expect(dialog.getByTestId('assets-count')).toHaveText('1 asset');
    await dialog.getByTestId('assets-filter-losers').click();
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-MSFT');
    await dialog.getByTestId('assets-filter-all').click();
    await expect(rows).toHaveCount(2);

    // Company names match as well as tickers, and the totals describe the whole portfolio.
    const filter = dialog.getByLabel('Filter by symbol or name');
    await filter.fill('microsoft');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-testid', 'assets-dialog-row-MSFT');
    await expect(dialog.getByTestId('assets-summary-market-value')).toHaveText('$872.10');

    await filter.fill('zzz');
    await expect(rows).toHaveCount(0);
    await expect(dialog).toContainText('No assets match these filters.');
    await expect(dialog.getByTestId('assets-count')).toHaveText('0 assets');

    await filter.fill('');
    await expect(rows).toHaveCount(2);
  });

  test('choosing an asset leaves the table for its order ticket', async ({ page }) => {
    await page.getByTestId('open-assets').click();
    const assets = page.getByRole('dialog', { name: 'Assets' });

    await assets.getByRole('button', { name: 'Trade MSFT' }).click();

    await expect(assets).toBeHidden();
    const order = page.getByRole('dialog', { name: 'New Order' });
    await expect(order).toBeVisible();
    await expect(order).toContainText('MSFT');
  });

  test('closes with Escape and is only offered on the Assets tab', async ({ page }) => {
    const open = page.getByTestId('open-assets');
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Assets' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByTestId('assets-tab-watchlist').click();
    await expect(open).toHaveCount(0);
    await page.getByTestId('assets-tab-assets').click();
    await expect(open).toBeVisible();
  });

  test('reflects a holding the user just bought', async ({ page, dashboardPage }) => {
    await expect(dashboardPage.assets.getByTestId('asset-row-AAPL')).toBeVisible();
    await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
    await page.getByRole('option').first().click();
    const order = page.getByRole('dialog', { name: 'New Order' });
    await order.locator('#order-shares').fill('1');
    await order.getByRole('button', { name: 'Buy 1 AAPL', exact: true }).click();
    await expect(page.locator('hlm-toaster .toast')).toContainText('Filled 1 AAPL');
    await order.getByRole('button', { name: 'Close order submission' }).click();

    await page.getByTestId('open-assets').click();
    const dialog = page.getByRole('dialog', { name: 'Assets' });
    // Shares follows the asset name among the row's text cells; the sparkline is not a span.
    const row = dialog.getByTestId('assets-dialog-row-AAPL');
    await expect(row.locator('> span').nth(1)).toHaveText('3');
    // The average cost now blends the new purchase in with the two shares held before.
    await expect(row.locator('> span').nth(2)).not.toHaveText('$200.00');
  });
});

test.describe('search bar', () => {
  const search = (page: import('@playwright/test').Page) =>
    page.getByRole('combobox', { name: 'Search instruments' });

  test('states its purpose, shows the shortcut hint and a Trade button', async ({ page }) => {
    const input = search(page);
    await expect(input).toHaveAttribute('placeholder', 'Search a stock to buy or sell');
    await expect(input).toHaveAttribute('aria-keyshortcuts', '/ Control+K Meta+K');
    await expect(page.getByTestId('search-hint')).toContainText('K');
    await expect(page.getByTestId('search-action')).toHaveText('Trade');

    await input.focus();
    await expect(page.getByTestId('search-hint')).toHaveCount(0);
  });

  test('Ctrl+K and a slash focus the search from anywhere on the page', async ({ page }) => {
    const input = search(page);
    await page.locator('body').click({ position: { x: 1, y: 1 } });

    await page.keyboard.press('Control+K');
    await expect(input).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(input).not.toBeFocused();

    await page.keyboard.press('/');
    await expect(input).toBeFocused();
    // The slash opens the search rather than being typed into it.
    await expect(input).toHaveValue('');
  });

  test('a slash typed into another field stays a slash', async ({ page }) => {
    await page.getByTestId('open-assets').click();
    const filter = page.getByLabel('Filter by symbol or name');
    await filter.click();
    await page.keyboard.type('a/b');
    await expect(filter).toHaveValue('a/b');
    await expect(search(page)).not.toBeFocused();
  });

  test('the shortcut does not reach behind an open dialog', async ({ page }) => {
    await page.getByTestId('open-assets').click();
    await expect(page.getByRole('dialog', { name: 'Assets' })).toBeVisible();

    await page.keyboard.press('Control+K');

    await expect(search(page)).not.toBeFocused();
  });

  test('suggests the biggest movers when focused and opens one in the order ticket', async ({
    page,
  }) => {
    const input = search(page);
    await input.focus();

    const trending = page.getByTestId('search-suggestions-Trending');
    await expect(trending.getByRole('option')).toHaveText([/AAPL/, /MSFT/]);
    await expect(page.getByTestId('search-suggestions-Recently viewed')).toHaveCount(0);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    const order = page.getByRole('dialog', { name: 'New Order' });
    await expect(order).toContainText('MSFT');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('remembers what was opened under Recently viewed', async ({ page }) => {
    const input = search(page);
    await input.fill('msft');
    await page.getByRole('option').first().click();
    const order = page.getByRole('dialog', { name: 'New Order' });
    await expect(order).toBeVisible();
    await order.getByRole('button', { name: 'Close order submission' }).click();
    await expect(order).toBeHidden();

    await input.focus();
    const recent = page.getByTestId('search-suggestions-Recently viewed');
    await expect(recent.getByRole('option')).toHaveText([/MSFT/]);

    // The list survives a reload within the tab.
    await page.reload();
    await search(page).focus();
    await expect(
      page.getByTestId('search-suggestions-Recently viewed').getByRole('option'),
    ).toHaveText([/MSFT/]);
  });

  test('typing replaces suggestions with matches, and says when there are none', async ({
    page,
  }) => {
    const input = search(page);
    await input.fill('apple');
    await expect(page.getByRole('option')).toHaveText([/AAPL/]);
    await expect(page.getByTestId('search-suggestions-Trending')).toHaveCount(0);

    await input.fill('zzzz');
    await expect(page.getByRole('listbox')).toContainText('No instruments match "zzzz"');

    await input.fill('');
    await expect(page.getByTestId('search-suggestions-Trending')).toBeVisible();
  });

  test('the Trade button opens the best match, or focuses the search when empty', async ({
    page,
  }) => {
    const trade = page.getByTestId('search-action');
    await trade.click();
    await expect(search(page)).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'New Order' })).toHaveCount(0);

    await search(page).fill('micro');
    await trade.click();
    const order = page.getByRole('dialog', { name: 'New Order' });
    await expect(order).toContainText('MSFT');
  });

  test('Escape clears a query first and then leaves the search', async ({ page }) => {
    const input = search(page);
    await input.fill('app');
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(input).not.toBeFocused();
  });
});
