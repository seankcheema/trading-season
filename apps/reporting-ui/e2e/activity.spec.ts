import { readFile } from 'node:fs/promises';
import { type Locator, type Page } from '@playwright/test';
import {
  RANGE_LABELS,
  type Range,
  bySegment,
  bySymbol,
  customerOf,
  figures,
  fullName,
  orders,
  ordersIn,
  usd,
} from './fixtures/scenario';
import { expect, test } from './fixtures/test';

const RANGES: Range[] = ['today', '7d', '30d', '90d', 'all'];
const RANGE_KEY = 'ts.reporting.activity-range';

const heading = (page: Page) => page.getByRole('heading', { name: 'Activity', level: 1 });

/** A headline tile or a card, found by its small heading. */
const card = (page: Page, name: string | RegExp): Locator =>
  page.locator('section').filter({
    has: page.getByRole('heading', {
      name: typeof name === 'string' ? new RegExp(`^${name}$`, 'i') : name,
    }),
  });

const toggle = (page: Page) => page.getByRole('group', { name: 'Activity range' });

async function choose(page: Page, range: Range): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes('/api/reporting/activity') &&
      candidate.url().includes(`range=${range}`),
  );
  await toggle(page).getByRole('button', { name: RANGE_LABELS[range], exact: true }).click();
  expect((await response).status()).toBe(200);
}

