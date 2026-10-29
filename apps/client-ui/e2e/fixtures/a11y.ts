import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { appendFileSync } from 'node:fs';

/** The conformance level the application commits to: WCAG 2.2 Level AA, which includes A. */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** One axe rule that failed on one screen, reduced to what a reader needs to find and fix it. */
export interface Violation {
  screen: string;
  rule: string;
  impact: string | null | undefined;
  help: string;
  wcag: string[];
  nodes: string[];
  /** What axe measured on each node: the contrast ratio, the visible text against the accessible name, and so on. */
  details: string[];
  /** The start of each node's markup, to find it without reproducing the screen. */
  html: string[];
}

/** Maps axe tags such as `wcag143` to the success criterion number, 1.4.3. */
function criteria(tags: string[]): string[] {
  return tags
    .map((tag) => /^wcag(\d)(\d)(\d+)$/.exec(tag))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => `${match[1]}.${match[2]}.${match[3]}`);
}

/**
 * Waits for the animations that end, so a fade is not measured half-transparent. Looping ones
 * are left running, and one that never finishes (a paused or offscreen one) costs two seconds.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.race([
      Promise.allSettled(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  );
}

/**
 * Scans the page as it is now against WCAG 2.2 AA and returns the failures.
 *
 * Set A11Y_REPORT to a file path to also append each failure there, one JSON
 * object per line; scripts that compare two runs read it. Scan a screen only
 * once it has settled: a dialog still fading in reads as low contrast.
 */
export async function scan(page: Page, screen: string): Promise<Violation[]> {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  const violations = results.violations.map((violation) => ({
    screen,
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    wcag: criteria(violation.tags),
    nodes: violation.nodes.map((node) => node.target.join(' ')),
    html: violation.nodes.map((node) => node.html.slice(0, 240)),
    details: violation.nodes.map((node) =>
      [...node.any, ...node.all, ...node.none].map((check) => check.message).join('; '),
    ),
  }));
  const report = process.env['A11Y_REPORT'];
  if (report) {
    for (const violation of violations) {
      appendFileSync(report, JSON.stringify(violation) + '\n');
    }
  }
  return violations;
}

/** A failure of a criterion axe has no rule for, in the same shape as an axe failure. */
function manual(
  screen: string,
  rule: string,
  help: string,
  wcag: string,
  impact: string,
  nodes: string[],
): Violation[] {
  if (!nodes.length) {
    return [];
  }
  const violation = { screen, rule, impact, help, wcag: [wcag], nodes, details: nodes, html: [] };
  const report = process.env['A11Y_REPORT'];
  if (report) {
    appendFileSync(report, JSON.stringify(violation) + '\n');
  }
  return [violation];
}

/**
 * 2.4.7 Focus Visible: tabs through the page and reports each stop that looks the same focused
 * as blurred (outline, shadow, colors and underline are compared).
 */
export async function checkFocusVisible(
  page: Page,
  screen: string,
  stops = 40,
): Promise<Violation[]> {
  await settle(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const unseen = new Set<string>();
  for (let stop = 0; stop < stops; stop++) {
    await page.keyboard.press('Tab');
    const result = await page.evaluate(async () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) {
        return null;
      }
      const look = () => {
        const style = getComputedStyle(el);
        return [
          style.outlineStyle === 'none' ? 'none' : style.outlineWidth + style.outlineColor,
          style.boxShadow,
          style.backgroundColor,
          style.borderTopColor,
          style.color,
          style.textDecorationLine,
        ].join('|');
      };
      // Styles ease in on focus; read them once they have arrived.
      const arrived = () =>
        Promise.race([
          Promise.allSettled(el.getAnimations().map((animation) => animation.finished)),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]);
      await arrived();
      const focused = look();
      el.blur();
      await arrived();
      const blurred = look();
      el.focus({ focusVisible: true } as FocusOptions);
      const name =
        el.getAttribute('aria-label') ?? el.id ?? (el.textContent ?? '').trim().slice(0, 30);
      return { same: focused === blurred, label: `${el.tagName.toLowerCase()} "${name}"` };
    });
    if (result?.same) {
      unseen.add(result.label);
    }
  }
  return manual(screen, 'focus-not-visible', 'Keyboard focus must be visible', '2.4.7', 'serious', [
    ...unseen,
  ]);
}

