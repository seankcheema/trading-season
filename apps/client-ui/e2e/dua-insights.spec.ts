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
  const launcher = page.getByRole('button', { name: 'Dua insights', exact: true });
  const art = page.locator('app-dua .launcher-art');
  await expect(art).not.toHaveClass(/face-visible/);
  const beforeHover = await launcher.boundingBox();
  await launcher.hover();
  await expect(art).toHaveClass(/face-visible/);
  await expect(art).toHaveCSS('transform', 'matrix(1.35, 0, 0, 1.35, 0, -10)');
  await expect(launcher).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await launcher.boundingBox()).toEqual(beforeHover);
  await page.mouse.move(0, 0);
  await expect(art).not.toHaveClass(/face-visible/);
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Daily review', exact: true }).click();
  await expect(panel.locator('.card-indicator')).toHaveCount(3);
  await expect(panel).toContainText('Market overview');
  await expect(panel.locator('.stock-list')).toHaveCount(0);
  await expect(panel.locator('.dua-header')).toHaveCSS('background-color', 'rgb(12, 14, 16)');
  await expect(panel.locator('.insight-card:not(.inactive)')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await panel.getByRole('button', { name: 'Next insight', exact: true }).click();
  await expect(panel).toContainText('Portfolio impact');
  expect(await panel.locator('.stock-list li').count()).toBeLessThanOrEqual(4);
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(panel).toContainText('Market overview');
  await panel.getByRole('button', { name: 'Back to choices', exact: true }).click();
  await panel.getByRole('button', { name: 'My holdings', exact: true }).click();
  await expect(panel).toContainText('Portfolio growth');
  await expect(panel).toContainText('+12.4%');
  await expect(panel.locator('.insight-card:not(.inactive)')).toHaveCount(1);
  await expect(panel.locator('.insight-card.inactive')).toHaveCount(2);
  await expect
    .poll(() =>
      panel.evaluate(
        (el) => el.getAnimations().filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0);
  const initialCard = await panel.locator('.insight-card:not(.inactive)').boundingBox();
  const navigationBefore = await panel.locator('.card-navigation').boundingBox();
  const panelBottomBefore = await panel.evaluate((el) => el.getBoundingClientRect().bottom);
  await panel.getByRole('button', { name: 'Next insight', exact: true }).click();
  await expect(panel).toContainText('Sector concentration');
  const navigationAfter = await panel.locator('.card-navigation').boundingBox();
  expect(navigationAfter!.y).toBeCloseTo(navigationBefore!.y, 1);
  expect(await panel.evaluate((el) => el.getBoundingClientRect().bottom)).toBeCloseTo(
    panelBottomBefore,
    1,
  );
  await expect(panel.locator('.insight-card:not(.inactive)')).toHaveCSS(
    'transition-duration',
    '0.38s, 0.38s, 0s',
  );
  expect((await panel.locator('.insight-card:not(.inactive)').boundingBox())!.height).toBe(
    initialCard!.height,
  );
  expect(
    await panel.locator('.dua-body').evaluate((el) => el.scrollHeight <= el.clientHeight),
  ).toBe(true);
  await panel.getByRole('button', { name: 'Show Top performer', exact: true }).click();
  await expect(panel).toContainText('Top performer');
  expect((await panel.locator('.insight-card:not(.inactive)').boundingBox())!.height).toBe(
    initialCard!.height,
  );
  await panel.getByRole('button', { name: 'Previous insight', exact: true }).click();
  await expect(panel).toContainText('Sector concentration');
  const anchoredBottom = await panel.evaluate((el) => el.getBoundingClientRect().bottom);
  await panel.getByRole('button', { name: 'Explain these numbers', exact: true }).click();
  expect(
    Math.abs((await panel.evaluate((el) => el.getBoundingClientRect().bottom)) - anchoredBottom),
  ).toBeLessThanOrEqual(1);
  await expect(panel.getByRole('heading', { name: 'Explain these numbers' })).toBeVisible();
  await expect(panel).toContainText('not calculated from your account');
  await expect(panel).toContainText('Why it matters');
  await expect(panel.locator('.insight-explanation')).toBeVisible();
  await expect
    .poll(() =>
      panel.evaluate(
        (el) => el.getAnimations().filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0);
  const explanationBounds = await panel.locator('.insight-explanation').boundingBox();
  const lastParagraph = await panel.locator('.example-context').boundingBox();
  expect(
    explanationBounds!.y + explanationBounds!.height - lastParagraph!.y - lastParagraph!.height,
  ).toBeLessThanOrEqual(44);
  await expect(panel).toHaveCSS('background-image', /radial-gradient/);
  await panel.getByRole('button', { name: 'Back to results', exact: true }).click();
  await expect(panel).toContainText('Sector concentration');
  await panel.getByRole('button', { name: 'Back to choices', exact: true }).click();
  await page.goto('/dashboard/markets/aapl?accountId=1');
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl/);
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await panel.getByRole('button', { name: 'This stock', exact: true }).click();
  await expect(panel).toContainText('Growth insight');
  await expect(panel).toContainText('+24.8%');
  await expect(panel.locator('.card-meta')).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await panel.getByRole('button', { name: 'Next insight', exact: true }).click();
  await expect(panel).toContainText('Valuation insight');
  await expect(panel).toContainText('-18%');
  await expect(panel.locator('.card-meta')).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await expect(panel).toBeVisible();
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
  await expect(page.locator('app-dua .launcher-art')).toHaveAttribute(
    'src',
    /shark-launcher-light-512/,
  );
  await expect(page.locator('app-dua .launcher-art')).not.toHaveClass(/face-visible/);
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(360);
  expect(bounds!.height).toBeLessThanOrEqual(560);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  await expect(page.locator('app-dua .launcher-art')).toHaveClass(/face-visible/);
  await expect(page.locator('app-dua .launcher-art')).toHaveCSS('transition-duration', '0s');
  await panel.getByRole('button', { name: 'Daily review', exact: true }).click();
  await expect(panel.locator('.insights')).toHaveCSS('animation-name', 'none');
  await expect(panel.locator('.insight-card:not(.inactive)')).toHaveCSS(
    'transition-duration',
    '0s',
  );
  await panel.getByRole('button', { name: 'Explain these numbers', exact: true }).click();
  await expect(panel.locator('.insight-explanation')).toHaveCSS('animation-name', 'none');
  expect(await panel.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await panel.getByRole('button', { name: 'Back to results', exact: true }).click();

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
