import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

let nextDialogId = 0;

// Modal shell for the dashboard's small form dialogs: backdrop, labelled header, close button,
// Escape to close, initial focus, Tab kept inside the dialog, and focus handed back to the
// control that opened it on close. The form goes in the projected content.
@Component({
  selector: 'app-dashboard-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus, NgIcon],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'dismiss()' },
  template: `
    <div
      class="dashboard-dialog-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-12 backdrop-blur-sm md:items-center"
      (click)="dismiss()"
    >
      <section
        #dialog
        cdkTrapFocus
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        tabindex="-1"
        class="dashboard-dialog border-border bg-card w-full rounded-2xl border shadow-2xl shadow-black/50 outline-none"
        [class]="sizeClass()"
        (click)="$event.stopPropagation()"
      >
        <div class="border-border flex items-center justify-between gap-4 border-b px-5 py-3">
          <h2 [id]="titleId" class="text-sm font-semibold">{{ dialogTitle() }}</h2>
          @if (dismissible()) {
            <button
              type="button"
              class="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
              [attr.aria-label]="closeLabel()"
              (click)="closed.emit()"
            >
              <ng-icon name="lucideX" class="text-[18px]" />
            </button>
          }
        </div>
        <div class="p-5">
          <ng-content />
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .dashboard-dialog-backdrop {
        animation: dashboard-dialog-fade-in 150ms ease-out both;
      }

      .dashboard-dialog {
        animation: dashboard-dialog-pop-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      @keyframes dashboard-dialog-fade-in {
        from {
          opacity: 0;
        }
      }

      @keyframes dashboard-dialog-pop-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .dashboard-dialog-backdrop,
        .dashboard-dialog {
          animation: none;
        }
      }
    `,
  ],
})
export class DashboardDialogComponent {
  private readonly _dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  readonly dialogTitle = input.required<string>();
  readonly closeLabel = input('Close dialog');
  // Form dialogs are narrow; tables need room, and the full assets table needs the most.
  readonly size = input<'narrow' | 'wide' | 'xwide'>('narrow');
  // False for a dialog that must be answered: it has no close button, and neither Escape nor a
  // click on the backdrop closes it. The projected content provides the only ways out.
  readonly dismissible = input(true);
  readonly closed = output<void>();

  protected readonly sizeClass = computed(
    () => ({ narrow: 'max-w-md', wide: 'max-w-4xl', xwide: 'max-w-[70rem]' })[this.size()],
  );

  protected readonly titleId = `dashboard-dialog-title-${nextDialogId++}`;

  constructor() {
    // The control that opened the dialog: focus goes back to it when the dialog closes, so
    // keyboard users carry on where they were instead of at the top of the page.
    const opener = inject(DOCUMENT).activeElement as HTMLElement | null;
    inject(DestroyRef).onDestroy(() => restoreFocus(opener, this._dialog().nativeElement));
    // Move focus into the dialog so keyboard and screen reader users land on its content.
    afterNextRender(() => this._dialog().nativeElement.focus());
  }

  protected dismiss(): void {
    if (this.dismissible()) {
      this.closed.emit();
    }
  }
}

// Focuses the control a dialog was opened from. An item in a dropdown menu that has since
// closed cannot take focus, so its menu's button does instead. Focus that has already moved on
// to something outside the dialog is left where it is.
export function restoreFocus(opener: HTMLElement | null, dialog: HTMLElement): void {
  const active = dialog.ownerDocument.activeElement;
  if (!opener?.isConnected || (active && active !== dialog.ownerDocument.body && !dialog.contains(active))) {
    return;
  }
  const closedMenu = opener.closest('details:not([open])');
  (closedMenu?.querySelector<HTMLElement>('summary') ?? opener).focus();
}