test.describe('Activity', () => {
  test('opens on seven days with the figures the orders add up to', async ({
    page,
    openAsAdmin,
  }) => {
    await openAsAdmin('/');
    await expect(heading(page)).toBeVisible();

    const week = figures('7d');
    await expect(toggle(page).getByRole('button', { name: '7D' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(card(page, 'Orders')).toContainText(String(week.orders));
    await expect(card(page, 'Fill rate')).toContainText(`${week.fillRate!.toFixed(1)}%`);
    await expect(card(page, 'Fill rate')).toContainText(`${week.filled} filled`);
    await expect(card(page, 'Rejected')).toContainText(String(week.rejected));
    await expect(card(page, 'Rejected')).toContainText('Insufficient funds');
    await expect(card(page, 'Net cash flow')).toContainText(usd(week.netCashFlow));
    await expect(card(page, 'Active traders')).toContainText(String(week.activeTraders));
    await expect(card(page, 'Notional traded')).toContainText(usd(week.notional));
  });

  for (const range of RANGES.filter((candidate) => candidate !== '7d')) {
    test(`recomputes every figure for ${RANGE_LABELS[range]}`, async ({ page, openAsAdmin }) => {
      await openAsAdmin('/');
      await expect(heading(page)).toBeVisible();

      await choose(page, range);

      const expected = figures(range);
      await expect(
        toggle(page).getByRole('button', { name: RANGE_LABELS[range], exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page, 'Orders')).toContainText(String(expected.orders));
      await expect(card(page, 'Active traders')).toContainText(String(expected.activeTraders));
      await expect(card(page, 'Notional traded')).toContainText(usd(expected.notional));
      await expect(card(page, 'Net cash flow')).toContainText(usd(expected.netCashFlow));
      if (expected.fillRate !== null) {
        await expect(card(page, 'Fill rate')).toContainText(`${expected.fillRate.toFixed(1)}%`);
      }
    });
  }

  test("sends the viewer's own time zone offset with the range", async ({ page, openAsAdmin }) => {
    // The heading can be on screen before the first request leaves, so wait for the request itself.
    const asked = page.waitForRequest((request) =>
      request.url().includes('/api/reporting/activity'),
    );

    await openAsAdmin('/');
    await expect(heading(page)).toBeVisible();

    // The suite's browser sits in UTC.
    expect(new URL((await asked).url()).search).toBe('?range=7d&tzOffset=0');
  });

  test('remembers the range in this browser across a reload', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    await expect(heading(page)).toBeVisible();
    await choose(page, '90d');

    await page.reload();

    await expect(toggle(page).getByRole('button', { name: '90D' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(card(page, 'Orders')).toContainText(String(figures('90d').orders));
    expect(await page.evaluate((key) => localStorage.getItem(key), RANGE_KEY)).toBe('90d');
  });

  test("splits the range's orders by status", async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    const inWeek = ordersIn('7d');

    const statuses = card(page, 'Orders by status').locator('[data-statuses] > div');
    const statusNames = ['FILLED', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
    await expect(statuses).toHaveCount(statusNames.length);
    for (const status of statusNames) {
      const count = inWeek.filter((order) => order.status === status).length;
      await expect(statuses.filter({ hasText: new RegExp(status, 'i') })).toContainText(
        new RegExp(`${status}\\s*${count}\\s`, 'i'),
      );
    }
  });

  test('splits notional and traders by trader level', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    await expect(heading(page)).toBeVisible();

    const segments = card(page, 'Client segments').locator('[data-segments] > div');
    await expect(segments).toHaveCount(3);
    for (const [index, segment] of bySegment('7d').entries()) {
      const traders = `${segment.traders} ${segment.traders === 1 ? 'trader' : 'traders'}`;
      await expect(segments.nth(index)).toContainText(new RegExp(segment.level, 'i'));
      await expect(segments.nth(index)).toContainText(usd(segment.notional));
      await expect(segments.nth(index)).toContainText(`${traders} · ${segment.orders} orders`);
    }
  });

  test('lists the most traded symbols by notional', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    await expect(heading(page)).toBeVisible();

    const rows = card(page, /most traded/i).locator('li');
    const expected = bySymbol('7d');
    await expect(rows).toHaveCount(expected.length);
    for (const [index, symbol] of expected.entries()) {
      await expect(rows.nth(index)).toContainText(symbol.symbol);
      await expect(rows.nth(index)).toContainText(usd(symbol.notional));
    }
  });

  test('shows the newest events: locks, fills, rejections and cash movements', async ({
    page,
    openAsAdmin,
  }) => {
    await openAsAdmin('/');
    await expect(heading(page)).toBeVisible();

    const feed = card(page, /live activity/i);
    const priya = customerOf(4);
    await expect(feed).toContainText(
      `${fullName(priya)} locked after ${priya.failedLoginAttempts} failed sign-ins`,
    );
    const rejected = orders.find((order) => order.status === 'REJECTED' && order.hoursAgo < 168)!;
    await expect(feed).toContainText(`Order #${rejected.orderId} rejected — ${rejected.reason}`);
    const filled = orders.find((order) => order.status === 'FILLED' && order.hoursAgo < 168)!;
    await expect(feed).toContainText(
      `${fullName(customerOf(filled.accountId))} ${filled.side === 'BUY' ? 'bought' : 'sold'} ${filled.quantity} ${filled.symbol}`,
    );
    await expect(feed).toContainText(`${fullName(customerOf(3))} withdrew cash`);
  });

  test('exports every order of the range as CSV', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    await expect(card(page, 'Orders')).toContainText(String(figures('7d').orders));

    await page.getByRole('button', { name: 'Export this view' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export CSV' }).click();

    const file = await download;
    expect(file.suggestedFilename()).toBe('activity-orders-7d.csv');
    const lines = (await readFile((await file.path())!, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => line.replaceAll('"', ''));
    expect(lines[0]).toContain('Order,Time,Customer');
    // One line per order in the week, however many the screen shows.
    expect(lines.length - 1).toBe(ordersIn('7d').length);
  });

  test('says it could not load the activity, and loads it on a retry', async ({
    page,
    openAsAdmin,
  }) => {
    let failing = true;
    await page.route('**/api/reporting/activity**', (route) =>
      failing ? route.fulfill({ status: 500, json: { error: 'down' } }) : route.continue(),
    );

    await openAsAdmin('/');
    await expect(page.getByRole('alert')).toContainText("We couldn't load the activity.");

    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(card(page, 'Orders')).toContainText(String(figures('7d').orders));
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
