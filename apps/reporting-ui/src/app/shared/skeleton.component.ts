import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

// Placeholders shown while a screen's first load is in flight. Each stands where
// the real piece will be, at about its size, so the screen does not jump when the
// data arrives. They are hidden from assistive technology: the screen says what
// is loading in a visually hidden status beside them. The blocks themselves are
// the `skeleton` class in styles.css.

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

// The row of headline figures above Activity and Report runs.
@Component({
  selector: 'app-skeleton-kpis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5',
    'aria-hidden': 'true',
  },
  template: `
    @for (card of cards(); track card) {
      <section class="dash-card p-4">
        <span class="skeleton h-3.5 w-20"></span>
        <span class="skeleton mt-1.5 h-7 w-24"></span>
        <span class="skeleton mt-2 h-4 w-28"></span>
      </section>
    }
  `,
})
export class SkeletonKpisComponent {
  readonly count = input(5);
  protected readonly cards = computed(() => range(this.count()));
}

// A card with a title and either a chart or a breakdown of rows with bars. In a
// screen that fills the window the card is as high as its row allows, so the
// chart shrinks and the rows clip instead of spilling out of it.
@Component({
  selector: 'app-skeleton-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dash-card flex min-h-0 flex-col overflow-hidden p-5', 'aria-hidden': 'true' },
  template: `
    <span class="skeleton h-4 w-32 shrink-0"></span>
    @if (chart()) {
      <span class="skeleton mt-2 h-8 w-40 shrink-0"></span>
      <span class="skeleton mt-3 min-h-16 shrink grow basis-40 rounded-lg" data-chart></span>
    } @else {
      <div class="mt-4 flex min-h-0 flex-col gap-3 overflow-hidden">
        @for (row of rows(); track row) {
          <div data-row>
            <div class="flex justify-between gap-3">
              <span class="skeleton h-4 w-24"></span>
              <span class="skeleton h-4 w-16"></span>
            </div>
            <span class="skeleton mt-2 h-1.5 rounded-full"></span>
          </div>
        }
      </div>
    }
  `,
})
export class SkeletonCardComponent {
  // A chart under a headline figure, in place of the rows.
  readonly chart = input(false, { transform: booleanAttribute });
  readonly lines = input(4);
  protected readonly rows = computed(() => range(this.lines()));
}

// Labelled values, as in a customer's profile card or a section of the order
// dialog. The grid is the caller's: give the host the same grid classes as the
// list it stands in for.
@Component({
  selector: 'app-skeleton-facts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (fact of facts(); track fact) {
      <div>
        <span class="skeleton h-3 w-16"></span>
        <span class="skeleton mt-1.5 h-4 w-24 max-w-full"></span>
      </div>
    }
  `,
})
export class SkeletonFactsComponent {
  readonly count = input.required<number>();
  protected readonly facts = computed(() => range(this.count()));
}

// A searchable table: the search box, its filters, the column headings and rows.
// It fills the card and clips the rows that do not fit.
@Component({
  selector: 'app-skeleton-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col', 'aria-hidden': 'true' },
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-2">
      <span class="flex max-w-[300px] flex-[1_1_240px] flex-col gap-1">
        <span class="skeleton h-3.5 w-12"></span>
        <span class="skeleton h-8 rounded-lg"></span>
      </span>
      @for (filter of filterList(); track filter) {
        <span class="flex w-[140px] flex-col gap-1" data-filter>
          <span class="skeleton h-3.5 w-12"></span>
          <span class="skeleton h-8 rounded-lg"></span>
        </span>
      }
      <span class="skeleton ml-auto h-3.5 w-28 self-center"></span>
    </div>
    <div class="min-h-0 flex-1 overflow-hidden">
      <div [style.min-width.px]="minWidth()">
        <div
          class="dash-table-head grid items-center gap-2 px-2"
          [style.grid-template-columns]="tracks()"
        >
          @for (column of columns(); track column) {
            <span class="skeleton h-3 w-3/5"></span>
          }
        </div>
        @for (row of rowList(); track row) {
          <div
            class="grid items-center gap-2 px-2 py-2.5"
            data-row
            [style.grid-template-columns]="tracks()"
          >
            @for (column of columns(); track column) {
              <span class="skeleton w-4/5" [class]="tall() ? 'h-8' : 'h-5'"></span>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class SkeletonTableComponent {
  // The table's own grid-template-columns, so the placeholders line up with its columns.
  readonly tracks = input.required<string>();
  // How many select filters stand beside the search box.
  readonly filters = input(0);
  readonly rows = input(8);
  // The width under which the table scrolls sideways instead of squeezing.
  readonly minWidth = input(0);
  // Rows that hold two lines of text, such as a customer's name over their email.
  readonly tall = input(false, { transform: booleanAttribute });

  protected readonly columns = computed(() => range(this.tracks().trim().split(/\s+/).length));
  protected readonly filterList = computed(() => range(this.filters()));
  protected readonly rowList = computed(() => range(this.rows()));
}
