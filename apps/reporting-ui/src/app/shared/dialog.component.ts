import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

let nextDialogId = 0;

// A modal: blurred scrim, a 16px-radius card with a bordered title bar. Escape,
// the close button and a click on the scrim all close it. Tab and Shift+Tab stay
// inside the card, and focus goes back to the control that opened it on close.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideX })],
  host: {
    class:
      'fixed inset-0 z-50 flex animate-[ts-fade-in_150ms_ease-out_both] items-start justify-center overflow-y-auto bg-black/60 px-4 py-12 backdrop-blur-sm',
    '(click)': 'closed.emit()',
    '(document:keydown.escape)': 'closed.emit()',
  },
  template: `
    <section
      #panel
      role="dialog"
      aria-modal="true"
      class="bg-card my-auto w-full animate-[ts-pop-in_200ms_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl border shadow-2xl shadow-black/50"
      [style.max-width.px]="width()"
      [attr.aria-labelledby]="titleId"
      (click)="$event.stopPropagation()"
      (keydown.tab)="keepFocusInside($event)"
      (keydown.shift.tab)="keepFocusInside($event)"
    >
      <div class="flex items-center justify-between gap-4 border-b px-5 py-3">
        <h2 class="text-sm font-semibold" [id]="titleId">{{ title() }}</h2>
        <button
          #close
          type="button"
          class="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
          [attr.aria-label]="closeLabel()"
          (click)="closed.emit()"
        >
          <ng-icon name="lucideX" size="18" />
        </button>
      </div>
      <div class="p-5"><ng-content /></div>
    </section>
  `,
})
export class DialogComponent {
  readonly title = input.required<string>();
  readonly width = input(448);
  readonly closeLabel = input('Close dialog');
  readonly closed = output<void>();

  protected readonly titleId = `dialog-title-${nextDialogId++}`;
  private readonly _close = viewChild.required<ElementRef<HTMLButtonElement>>('close');
  private readonly _panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    const opener = inject(DOCUMENT).activeElement as HTMLElement | null;
    inject(DestroyRef).onDestroy(() => {
      // Focus that has already moved on to something outside the dialog is left where it is.
      const active = opener?.ownerDocument.activeElement;
      const panel = this._panel().nativeElement;
      const moved = active && active !== opener?.ownerDocument.body && !panel.contains(active);
      if (opener?.isConnected && !moved) {
        opener.focus();
      }
    });
    // Keyboard users start inside the dialog, not behind it.
    afterNextRender(() => this._close().nativeElement.focus());
  }

  // Wraps Tab from the last control to the first, and Shift+Tab the other way.
  protected keepFocusInside(event: Event): void {
    const keyboard = event as KeyboardEvent;
    const panel = this._panel().nativeElement;
    // Rendered controls only; where the browser cannot say, every control counts.
    const controls = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((control) =>
      typeof control.checkVisibility === 'function' ? control.checkVisibility() : true,
    );
    if (controls.length === 0) {
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = panel.ownerDocument.activeElement;
    if (keyboard.shiftKey && (active === first || !panel.contains(active))) {
      keyboard.preventDefault();
      last.focus();
    } else if (!keyboard.shiftKey && (active === last || !panel.contains(active))) {
      keyboard.preventDefault();
      first.focus();
    }
  }
}
