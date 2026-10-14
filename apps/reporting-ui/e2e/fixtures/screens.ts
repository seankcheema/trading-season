import { type Locator, type Page, expect } from '@playwright/test';

/** Opens a filter select by its caption and picks an option by its text. */
export async function pickFilter(
  page: Page,
  caption: string | RegExp,
  option: string | RegExp,
): Promise<void> {
  const name = typeof caption === 'string' ? new RegExp(`^${caption}\\b`) : caption;
  await page.getByRole('button', { name }).click();
  await page.getByRole('option', { name: option }).click();
}

/** The "N of M rows" or "N of M customers" line above a table. */
export async function expectCount(
  page: Page,
  shown: number,
  of: number,
  noun: 'rows' | 'customers',
): Promise<void> {
  await expect(page.getByText(new RegExp(`^\\s*${shown} of ${of} ${noun}\\s*$`))).toBeVisible();
}

/** The rows of the table on screen, one per order, transfer or customer. */
export function tableRows(page: Page): Locator {
  return page.locator('main ul > li');
}
