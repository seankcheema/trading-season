import { readFile } from 'node:fs/promises';
import { type Locator, type Page } from '@playwright/test';
import {
  RANGE_LABELS,
  type Range,
  accountName,
  analyst,
  bySegment,
  bySymbol,
  customerOf,
  figures,
  fullName,
  ordersIn,
  usd,
} from './fixtures/scenario';
import { expect, test } from './fixtures/test';

const RUNS_RANGE_KEY = 'ts.reporting.runs-range';
const PNG_SIGNATURE = '89504e470d0a1a0a';

const heading = (page: Page) => page.getByRole('heading', { name: 'Report runs', level: 1 });
const toggle = (page: Page) => page.getByRole('group', { name: 'Report range' });

/** A headline tile or a card, found by its heading. */
const card = (page: Page, name: string): Locator =>
  page.locator('section').filter({
    has: page.getByRole('heading', { name: new RegExp(`^${name}$`, 'i') }),
  });

const meters = (page: Page, name: string): Locator =>
  card(page, name).locator('[data-meters] > li');

async function choose(page: Page, range: Range): Promise<void> {
  // All time is what the service answers when no range is asked for.
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes('/api/reporting/runs/latest') &&
      (range === 'all'
        ? !candidate.url().includes('range=')
        : candidate.url().includes(`range=${range}`)),
  );
  await toggle(page).getByRole('button', { name: RANGE_LABELS[range], exact: true }).click();
  expect((await response).status()).toBe(200);
}

/** What the tiles of a run say for a range, worked out from the orders it was built from. */
async function expectTiles(page: Page, range: Range): Promise<void> {
  const expected = figures(range);
  await expect(card(page, 'Orders resolved')).toContainText(String(expected.resolved));
  await expect(card(page, 'Orders resolved')).toContainText(`${expected.orders} events read`);
  await expect(card(page, 'Rejected')).toContainText(String(expected.rejected));
  await expect(card(page, 'Traded value')).toContainText(usd(expected.notional));
  await expect(card(page, 'Traded value')).toContainText(`${expected.sharesFilled} shares filled`);
  await expect(card(page, 'Active accounts')).toContainText(String(expected.accounts));
  await expect(card(page, 'Active accounts')).toContainText(`${expected.symbols} symbols traded`);
  if (expected.fillRate !== null) {
    await expect(card(page, 'Fill rate')).toContainText(`${expected.fillRate.toFixed(1)}%`);
    await expect(card(page, 'Fill rate')).toContainText(`${expected.filled} filled`);
  }
}

