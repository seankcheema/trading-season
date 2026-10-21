import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injector, PLATFORM_ID, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

// After each in-app navigation (not the first page load), moves focus to the new page's
// heading, so a screen reader announces the page that opened and the next Tab starts at its
// content, not wherever the old page left off (WCAG 2.4.3). The page title itself comes from
// each route's `title`. Call it once from the root component's constructor. The Client UI
// has the same helper; keep the two alike.
export function focusPageOnNavigation(): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }
  const document = inject(DOCUMENT);
  const injector = inject(Injector);
  let firstLoad = true;
  inject(Router)
    .events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    )
    .subscribe(() => {
      if (firstLoad) {
        firstLoad = false;
        return;
      }
      afterNextRender(() => focusHeading(document), { injector });
    });
}

function focusHeading(document: Document): void {
  // A dialog that opened with the page (the terms, the tour) keeps the focus it took.
  if (document.activeElement?.closest('[role="dialog"]')) {
    return;
  }
  const target =
    document.querySelector<HTMLElement>('main h1') ??
    document.querySelector<HTMLElement>('h1') ??
    document.querySelector<HTMLElement>('main');
  if (!target) {
    return;
  }
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  target.focus({ preventScroll: true });
}
