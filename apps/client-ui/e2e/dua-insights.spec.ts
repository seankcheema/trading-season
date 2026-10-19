import { newAccount } from './fixtures/accounts';
import { expect, test } from './fixtures/test';
import type { Page } from '@playwright/test';

async function expectSharkAnchoredAfterScroll(page: Page): Promise<void> {
  const shark = page.locator('app-dua');
  await expect(shark).toHaveCSS('position', 'fixed');
  const before = await shark.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const after = await shark.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  await expect(shark.getByRole('button', { name: 'Dua insights', exact: true })).toBeInViewport();
}

const USER = newAccount();
test.use({
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        tradingAccounts: [
          { name: 'Investing', holdings: [{ symbol: 'AAPL', quantity: 2, averageCost: 250 }] },
        ],
      },
    ],
  },
});

test('Dua starts closed, reviews holdings, minimizes and follows stock navigation', async ({
  page,
  loginPage,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  const panel = page.getByRole('region', { name: 'Dua insights' });
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  await panel.getByRole('button', { name: 'My holdings', exact: true }).click();
  await expect(panel).toContainText('below average purchase cost');
  await expect(panel).toContainText('Unrealized loss');
  await panel.getByRole('button', { name: 'View stock', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl/);
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await panel.getByRole('button', { name: 'This stock', exact: true }).click();
  await expect(panel).toContainText('since session open');
  await expect(panel).toContainText('Not enough completed candles');
  await panel.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Dua insights', exact: true })).toBeFocused();
});

test('Dua remains a compact overlay on mobile and supports reduced motion', async ({
  page,
  loginPage,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  const panel = page.getByRole('region', { name: 'Dua insights' });
  await expect(panel).toBeHidden();
  await expect(page.locator('app-dua img.visible')).toHaveAttribute('src', /shark_under/);
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.height).toBeLessThanOrEqual(400);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  await expect(page.locator('app-dua img.visible')).toHaveAttribute('src', /shark_peak\.png/);
  const failedImages = await page
    .locator('app-dua img')
    .evaluateAll((images) => images.some((img) => !(img as HTMLImageElement).naturalWidth));
  expect(failedImages).toBe(false);
  await panel.getByRole('button', { name: 'Minimize Dua' }).click();
  await expect(panel).toBeHidden();
  await expectSharkAnchoredAfterScroll(page);
  await page.goto('/dashboard/markets/aapl');
  await expect(page.locator('app-market-page')).toBeVisible();
  await expectSharkAnchoredAfterScroll(page);
});