test.describe('Report runs', () => {
  test('shows the latest run, named and dated, on seven days', async ({
    page,
    request,
    openAsAdmin,
  }) => {
    const status = await (await request.get('/api/reporting/scheduler/status')).json();

    await openAsAdmin('/runs');

    await expect(heading(page)).toBeVisible();
    await expect(page.getByText(`Run ${status.latest_run}`)).toBeVisible();
    await expect(page.getByText(/generated .* UTC/)).toBeVisible();
    await expect(toggle(page).getByRole('button', { name: '7D' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expectTiles(page, '7d');
  });

  test('is the same run to an analyst', async ({ page, openAs }) => {
    await openAs(analyst, '/runs');

    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');
  });

  for (const range of ['today', '30d', '90d', 'all'] as const) {
    test(`re-cuts the run for ${RANGE_LABELS[range]}`, async ({ page, openAsAdmin }) => {
      await openAsAdmin('/runs');
      await expect(heading(page)).toBeVisible();

      await choose(page, range);

      await expect(
        toggle(page).getByRole('button', { name: RANGE_LABELS[range], exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expectTiles(page, range);
    });
  }

  test("asks for the run in the viewer's own days", async ({ page, openAsAdmin }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/reporting/runs/latest')) {
        asked.push(new URL(request.url()).search);
      }
    });

    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');

    expect(asked[0]).toBe('?range=7d&tzOffset=0');
  });

  test('remembers the range in this browser across a reload', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await choose(page, '30d');

    await page.reload();

    await expect(toggle(page).getByRole('button', { name: '30D' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expectTiles(page, '30d');
    expect(await page.evaluate((key) => localStorage.getItem(key), RUNS_RANGE_KEY)).toBe('30d');
  });

  test('counts the trades of each UTC day, filled and rejected', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await choose(page, 'all');

    // The same figures the drawn chart is hidden from, as a table for a screen reader.
    const rows = card(page, 'Trades per day').locator('tbody tr');
    const totals = async () => {
      const days = await rows.evaluateAll((trs) =>
        trs.map((tr) => [...tr.querySelectorAll('td')].map((cell) => Number(cell.textContent))),
      );
      return days.reduce(([filled, rejected], [f, r]) => [filled + f, rejected + r], [0, 0]);
    };
    const all = figures('all');

    // Which UTC day an order falls on depends on when the suite started, so only the sums
    // over all of the days are exact.
    await expect.poll(totals).toEqual([all.filled, all.rejected]);
  });

  test('splits traded value by client segment', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');

    const rows = meters(page, 'Traded value by client segment');
    await expect(rows).toHaveCount(3);
    const total = figures('7d').notional;
    for (const [index, segment] of bySegment('7d').entries()) {
      const accounts = `${segment.accounts} ${segment.accounts === 1 ? 'account' : 'accounts'}`;
      await expect(rows.nth(index)).toContainText(new RegExp(segment.level, 'i'));
      await expect(rows.nth(index)).toContainText(usd(segment.notional, 2));
      await expect(rows.nth(index)).toContainText(
        `${((segment.notional / total) * 100).toFixed(1)}%`,
      );
      await expect(rows.nth(index)).toContainText(
        `${accounts} · ${segment.filled} filled · ${segment.rejected} rejected`,
      );
    }
  });

  test('splits traded value by symbol, the most valuable first', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');

    const traded = bySymbol('7d').filter((symbol) => symbol.fills > 0);
    const rows = meters(page, 'Traded value by symbol');
    await expect(rows).toHaveCount(traded.length);
    for (const [index, symbol] of traded.entries()) {
      await expect(rows.nth(index)).toContainText(symbol.symbol);
      await expect(rows.nth(index)).toContainText(usd(symbol.notional, 2));
      await expect(rows.nth(index)).toContainText(
        `${symbol.fills} ${symbol.fills === 1 ? 'fill' : 'fills'} · ${symbol.shares} shares`,
      );
    }
  });

  test('counts orders per account, labelled with the account and its owner', async ({
    page,
    openAsAdmin,
  }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');

    const resolved = ordersIn('7d').filter((order) => order.status !== 'ACCEPTED');
    const accounts = [...new Set(resolved.map((order) => order.accountId))];
    const rows = meters(page, 'Orders per account');
    await expect(rows).toHaveCount(accounts.length);
    for (const accountId of accounts) {
      const own = resolved.filter((order) => order.accountId === accountId);
      const row = rows.filter({
        hasText: `${accountName(accountId)} (${fullName(customerOf(accountId))})`,
      });
      await expect(row).toContainText(`${own.length} orders`);
      await expect(row).toContainText(
        `${own.filter((o) => o.status === 'FILLED').length} filled · ${own.filter((o) => o.status === 'REJECTED').length} rejected`,
      );
    }
  });
});

test.describe('Report run charts', () => {
  const CHARTS = [
    ['Trades per day', 'daily_trades.png'],
    ['Traded value by client segment', 'volume_by_segment.png'],
    ['Traded value by symbol', 'volume_by_symbol.png'],
    ['Orders per account', 'trades_per_account.png'],
  ] as const;

  for (const [title, file] of CHARTS) {
    test(`downloads ${title} as the run's PNG`, async ({ page, openAsAdmin }) => {
      await openAsAdmin('/runs');
      await expect(heading(page)).toBeVisible();
      await choose(page, 'all');
      // Until the all-time figures are drawn, the button still belongs to the seven-day cut.
      await expectTiles(page, 'all');
      const requested = page.waitForRequest((request) => request.url().endsWith(`/files/${file}`));

      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: `Download ${title} as PNG` }).click();

      // All time is the latest snapshot of the run, asked for with no range.
      expect(new URL((await requested).url()).search).toBe('');
      const saved = await download;
      const bytes = await readFile((await saved.path())!);
      expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
      expect(bytes.length).toBeGreaterThan(1000);
    });
  }

  test('draws the chart for the range on screen when it is a narrower one', async ({
    page,
    openAsAdmin,
  }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');
    const requested = page.waitForRequest((request) =>
      request.url().includes('/files/volume_by_symbol.png'),
    );

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Traded value by symbol as PNG' }).click();

    expect(new URL((await requested).url()).search).toBe('?range=7d&tzOffset=0');
    const bytes = await readFile((await (await download).path())!);
    expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  });

  test('says so when a chart cannot be downloaded', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(heading(page)).toBeVisible();
    await expectTiles(page, '7d');
    await page.route('**/files/daily_trades.png**', (route) =>
      route.fulfill({ status: 404, json: { error: 'Not found' } }),
    );

    await page.getByRole('button', { name: 'Download Trades per day as PNG' }).click();

    await expect(page.getByRole('alert')).toContainText("We couldn't download that chart.");
  });
});
