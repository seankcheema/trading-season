import { readFile } from 'node:fs/promises';
import { type Page } from '@playwright/test';
import { expectCount, pickFilter, tableRows } from './fixtures/screens';
import {
  type ScenarioOrder,
  accountName,
  customerOf,
  fullName,
  orders,
  transfers,
  usd,
} from './fixtures/scenario';
import { expect, test } from './fixtures/test';

const ROWS = orders.length + transfers.length;

const filled = (order: ScenarioOrder) => order.status === 'FILLED';
const orderRow = (page: Page, order: ScenarioOrder) =>
  tableRows(page).filter({
    has: page.getByRole('button', { name: `Open order ${order.orderId}` }),
  });

async function openOrders(
  page: Page,
  openAsAdmin: (path?: string) => Promise<void>,
): Promise<void> {
  await openAsAdmin('/orders');
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
  await expectCount(page, ROWS, ROWS, 'rows');
}

test.describe('Orders', () => {
  test('lists every order and every cash transfer', async ({ page, openAsAdmin }) => {
    await openOrders(page, openAsAdmin);

    await expect(page.getByRole('button', { name: /^Open order \d+$/ })).toHaveCount(orders.length);
    await expect(page.locator('[data-transfer]')).toHaveCount(transfers.length);
  });

  test("shows each order's customer, asset, side, size, fill and status", async ({
    page,
    openAsAdmin,
  }) => {
    await openOrders(page, openAsAdmin);

    for (const order of orders) {
      const row = orderRow(page, order);
      await expect(row).toContainText(`#${order.orderId}`);
      await expect(row).toContainText(
        `${fullName(customerOf(order.accountId))} · ${accountName(order.accountId)}`,
      );
      await expect(row).toContainText(order.symbol);
      // The cells sit side by side without a space, so there is no word boundary to match on.
      await expect(row).toContainText(new RegExp(order.side, 'i'));
      await expect(row).toContainText(new RegExp(order.status, 'i'));
      if (filled(order)) {
        // Fill price, then the amount the fill moved: shares at that price.
        await expect(row).toContainText(usd(order.price, 2));
        await expect(row).toContainText(usd(order.quantity * order.price, 2));
      } else {
        // An order that did not fill has no fill price and no amount.
        await expect(row).not.toContainText('$');
      }
    }
  });

  test('lists deposits and withdrawals among the orders, with nothing to open', async ({
    page,
    openAsAdmin,
  }) => {
    await openOrders(page, openAsAdmin);

    for (const transfer of transfers) {
      const customer = customerOf(transfer.accountId);
      const row = page
        .locator('[data-transfer]')
        .filter({ hasText: `${fullName(customer)} · ${accountName(transfer.accountId)}` });
      await expect(row).toContainText('Cash');
      await expect(row).toContainText(new RegExp(transfer.reason, 'i'));
      await expect(row).toContainText(usd(Math.abs(transfer.amount), 2));
      await expect(row).toContainText(/completed/i);
      await expect(row.getByRole('button')).toHaveCount(0);
    }
  });

  test('narrows by status, side, asset, customer and fill, and clears them', async ({
    page,
    openAsAdmin,
  }) => {
    await openOrders(page, openAsAdmin);

    await pickFilter(page, 'Status', /^rejected$/i);
    await expectCount(page, orders.filter((o) => o.status === 'REJECTED').length, ROWS, 'rows');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Side', 'Sell');
    await expectCount(page, orders.filter((o) => o.side === 'SELL').length, ROWS, 'rows');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Side', 'Withdrawal');
    await expectCount(
      page,
      transfers.filter((t) => t.reason === 'WITHDRAWAL').length,
      ROWS,
      'rows',
    );

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Asset', 'NVDA');
    await expectCount(page, orders.filter((o) => o.symbol === 'NVDA').length, ROWS, 'rows');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Customer', 'Marcus Lee');
    const marcus = (order: ScenarioOrder) => customerOf(order.accountId).firstName === 'Marcus';
    await expectCount(
      page,
      orders.filter(marcus).length +
        transfers.filter((t) => customerOf(t.accountId).firstName === 'Marcus').length,
      ROWS,
      'rows',
    );

    // Only an order can fill, so a fill filter leaves the transfers out.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Fill', 'No fill yet');
    await expectCount(page, orders.filter((o) => !filled(o)).length, ROWS, 'rows');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await pickFilter(page, 'Fill', 'Has fill price');
    await expectCount(page, orders.filter(filled).length, ROWS, 'rows');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expectCount(page, ROWS, ROWS, 'rows');
  });

  test('searches by symbol, order number, customer and client reference', async ({
    page,
    openAsAdmin,
  }) => {
    await openOrders(page, openAsAdmin);
    const search = page.getByPlaceholder('Customer, symbol, order # or ref');

    await search.fill('amzn');
    await expectCount(page, orders.filter((o) => o.symbol === 'AMZN').length, ROWS, 'rows');

    await search.fill('103');
    await expectCount(page, 1, ROWS, 'rows');
    await expect(
      orderRow(
        page,
        orders.find((o) => o.orderId === 103)!,
      ),
    ).toBeVisible();

    await search.fill('priya');
    await expectCount(
      page,
      orders.filter((o) => customerOf(o.accountId).firstName === 'Priya').length,
      ROWS,
      'rows',
    );

    await search.fill('c0000000-0000-4000-8000-000000000106');
    await expectCount(page, 1, ROWS, 'rows');

    await search.fill('no such thing');
    await expect(page.getByText('No orders or transfers match these filters.')).toBeVisible();
  });

  test('sorts by amount, and back the other way', async ({ page, openAsAdmin }) => {
    await openOrders(page, openAsAdmin);
    const sortByAmount = page.getByRole('button', { name: 'Sort by Amount' });
    // The amount of each row that has one: the last dollar figure in it. Orders that did
    // not fill have none and are left out.
    const amounts = async () =>
      (await tableRows(page).allInnerTexts()).flatMap((text) => {
        const figures = text.match(/\$[\d,]+\.\d{2}/g);
        return figures ? [Number(figures.at(-1)!.replace(/[$,]/g, ''))] : [];
      });
    const expected = [
      ...orders.filter(filled).map((o) => o.quantity * o.price),
      ...transfers.map((t) => Math.abs(t.amount)),
    ];
    const ascending = [...expected].sort((a, b) => a - b);

    await sortByAmount.click();
    const firstClick = await amounts();
    expect(firstClick).toHaveLength(expected.length);
    const clickedAscending = firstClick[0] === ascending[0];
    expect(firstClick).toEqual(clickedAscending ? ascending : [...ascending].reverse());

    await sortByAmount.click();
    await expect.poll(amounts).toEqual(clickedAscending ? [...ascending].reverse() : ascending);
  });

  test('exports the rows on screen as CSV', async ({ page, openAsAdmin }) => {
    await openOrders(page, openAsAdmin);
    await pickFilter(page, 'Status', /^filled$/i);
    await expectCount(page, orders.filter(filled).length, ROWS, 'rows');

    await page.getByRole('button', { name: 'Export this view' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export CSV' }).click();

    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^orders.*\.csv$/);
    const lines = (await readFile((await file.path())!, 'utf8')).trim().split(/\r?\n/);
    // A header and one line per row shown.
    expect(lines).toHaveLength(1 + orders.filter(filled).length);
    expect(lines.slice(1).every((line) => line.includes('FILLED'))).toBe(true);
  });

  test('says it could not load the orders, and loads them on a retry', async ({
    page,
    openAsAdmin,
  }) => {
    let failing = true;
    await page.route('**/api/reporting/orders', (route) =>
      failing ? route.fulfill({ status: 503, json: { error: 'down' } }) : route.continue(),
    );

    await openAsAdmin('/orders');
    await expect(page.getByRole('alert')).toContainText("We couldn't load the orders");

    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();

    await expectCount(page, ROWS, ROWS, 'rows');
  });
});

test.describe('One order', () => {
  const dialog = (page: Page) => page.getByRole('dialog');

  test('opens with its execution, ledger impact, audit trail and references', async ({
    page,
    openAsAdmin,
  }) => {
    const order = orders.find((o) => o.orderId === 101)!;
    const customer = customerOf(order.accountId);
    await openOrders(page, openAsAdmin);

    await page.getByRole('button', { name: `Open order ${order.orderId}` }).click();

    await expect(
      dialog(page).getByRole('heading', { name: `Order #${order.orderId}` }),
    ).toBeVisible();
    await expect(dialog(page)).toContainText(
      new RegExp(`buy ${order.quantity} ${order.symbol}`, 'i'),
    );
    await expect(dialog(page)).toContainText(order.name);
    await expect(dialog(page)).toContainText(/filled/i);
    // Customer
    await expect(dialog(page)).toContainText(fullName(customer));
    await expect(dialog(page)).toContainText(customer.email);
    await expect(dialog(page)).toContainText(accountName(order.accountId));
    // Execution: the quantity and price the fill record holds
    await expect(dialog(page)).toContainText(usd(order.price, 2));
    await expect(dialog(page)).toContainText(usd(order.quantity * order.price, 2));
    // Ledger impact: the cash the fill moved, and the holding it changed
    await expect(dialog(page)).toContainText(usd(-order.quantity * order.price, 2));
    await expect(dialog(page)).toContainText(`+${order.quantity} sh`);
    // Audit trail: the entries the order service recorded, in order
    await expect(dialog(page)).toContainText('ORDER_SUBMITTED');
    await expect(dialog(page)).toContainText('ORDER_FILLED');
    // References
    await expect(dialog(page)).toContainText('c0000000-0000-4000-8000-000000000101');
  });

  test('says why an order was rejected', async ({ page, openAsAdmin }) => {
    const order = orders.find((o) => o.status === 'REJECTED')!;
    await openOrders(page, openAsAdmin);

    await page.getByRole('button', { name: `Open order ${order.orderId}` }).click();

    await expect(
      dialog(page).getByRole('heading', { name: `Order #${order.orderId}` }),
    ).toBeVisible();
    await expect(dialog(page)).toContainText(/rejected/i);
    await expect(dialog(page)).toContainText(order.reason!);
    await expect(dialog(page)).toContainText('ORDER_REJECTED');
  });

  test('closes with Escape and leaves the filters as they were', async ({ page, openAsAdmin }) => {
    await openOrders(page, openAsAdmin);
    await pickFilter(page, 'Side', 'Buy');
    const buys = orders.filter((o) => o.side === 'BUY').length;
    await expectCount(page, buys, ROWS, 'rows');

    await page.getByRole('button', { name: 'Open order 101' }).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(dialog(page)).toHaveCount(0);
    await expectCount(page, buys, ROWS, 'rows');
  });

  test('says it could not load an order the service does not hold', async ({
    page,
    openAsAdmin,
  }) => {
    await openOrders(page, openAsAdmin);
    // Turn the service's answer for this one order into the 404 it gives for an unknown id.
    await page.route('**/api/reporting/orders/101', (route) =>
      route.fulfill({ status: 404, json: { error: 'Not found' } }),
    );

    await page.getByRole('button', { name: 'Open order 101' }).click();

    await expect(dialog(page).getByRole('alert')).toContainText("We couldn't load this order.");
  });
});
