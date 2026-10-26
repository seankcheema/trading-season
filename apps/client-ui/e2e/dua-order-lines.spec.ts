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
  test(`Dua says order outcomes beside its launcher at ${viewport.width}px`, async ({
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
    // $5,000 buys 21 shares at $225.80 after the default 1% buffer reservation.
    await expect(dialog.locator('#order-shares')).toHaveValue('21');
    await dialog.locator('#order-shares').fill('999');
    await expect(dialog.locator('#order-shares')).toHaveValue('21');
    await dialog.locator('#order-shares').fill('1');
    await dialog.getByRole('button', { name: 'Buy 1 AAPL', exact: true }).click();

    await expect(dialog.getByRole('button', { name: /^Buying/ })).toBeDisabled();
    await expect(dialog.locator('.order-spinner')).toBeVisible();

    const bubble = page.getByTestId('dua-bubble');
    await expect(bubble).toContainText('Filled 1 AAPL at $225.80.');
    await expect(page.getByTestId('dua-says')).toHaveText('Filled 1 AAPL at $225.80.');
    expect(await bubble.evaluate((el) => getComputedStyle(el).animationName)).toContain(
      'dua-bubble-pop',
    );
    // Beside the launcher, bottoms nearly level, inside the viewport and over the dialog.
    const launcher = page.getByRole('button', { name: 'Dua insights', exact: true });
    const said = (await bubble.boundingBox())!;
    const dua = (await launcher.boundingBox())!;
    expect(said.x + said.width).toBeLessThanOrEqual(dua.x);
    expect(said.x).toBeGreaterThanOrEqual(15);
    expect(Math.abs(said.y + said.height - (dua.y + dua.height - 4))).toBeLessThan(2);
    expect(
      await page.locator('app-dua').evaluate((el) => Number(getComputedStyle(el).zIndex)),
    ).toBeGreaterThan(50);
    await page.screenshot({
      path: `reports/playwright/dua-bubble-${viewport.width}.png`,
      fullPage: true,
    });
    await expect(bubble.getByRole('button')).toHaveCount(0);

    // Each outcome replaces the line before it.
    for (const [side, action] of [
      ['buy', 'Buy'],
      ['sell', 'Sell'],
      ['sell', 'Sell'],
    ]) {
      const previous = await bubble.getAttribute('data-line-id');
      if (side === 'sell') await dialog.getByRole('button', { name: 'sell', exact: true }).click();
      await dialog.getByRole('button', { name: `${action} 1 AAPL`, exact: true }).click();

      await expect(dialog.locator('.order-spinner')).toBeVisible();
      await expect(bubble).toHaveCount(1);
      await expect(bubble).not.toHaveAttribute('data-line-id', previous!);
      expect(await bubble.evaluate((el) => getComputedStyle(el).animationName)).toContain(
        'dua-bubble-pop',
      );
    }
    expect(sides).toEqual(['BUY', 'BUY', 'SELL', 'SELL']);
    expect(new Set(references).size).toBe(4);

    await dialog.getByLabel('Close order submission').click();
    await expect(bubble).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await bubble.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

    // The first order was a first, which Dua celebrates once the order lines have gone.
    await expect(bubble).toContainText('Your first order is in', { timeout: 10_000 });
    await expect(bubble).toHaveClass(/tone-celebrate/);
    await expect(bubble).toHaveCount(0, { timeout: 10_000 });
    expect(errors).toEqual([]);
  });
}
