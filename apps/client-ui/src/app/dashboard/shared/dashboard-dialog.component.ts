import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

let nextDialogId = 0;

// Modal shell for the dashboard's small form dialogs: backdrop, labelled header, close button,
// Escape to close and initial focus. The form goes in the projected content.
@Component({
  selector: 'app-dashboard-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      class="dashboard-dialog-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-12 backdrop-blur-sm md:items-center"
      (click)="closed.emit()"
    >
      <section
        #dialog
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        tabindex="-1"
        class="dashboard-dialog border-border bg-card w-full max-w-md rounded-2xl border shadow-2xl shadow-black/50 outline-none"
        (click)="$event.stopPropagation()"
      >
        <header class="border-border flex items-center justify-between gap-4 border-b px-5 py-3">
          <h2 [id]="titleId" class="text-sm font-semibold">{{ dialogTitle() }}</h2>
          <button
            type="button"
            class="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
            [attr.aria-label]="closeLabel()"
            (click)="closed.emit()"
          >
            <ng-icon name="lucideX" class="text-[18px]" />
          </button>
        </header>
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
    `,
  ],
})
export class DashboardDialogComponent {
  private readonly _dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  readonly dialogTitle = input.required<string>();
  readonly closeLabel = input('Close dialog');
  readonly closed = output<void>();

  protected readonly titleId = `dashboard-dialog-title-${nextDialogId++}`;

  constructor() {
    // Move focus into the dialog so keyboard and screen reader users land on its content.
    afterNextRender(() => this._dialog().nativeElement.focus());
  }
}
