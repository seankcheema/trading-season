import { newAccount } from './fixtures/accounts';
import { expect, test } from './fixtures/test';
const USER = newAccount();
test.use({
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        tradingAccounts: [
          {
            name: 'Investing',
            holdings: [
              { symbol: 'AAPL', quantity: 2, averageCost: 250 },
              { symbol: 'MSFT', quantity: 2, averageCost: 200 },
            ],
          },
        ],
      },
    ],
  },
});

test('compact daily review keeps currency and arrows together and details visible', async ({
  page,
  loginPage,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  const panel = page.getByRole('region', { name: 'Dua insights' });
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Daily Review', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'Daily Review', exact: true }).click();
  const active = panel.locator('.insight-card:not(.inactive)');
  await expect(active).toContainText('Your holdings');
  await panel.getByRole('button', { name: 'Next insight', exact: true }).click();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(panel).toBeInViewport();
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const details = active.getByRole('button', { name: 'View Details', exact: true });
    await expect(details).toBeInViewport();
    expect(await details.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const metric of await active.locator('dd').all()) {
      expect(
        await metric.evaluate((el) => {
          const strong = el.querySelector('strong')!;
          const range = document.createRange();
          range.selectNodeContents(strong);
          const boxes = [...range.getClientRects()];
          const arrow = el.querySelector('ng-icon')?.getBoundingClientRect();
          return (
            boxes.length === 1 &&
            (!arrow ||
              Math.abs(arrow.top + arrow.height / 2 - (boxes[0].top + boxes[0].height / 2)) < 5)
          );
        }),
      ).toBe(true);
    }
  }
  await active.getByRole('button', { name: 'View Details', exact: true }).click();
  await expect(panel.locator('.insight-explanation')).toBeVisible();
  await panel.getByRole('button', { name: 'Back to results', exact: true }).click();
  await expect(active).toContainText('Your biggest movers');
});

test('market auto-opens three choices, preserves dismissal and removes Outlook tab', async ({
  page,
  loginPage,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await page.goto('/dashboard/markets/aapl');
  const panel = page.getByRole('region', { name: 'Dua insights' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.choices button')).toHaveCount(3);
  await expect(panel.locator('.choices button').first()).toHaveAttribute(
    'aria-label',
    'This Stock',
  );
  await expect(page.getByRole('tab', { name: 'Outlook', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'This Stock', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'This Stock', exact: true }).click();
  await expect(panel).not.toContainText('Open the full');
  await expect(panel).not.toContainText('+24.8%');
  await panel.getByRole('button', { name: 'Minimize Dua', exact: true }).click();
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
  await panel.getByRole('button', { name: 'Back to choices', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'This Stock', exact: true })).not.toHaveClass(
    /unread/,
  );
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'This Stock', exact: true })).not.toHaveClass(
    /unread/,
  );
});

test('legacy outlook links show inline details and respect reduced motion', async ({
  page,
  loginPage,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await page.goto('/dashboard/markets/aapl?tab=outlook');
  const panel = page.getByRole('region', { name: 'Dua insights' });
  await expect(panel.locator('.insight-explanation app-risk-outlook')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Trading', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
