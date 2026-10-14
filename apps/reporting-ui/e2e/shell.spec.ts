import { expect, test } from './fixtures/test';

const COLLAPSED_KEY = 'ts.reporting.sidebar-collapsed';

test.describe('The shell around every screen', () => {
  test('moves between the four screens from the sidebar', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    const sidebar = page.getByRole('navigation', { name: 'Reporting' });

    for (const [name, path, title] of [
      ['Customers', /\/customers$/, 'Customers'],
      ['Orders', /\/orders$/, 'Orders'],
      ['Report runs', /\/runs$/, 'Report runs'],
      ['Activity', /\/$/, 'Activity'],
    ] as const) {
      await sidebar.getByRole('link', { name }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      await expect(sidebar.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('collapses to its icons, and stays collapsed after a reload', async ({
    page,
    openAsAdmin,
  }) => {
    await openAsAdmin('/orders');
    const sidebar = page.getByRole('navigation', { name: 'Reporting' });
    await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
    const open = (await sidebar.boundingBox())!.width;

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();

    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    // The names stay for assistive technology and as tooltips.
    await expect(sidebar.getByRole('link', { name: 'Customers' })).toHaveAttribute(
      'title',
      'Customers',
    );
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(open);
    expect(await page.evaluate((key) => localStorage.getItem(key), COLLAPSED_KEY)).toBe('true');

    await page.reload();

    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });

  test('turns the sidebar into a bar across the top on a narrow screen', async ({
    page,
    openAsAdmin,
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await openAsAdmin('/customers');

    await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /sidebar/ })).toHaveCount(0);
    const nav = (await page.getByRole('navigation', { name: 'Reporting' }).boundingBox())!;
    const title = (await page.getByRole('heading', { name: 'Customers', level: 1 }).boundingBox())!;
    expect(nav.y + nav.height).toBeLessThanOrEqual(title.y);
    // Nothing spills sideways.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
