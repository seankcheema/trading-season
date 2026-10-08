import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { utcDay } from '../reporting/format';
import { DailyCount } from '../reporting/report.models';

// At most this many day labels sit under the plot, evenly spaced.
const MAX_AXIS_LABELS = 6;

// Round a maximum up to an even, readable axis top so the midpoint is a whole number.
export function axisTop(max: number): number {
  if (max <= 2) {
    return 2;
  }
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 4, 5, 10].map((step) => step * magnitude).find((step) => step >= max)!;
  return top % 2 ? top + 1 : top;
}

// Stacked bars of resolved orders per UTC day: filled below, rejected above.
@Component({
  selector: 'app-daily-trades-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-col' },
  template: `
    @if (bars().length) {
      <p class="text-[13px] tabular-nums" aria-hidden="true">
        <span class="font-medium">{{ shown().label }}</span>
        <span class="text-muted-foreground">
          · {{ shown().filled }} filled · {{ shown().rejected }} rejected
        </span>
      </p>
      <div
        class="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(10rem,1fr)_auto] gap-2"
      >
        <div class="relative">
          @for (tick of ticks(); track tick.position) {
            <span
              class="border-border/60 pointer-events-none absolute inset-x-0 border-t"
              [style.top.%]="tick.position"
            ></span>
          }
          <ol
            class="relative flex h-full items-stretch justify-around gap-1"
            (mouseleave)="active.set(null)"
          >
            @for (bar of bars(); track bar.date; let index = $index) {
              <li
                class="group flex max-w-12 min-w-0 flex-1 cursor-default flex-col justify-end rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                tabindex="0"
                [attr.aria-label]="
                  bar.label + ': ' + bar.filled + ' filled, ' + bar.rejected + ' rejected'
                "
                (mouseenter)="active.set(index)"
                (focus)="active.set(index)"
                (blur)="active.set(null)"
              >
                <span
                  class="bg-loss block rounded-t-xs opacity-80 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  [style.height.%]="bar.rejectedHeight"
                ></span>
                <span
                  class="bg-gain block opacity-80 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  [class.rounded-t-xs]="!bar.rejected"
                  [style.height.%]="bar.filledHeight"
                ></span>
              </li>
            }
          </ol>
        </div>
        <!-- Right-hand axis: each number is centered on its gridline. -->
        <div
          class="text-muted-foreground relative text-right text-[11px] tabular-nums"
          aria-hidden="true"
        >
          <span class="invisible">{{ top() }}</span>
          @for (tick of ticks(); track tick.position) {
            <span class="absolute right-0 -translate-y-1/2" [style.top.%]="tick.position">
              {{ tick.value }}
            </span>
          }
        </div>
        <div class="text-muted-foreground flex justify-around gap-1 text-[11px]" aria-hidden="true">
          @for (bar of bars(); track bar.date) {
            <span class="flex max-w-12 min-w-0 flex-1 justify-center whitespace-nowrap">
              {{ bar.axisLabel }}
            </span>
          }
        </div>
      </div>
    } @else {
      <p class="text-muted-foreground py-10 text-center text-sm">No orders have resolved yet.</p>
    }
  `,
})
export class DailyTradesChartComponent {
  readonly days = input.required<readonly DailyCount[]>();

  // Index of the hovered or focused day.
  protected readonly active = signal<number | null>(null);

  protected readonly top = computed(() =>
    axisTop(Math.max(0, ...this.days().map((day) => day.filled + day.rejected))),
  );

  // Gridlines and their axis numbers, as a distance from the top of the plot.
  protected readonly ticks = computed(() => [
    { position: 0, value: this.top() },
    { position: 50, value: this.top() / 2 },
    { position: 100, value: 0 },
  ]);

  protected readonly bars = computed(() => {
    const days = this.days();
    const top = this.top();
    const every = Math.max(1, Math.ceil(days.length / MAX_AXIS_LABELS));
    return days.map((day, index) => {
      const label = utcDay(day.date);
      return {
        ...day,
        label,
        // Count back from the newest day so the latest bar always carries a label.
        axisLabel: (days.length - 1 - index) % every === 0 ? label : '',
        filledHeight: (day.filled / top) * 100,
        rejectedHeight: (day.rejected / top) * 100,
      };
    });
  });

  // The day in the readout: the one under the pointer, otherwise the newest.
  protected readonly shown = computed(() => {
    const bars = this.bars();
    return bars[this.active() ?? bars.length - 1] ?? bars[bars.length - 1];
  });
}
