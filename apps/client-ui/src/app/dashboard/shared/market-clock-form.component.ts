import { ChangeDetectionStrategy, Component, ElementRef, inject, output, viewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { MarketClockService } from './market-clock.service';
import { MarketSnapshot } from '../market-data.service';

// Settings > Market clock: edits the shared simulated market time. Settings calls apply() from
// its Save all button; the page that opened Settings re-reads prices and history from the
// snapshot this emits.
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
  `,
  host: { class: 'flex flex-col gap-2' },
})
export class MarketClockFormComponent {
  readonly clock = inject(MarketClockService);
  readonly applied = output<MarketSnapshot>();

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('marketDateTimeInput');

  // Applies the entered time. Emits true once the clock moved, false when it was rejected
  // (the reason is shown in this form), then completes.
  apply(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      const done = (ok: boolean) => {
        subscriber.next(ok);
        subscriber.complete();
      };
      this.clock.applyMarketDateTime(
        this.input().nativeElement.value,
        (snapshot) => this.applied.emit(snapshot),
        () => done(true),
        () => done(false),
      );
    });
  }
}
