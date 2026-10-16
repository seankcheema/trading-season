import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEllipsisVertical } from '@ng-icons/lucide';

let nextConfirmationId = 0;

/** Compact order actions, with editing and a centered cancellation confirmation. */
@Component({
  selector: 'app-cancel-order-button',
  imports: [NgIcon],
  providers: [provideIcons({ lucideEllipsisVertical })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 self-stretch',
    '(click)': '$event.stopPropagation()',
    '(document:pointerdown)': 'closeOnOutsidePointer($event)',
    '(document:click)': 'closeOnOutsidePointer($event)',
  },
  template: `
    <details #actions class="relative flex self-stretch" (keydown.escape)="actions.open = false; $event.stopPropagation()">
      <summary aria-label="Order actions" title="Order actions" class="text-muted-foreground hover:bg-muted flex h-full min-h-6 w-6 self-stretch cursor-pointer list-none items-center justify-center rounded-md">
        <ng-icon name="lucideEllipsisVertical" aria-hidden="true" class="text-[18px]" />
      </summary>
      <div role="menu" aria-label="Order actions" class="border-border bg-card absolute right-0 top-full z-50 w-36 rounded-xl border p-1 shadow-xl">
        <button type="button" role="menuitem" class="hover:bg-muted w-full rounded-lg px-3 py-2 text-left text-xs" [disabled]="busy()" (click)="actions.open = false; edited.emit()">Edit order</button>
        <button type="button" role="menuitem" class="text-loss hover:bg-muted w-full rounded-lg px-3 py-2 text-left text-xs" [disabled]="busy()" (click)="actions.open = false; openConfirmation()">Cancel order</button>
      </div>
    </details>
    <dialog #confirmationDialog [attr.aria-labelledby]="titleId" (keydown.escape)="$event.stopPropagation()"
      class="border-border bg-card text-foreground m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border p-5 shadow-2xl">
      <h2 [id]="titleId" class="text-base font-semibold">Cancel this order?</h2>
      <p class="text-muted-foreground mt-2 text-sm">Cancel the open order for {{ orderLabel() }}? Reserved cash or shares will be released.</p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" autofocus class="border-border hover:bg-muted h-9 rounded-lg border px-3 text-sm" (click)="dismissConfirmation()">Keep order</button>
        <button type="button" class="bg-loss h-9 rounded-lg px-3 text-sm font-medium text-white" (click)="confirm()">Confirm cancellation</button>
      </div>
    </dialog>
  `,
  styles: ['summary::-webkit-details-marker { display: none; }', 'dialog::backdrop { background: rgb(0 0 0 / 60%); backdrop-filter: blur(4px); }'],
})
export class CancelOrderButtonComponent {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly actions = viewChild.required<ElementRef<HTMLDetailsElement>>('actions');
  protected closeOnOutsidePointer(event: Event): void {
    if (event.target instanceof Node && !this.hostElement.nativeElement.contains(event.target)) {
      this.actions().nativeElement.open = false;
    }
  }
  readonly orderLabel = input.required<string>();
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly edited = output<void>();
  protected readonly confirmation = viewChild.required<ElementRef<HTMLDialogElement>>('confirmationDialog');
  protected readonly titleId = `cancel-order-${nextConfirmationId++}`;
  protected openConfirmation(): void {
    this.confirmation().nativeElement.showModal();
  }
  protected dismissConfirmation(): void {
    this.confirmation().nativeElement.close();
  }
  protected confirm(): void {
    if (this.busy()) {
      return;
    }
    this.dismissConfirmation();
    this.confirmed.emit();
  }
}
