import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Directive,
  ElementRef,
  Injector,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  inject,
} from '@angular/core';

const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

// The keyboard model a `role="menu"` promises (WAI-ARIA menu pattern): the arrow keys move
// between its items, wrapping at the ends, and Home and End jump to the first and last. A menu
// opened from the keyboard starts on its first item, and ArrowDown on a dropdown's summary
// opens it there too. Mouse users are unaffected. Import it wherever a template has a
// `role="menu"`; its selector picks the menus up by that attribute.
@Directive({
  selector: '[role="menu"]',
  host: { '(keydown)': 'onKeydown($event)' },
})
export class MenuKeyboardDirective implements OnInit, OnDestroy {
  private readonly _menu: HTMLElement = inject(ElementRef).nativeElement;
  private readonly _document = inject(DOCUMENT);
  private readonly _injector = inject(Injector);
  private readonly _browser = isPlatformBrowser(inject(PLATFORM_ID));
  private _details: HTMLDetailsElement | null = null;
  private _summary: HTMLElement | null = null;

  private readonly _onToggle = () => {
    if (this._details?.open && this.openedFromKeyboard()) {
      this.focusItem(0);
    }
  };

  private readonly _onSummaryKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    const index = event.key === 'ArrowDown' ? 0 : -1;
    if (this._details && !this._details.open) {
      // The panel only takes focus once it is shown; the toggle event comes after the click.
      this._details.addEventListener('toggle', () => this.focusItem(index), { once: true });
      this._summary?.click();
    } else {
      this.focusItem(index);
    }
  };

  ngOnInit(): void {
    if (!this._browser) {
      return;
    }
    this._details = this._menu.closest('details');
    if (this._details) {
      this._summary = this._details.querySelector('summary');
      this._details.addEventListener('toggle', this._onToggle);
      this._summary?.addEventListener('keydown', this._onSummaryKeydown);
    } else if (this.openedFromKeyboard()) {
      // A menu rendered on demand: it has just been opened by its button.
      afterNextRender(() => this.focusItem(0), { injector: this._injector });
    }
  }

  ngOnDestroy(): void {
    this._details?.removeEventListener('toggle', this._onToggle);
    this._summary?.removeEventListener('keydown', this._onSummaryKeydown);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    if (items.length === 0) {
      return;
    }
    const current = items.indexOf(this._document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = current < 0 || current === items.length - 1 ? 0 : current + 1;
        break;
      case 'ArrowUp':
        next = current <= 0 ? items.length - 1 : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next].focus();
  }

  private items(): HTMLElement[] {
    return [...this._menu.querySelectorAll<HTMLElement>(ITEMS)].filter(
      (item) => !item.hasAttribute('disabled') && isShown(item),
    );
  }

  // Index -1 is the last item.
  private focusItem(index: number): void {
    const items = this.items();
    items[index < 0 ? items.length - 1 : index]?.focus();
  }

  private openedFromKeyboard(): boolean {
    const active = this._document.activeElement;
    if (!active || this._menu.contains(active)) {
      return false;
    }
    try {
      return active.matches(':focus-visible');
    } catch {
      return false;
    }
  }
}

// Whether an element is rendered. Where the browser cannot say, it counts as shown.
function isShown(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}
