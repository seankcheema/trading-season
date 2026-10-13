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

// A modal: blurred scrim, a 16px-radius card with a bordered title bar. Escape,
// the close button and a click on the scrim all close it.
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
      role="dialog"
      aria-modal="true"
      class="bg-card my-auto w-full animate-[ts-pop-in_200ms_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl border shadow-2xl shadow-black/50"
      [style.max-width.px]="width()"
      [attr.aria-labelledby]="titleId"
      (click)="$event.stopPropagation()"
    >
      <header class="flex items-center justify-between gap-4 border-b px-5 py-3">
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
      </header>
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

  constructor() {
    // Keyboard users start inside the dialog, not behind it.
    afterNextRender(() => this._close().nativeElement.focus());
  }
}
