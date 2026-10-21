import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarClock } from '@ng-icons/lucide';
import { MarketClockService } from './market-clock.service';

// The simulated market time shown in a page header, read-only. The time is changed from
// Settings > Market clock (MarketClockFormComponent); after the 15:00 close the clock keeps
// running with prices held, and the header marks the market closed.
@Component({
  selector: 'app-market-clock-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-60 min-w-0 max-w-full' },
  imports: [NgIcon],
  providers: [provideIcons({ lucideCalendarClock })],
  template: `
    <div
      class="border-border bg-card flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border px-3 text-sm"
      role="status"
      aria-label="Simulated market time"
    >
      <ng-icon name="lucideCalendarClock" class="shrink-0 text-[16px]" />
      <span class="min-w-0 flex-1 truncate text-left leading-tight tabular-nums">{{
        clock.marketClockLabel()
      }}</span>
      @if (!clock.marketOpen()) {
        <span
          class="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
          data-testid="market-closed"
          >Closed</span
        >
      }
    </div>
  `,
})
export class MarketClockControlComponent {
  readonly clock = inject(MarketClockService);
}