/** 1.4.10 Reflow: at 320 CSS pixels wide nothing may need sideways scrolling to be read. */
export async function checkReflow(page: Page, screen: string): Promise<Violation[]> {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 640 });
  await settle(page);
  // The page scrolls sideways, or a container that scrolls or clips its own content does.
  const wide = await page.evaluate(() =>
    [document.documentElement, document.body, document.querySelector('main')]
      .filter((el): el is HTMLElement => el !== null)
      .filter(
        (el) =>
          el.scrollWidth > el.clientWidth + 1 &&
          (el === document.documentElement || getComputedStyle(el).overflowX !== 'visible'),
      )
      .map((el) => `${el.tagName.toLowerCase()} is ${el.scrollWidth}px wide in 320px`),
  );
  if (before) {
    await page.setViewportSize(before);
  }
  return manual(
    screen,
    'reflow-horizontal-scroll',
    'Content must reflow at 320px without horizontal scrolling',
    '1.4.10',
    'serious',
    wide,
  );
}

/** 1.4.11 Non-text Contrast: a field's border, or failing that its fill, must stand out 3:1. */
export async function checkFieldBoundaries(page: Page, screen: string): Promise<Violation[]> {
  await settle(page);
  const weak = await page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba => {
      const m = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [m[0], m[1], m[2], m[3] ?? 1];
    };
    const over = (top: Rgba, base: Rgba): Rgba => [
      top[0] * top[3] + base[0] * (1 - top[3]),
      top[1] * top[3] + base[1] * (1 - top[3]),
      top[2] * top[3] + base[2] * (1 - top[3]),
      1,
    ];
    const backdrop = (el: Element): Rgba => {
      const layers: Rgba[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        layers.push(parse(getComputedStyle(node).backgroundColor));
      }
      return layers
        .reverse()
        .reduce((base, layer) => over(layer, base), [255, 255, 255, 1] as Rgba);
    };
    const luminance = ([r, g, b]: Rgba) => {
      const c = [r, g, b].map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const fields = document.querySelectorAll<HTMLElement>(
      'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea',
    );
    const out: string[] = [];
    for (const field of fields) {
      const box = field.getBoundingClientRect();
      if (box.width < 16 || box.height < 16 || getComputedStyle(field).visibility === 'hidden') {
        continue;
      }
      const style = getComputedStyle(field);
      const around = backdrop(field.parentElement ?? field);
      const border = parseFloat(style.borderTopWidth) > 0 ? parse(style.borderTopColor) : null;
      const edge = border ? ratio(over(border, around), around) : 0;
      const body = ratio(backdrop(field), around);
      if (Math.max(edge, body) < 3) {
        const id = field.id || field.getAttribute('name') || '';
        out.push(
          `${field.tagName.toLowerCase()}#${id}: border ${edge.toFixed(2)}:1, fill ${body.toFixed(2)}:1`,
        );
      }
    }
    return out;
  });
  return manual(
    screen,
    'field-boundary-contrast',
    'A field must stand out from its surroundings at 3:1',
    '1.4.11',
    'serious',
    weak,
  );
}

/** 3.3.1 Error Identification: a field in error says so (aria-invalid) and points at its message. */
export async function checkErrorsAreProgrammatic(
  page: Page,
  screen: string,
): Promise<Violation[]> {
  const bad = await page.evaluate(() => {
    const invalid = document.querySelectorAll<HTMLElement>(
      'input.ng-invalid.ng-touched, select.ng-invalid.ng-touched, textarea.ng-invalid.ng-touched',
    );
    const out: string[] = [];
    for (const field of invalid) {
      const described = (field.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      const name = `#${field.id || field.getAttribute('name')}`;
      if (field.getAttribute('aria-invalid') !== 'true') {
        out.push(`${name} is invalid but not aria-invalid`);
      } else if (!described.length) {
        out.push(`${name} is aria-invalid but no message is attached by aria-describedby`);
      }
    }
    return out;
  });
  return manual(
    screen,
    'error-not-programmatic',
    'A field in error must be identified and described to assistive technology',
    '3.3.1',
    'serious',
    bad,
  );
}

/** 2.4.2 Page Titled: every screen the user can move between has a title of its own. */
export function checkTitles(titles: Map<string, string>, screen: string): Violation[] {
  const seen = new Map<string, string>();
  const bad: string[] = [];
  for (const [path, title] of titles) {
    if (!title.trim()) {
      bad.push(`${path} has no title`);
    } else if (seen.has(title)) {
      bad.push(`${path} and ${seen.get(title)} are both titled "${title}"`);
    } else {
      seen.set(title, path);
    }
  }
  return manual(
    screen,
    'page-title-not-distinct',
    'Each page must have its own descriptive title',
    '2.4.2',
    'moderate',
    bad,
  );
}
