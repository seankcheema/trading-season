import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MarketClockService } from './market-clock.service';
import { MarketSnapshot } from '../market-data.service';

// Settings > Market clock: moves the shared simulated market time. The page that opened
// Settings re-reads prices and history from the snapshot this emits.
@Component({
  selector: 'app-market-clock-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-sm font-medium tabular-nums">{{ clock.marketClockLabel() }}</p>
    <p class="text-muted-foreground text-xs">Range: {{ clock.marketClockShortRangeLabel() }}</p>
    <label for="market-date-time" class="text-sm">Simulated time</label>
    <input
      #marketDateTimeInput
      id="market-date-time"
      type="datetime-local"
      class="border-border bg-background h-9 w-full rounded border px-3 text-sm"
      [value]="clock.marketDateTime()"
      [attr.min]="clock.marketDateTimeMin()"
      [attr.max]="clock.marketDateTimeMax()"
      aria-describedby="market-clock-help"
      (input)="clock.marketDateTime.set($any($event.target).value)"
      (change)="clock.marketDateTime.set($any($event.target).value)"
    />
    <p id="market-clock-help" class="text-muted-foreground text-sm">
      Trading runs 8:30 AM to 3:00 PM CT. After the close the clock keeps running with prices
      held until midnight, then moves to the next trading day.
    </p>
    @if (clock.clockError()) {
      <p class="text-loss text-sm">{{ clock.clockError() }}</p>
    }
    <button
      type="button"
      class="bg-primary text-primary-foreground h-9 w-full cursor-pointer rounded-lg text-sm font-medium disabled:opacity-50"
      [disabled]="clock.clockUpdating() || !clock.marketDateTime() || clock.marketSessionId() === null"
      (click)="apply(marketDateTimeInput.value)"
    >
      {{ clock.clockUpdating() ? 'Updating…' : 'Apply time' }}
    </button>
  `,
  host: { class: 'flex flex-col gap-2' },
})
export class MarketClockFormComponent {
  readonly clock = inject(MarketClockService);
  readonly applied = output<MarketSnapshot>();

  protected apply(value: string): void {
    this.clock.applyMarketDateTime(value, (snapshot) => this.applied.emit(snapshot));
  }
}
