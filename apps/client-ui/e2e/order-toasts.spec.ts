import { confirmOrderReview } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const credentials = { email: 'toast-trader@example.com', password: 'Trader-password1!' };
test.use({
  stubOptions: {
    accounts: [
      {
        ...credentials,
        hasProfile: true,
        availableFunds: 5000,
        tradingAccounts: [
          { name: 'Trading', holdings: [{ symbol: 'AAPL', quantity: 4, averageCost: 200 }] },
        ],
      },
    ],
  },
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`order toast placement and expiry at ${viewport.width}px`, async ({
    page,
    loginPage,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.route('**/api/instruments', (route) =>
      route.fulfill({
        json: [
          {
            instrumentId: 7,
            ticker: 'AAPL',
            simulatedStockSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetClass: 'Equity',
            market: 'US',
            currency: 'USD',
            tradable: true,
          },
        ],
      }),
    );
    let orderId = 0;
    const references: string[] = [];
    const sides: string[] = [];
    await page.route('**/api/orders', (route) => {
      if (route.request().method() === 'POST') {
        references.push(route.request().postDataJSON().clientReference);
        sides.push(route.request().postDataJSON().orderType);
      }
      return route.fulfill({
        json:
          route.request().method() === 'GET'
            ? []
            : {
                ...route.request().postDataJSON(),
                orderId: ++orderId,
                status: 'FILLED',
                rejectionReason: null,
                submittedAt: '2026-01-05T15:00:00Z',
                resolvedAt: '2026-01-05T15:00:00Z',
              },
      });
    });
    await loginPage.goto();
    await loginPage.signIn(credentials.email, credentials.password);
    await expect(page).toHaveURL(/dashboard$/);
    await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
    await page.getByRole('option').first().click();
    const dialog = page.getByRole('dialog', { name: 'New Order' });
    await dialog.getByLabel('Shares', { exact: true }).first().fill('999');
    await expect(dialog.locator('#order-shares')).toHaveValue('22');
    await dialog.locator('#order-shares').fill('999');
    await expect(dialog.locator('#order-shares')).toHaveValue('22');
    await dialog.locator('#order-shares').fill('1');
    await dialog.getByRole('button', { name: 'Buy 1 AAPL', exact: true }).click();
    await confirmOrderReview(page);

    await expect(dialog.getByRole('button', { name: /^Buying/ })).toBeDisabled();
    await expect(dialog.locator('.order-spinner')).toBeVisible();

    const toast = page.locator('hlm-toaster .toast');
    await expect(toast).toContainText('Filled 1 AAPL at $225.80.');
    expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toContain('toast-rise');
    const stack = page.locator('hlm-toaster .toast-stack');
    const box = (await stack.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(viewport.height - box.y - box.height).toBeCloseTo(48, 0);
    expect(await toast.evaluate((el) => getComputedStyle(el.querySelector('p')!).fontSize)).toBe('16px');
    expect(await stack.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(50);
    await page.screenshot({
      path: `reports/playwright/toast-${viewport.width}.png`,
      fullPage: true,
    });
    await expect(toast.getByRole('button')).toHaveCount(0);
    await expect(toast).not.toContainText(/\u00d7/);

    let toastId = 1;
    for (const [side, action] of [['buy', 'Buy'], ['sell', 'Sell'], ['sell', 'Sell']]) {
      if (side === 'sell') await dialog.getByRole('button', { name: 'sell', exact: true }).click();
      await dialog.getByRole('button', { name: `${action} 1 AAPL`, exact: true }).click();
      await confirmOrderReview(page);

      await expect(dialog.locator('.order-spinner')).toBeVisible();
      await expect(toast).toHaveCount(1);
      await expect(toast).toHaveAttribute('data-toast-id', String(++toastId));
      expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toContain('toast-rise');

    }
    expect(sides).toEqual(['BUY', 'BUY', 'SELL', 'SELL']);
    expect(new Set(references).size).toBe(4);
    await dialog.getByRole('button', { name: 'Sell 1 AAPL', exact: true }).click();
    await confirmOrderReview(page);

    await expect(toast).toHaveCount(1);

    await dialog.getByLabel('Close order submission').click();
    await expect(toast.first()).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await toast.first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    expect(await toast.first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await expect(toast.getByRole('button')).toHaveCount(0);

    await expect(toast).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
