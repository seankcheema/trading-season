import { readFile } from 'node:fs/promises';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures/test';

const THEME_KEY = 'ts.settings.theme';

// The page background and card surface of each theme, as the browser computes them.
const DARK_BACKGROUND = 'rgb(14, 14, 14)';
const LIGHT_BACKGROUND = 'rgb(244, 247, 249)';
const DARK_CARD = 'rgb(20, 20, 20)';
const LIGHT_CARD = 'rgb(255, 255, 255)';

const runsHeading = (page: Page) => page.getByRole('heading', { name: 'Report runs', level: 1 });
const firstCard = (page: Page) => page.locator('main .dash-card').first();

async function expectTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  const html = page.locator('html');
  if (theme === 'dark') {
    await expect(html).toHaveClass(/\bdark\b/);
  } else {
    await expect(html).not.toHaveClass(/\bdark\b/);
  }
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    theme === 'dark' ? DARK_BACKGROUND : LIGHT_BACKGROUND,
  );
}

/** The color of a PNG's top-left pixel, decoded by the browser. */
async function cornerPixel(page: Page, png: Buffer): Promise<number[]> {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, png.toString('base64'));
}

test.describe('Theme', () => {
  test('switches from the sign-in page and keeps the choice after a reload', async ({ page }) => {
    await page.goto('/login');
    await expectTheme(page, 'dark');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();

    await expectTheme(page, 'light');
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('light');

    // The script in index.html applies the saved theme before the app starts.
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      false,
    );
    await expectTheme(page, 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  });

  test('switches from the sidebar, open or collapsed', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(runsHeading(page)).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light theme' }).click();

    await expectTheme(page, 'light');
    await expect(firstCard(page)).toHaveCSS('background-color', LIGHT_CARD);
    await page.screenshot({ path: 'reports/playwright/theme-runs-light.png' });

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    const sidebar = page.locator('aside');
    const switcher = page.getByRole('button', { name: 'Switch to dark theme' });
    const logOut = page.getByRole('button', { name: 'Log out' });
    // Collapsed, the two stack inside the narrow sidebar.
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(80);
    const [box, side, out] = [
      (await switcher.boundingBox())!,
      (await sidebar.boundingBox())!,
      (await logOut.boundingBox())!,
    ];
    expect(box.x + box.width).toBeLessThanOrEqual(side.x + side.width);
    expect(out.y).toBeGreaterThan(box.y);

    await switcher.click();
    await expectTheme(page, 'dark');
    await expect(firstCard(page)).toHaveCSS('background-color', DARK_CARD);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`exports a light PDF from the ${theme} theme`, async ({ page, openAsAdmin }) => {
      await openAsAdmin('/runs');
      await expect(runsHeading(page)).toBeVisible();
      if (theme === 'light') {
        await page.getByRole('button', { name: 'Switch to light theme' }).click();
      }
      await expectTheme(page, theme);

      // Export PDF prints the page; print media is what the PDF is made from.
      await page.emulateMedia({ media: 'print' });

      await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BACKGROUND);
      await expect(firstCard(page)).toHaveCSS('background-color', LIGHT_CARD);
      await expect(page.locator('main [data-print-header]')).toHaveCSS('color', 'rgba(14, 14, 14, 0.62)');
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });
  }

  test('downloads a light chart PNG while the screen is dark', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/runs');
    await expect(runsHeading(page)).toBeVisible();
    await expectTheme(page, 'dark');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Traded value by symbol as PNG' }).click();
    const png = await readFile((await (await download).path())!);

    expect(await cornerPixel(page, png)).toEqual([255, 255, 255, 255]);
  });
});
