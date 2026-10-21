import {
  DestroyRef,
  Directive,
  ElementRef,
  afterEveryRender,
  effect,
  inject,
  input,
} from '@angular/core';

// Sets a field's `aria-describedby` to the ids of the messages that belong to it, so a screen
// reader reads its error, hint or rules with the field (WCAG 1.3.1, 3.3.1). Bind the ids, or
// null for none: `[appDescribedBy]="invalid ? 'name-error' : null"`.
//
// An `hlmInput` has an `aria-describedby` binding of its own, fed by the `hlmFieldDescription`
// and `hlmFieldError` elements of its field. It writes the attribute on its own schedule, once
// the field is first checked, so a binding written on the input is overwritten or removed, and
// an always-present hint never reaches it. This directive writes the attribute as soon as the
// ids change and after each render, and puts it back whenever something else changes it. It
// only touches the attribute when it differs from what was bound.
@Directive({ selector: '[appDescribedBy]' })
export class DescribedByDirective {
  readonly ids = input<string | null>(null, { alias: 'appDescribedBy' });
  private readonly _element: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      this.ids();
      this.apply();
    });
    afterEveryRender(() => this.apply());
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => this.apply());
      observer.observe(this._element, { attributes: true, attributeFilter: ['aria-describedby'] });
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
  }

  private apply(): void {
    const ids = this.ids();
    if (ids === this._element.getAttribute('aria-describedby')) {
      return;
    }
    if (ids) {
      this._element.setAttribute('aria-describedby', ids);
    } else {
      this._element.removeAttribute('aria-describedby');
    }
  }
}
