import AxeBuilder from '@axe-core/playwright';
import { type Page, expect } from '@playwright/test';

// The WCAG 2.0, 2.1 and 2.2 level A and AA rules, plus axe's best practices (landmarks, headings,
// ARIA roles that suit their element). Colour contrast on gradients is reported by axe as "needs
// review" rather than a violation, so it is not part of this check; the tokens' ratios are in
// the Themes section of the README.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/**
 * Fails when axe finds a violation on the page as it now stands, naming each rule, how many
 * elements broke it, and the first of them. Call it once the screen has settled: after the
 * data a screen shows has loaded and after a dialog has opened.
 */
export async function expectNoAccessibilityViolations(page: Page, label: string): Promise<void> {
  // Moves the pointer off whatever it rests on and lets colour transitions finish, since axe
  // measures contrast on the colours as drawn at that instant, mid-transition included.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}; ${violation.nodes.length} element(s), ` +
      `first ${violation.nodes[0]?.target.join(' ')}: ${violation.nodes[0]?.any[0]?.message ?? ''}`,
  );
  expect(summary, `${label} breaks accessibility rules`).toEqual([]);
}
