import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
} from '@angular/core';

export interface SegmentedTab<T extends string = string> {
  id: T;
  label: string;
  // How many rows the tab holds; omitted while that is not known.
  count?: number | null;
}

// A row of tabs that switch one panel between views. The selected tab sits on a thumb that
// slides under it, each tab can show how much it holds, and the arrow keys, Home and End move
// between tabs. Each tab's id and test id is the prefix and the tab id joined by a dash, which
// is what the panel it controls names in aria-labelledby.
@Component({
  selector: 'app-segmented-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <div
      class="bg-muted relative grid auto-cols-fr grid-flow-col rounded-lg p-0.5"
      role="tablist"
      [attr.aria-label]="label()"
      (keydown)="onKeydown($event)"
    >
      <span
        class="bg-primary pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        aria-hidden="true"
        data-testid="segmented-tabs-thumb"
        [style.width]="'calc((100% - 0.25rem) / ' + tabs().length + ')'"
        [style.transform]="'translateX(' + selectedIndex() * 100 + '%)'"
      ></span>
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="relative flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
          [class]="
            value() === tab.id
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          [id]="testIdPrefix() + '-' + tab.id"
          [attr.aria-selected]="value() === tab.id"
          [attr.tabindex]="value() === tab.id ? 0 : -1"
          [attr.data-testid]="testIdPrefix() + '-' + tab.id"
          (click)="value.set(tab.id)"
        >
          <span>{{ tab.label }}</span>
          @if (tab.count !== undefined && tab.count !== null) {
            <span
              class="rounded-full px-1.5 text-[11px] leading-4 font-medium tabular-nums"
              [class]="value() === tab.id ? 'bg-primary-foreground/20' : 'bg-foreground/10'"
              [attr.data-testid]="testIdPrefix() + '-count-' + tab.id"
            >
              {{ tab.count }}
            </span>
          }
        </button>
      }
    </div>
  `,
})
export class SegmentedTabsComponent<T extends string = string> {
  private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly tabs = input.required<readonly SegmentedTab<T>[]>();
  readonly value = model.required<T>();
  // Names the group for assistive technology.
  readonly label = input.required<string>();
  readonly testIdPrefix = input('tab');

  protected readonly selectedIndex = computed(() =>
    Math.max(
      0,
      this.tabs().findIndex((tab) => tab.id === this.value()),
    ),
  );

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.tabs().length - 1;
    const current = this.selectedIndex();
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = current === last ? 0 : current + 1;
        break;
      case 'ArrowLeft':
        next = current === 0 ? last : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.value.set(this.tabs()[next].id);
    this._host.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }
}
