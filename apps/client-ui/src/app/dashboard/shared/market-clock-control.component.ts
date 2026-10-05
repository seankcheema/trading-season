import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCalendarClock, lucideChevronDown } from '@ng-icons/lucide';
import { DashboardHeaderDropdownComponent } from './dashboard-header-dropdown.component';
import { MarketClockService } from './market-clock.service';
import { MarketSnapshot } from '../market-data.service';
@Component({
  selector: 'app-market-clock-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-60 min-w-0 max-w-full' },
  imports: [DashboardHeaderDropdownComponent],
  providers: [provideIcons({ lucideCalendarClock, lucideChevronDown })],
  template: `
    <app-dashboard-header-dropdown
      iconName="lucideCalendarClock"
      [label]="clock.marketClockLabel()"
      ariaLabel="Change simulated market time"
      [open]="open()"
      (openChange)="openChange.emit($event)"
      containerClass="w-full"
      panelClass="w-full p-3"
    >
      <p class="text-sm font-medium tabular-nums">{{ clock.marketClockLabel() }}</p>
      <p class="text-muted-foreground mt-1 text-xs">
        Range: {{ clock.marketClockShortRangeLabel() }}
      </p>
      <label for="market-date-time" class="text-muted-foreground mt-3 block text-xs"
        >Simulated time</label
      >
      <input
        #marketDateTimeInput
        id="market-date-time"
        type="datetime-local"
        class="border-border bg-background mt-2 h-9 w-full rounded-lg border px-3 text-sm"
        [value]="clock.marketDateTime()"
        [attr.min]="clock.marketDateTimeMin()"
        [attr.max]="clock.marketDateTimeMax()"
        (input)="clock.marketDateTime.set($any($event.target).value)"
        (change)="clock.marketDateTime.set($any($event.target).value)"
      />
      @if (clock.clockError()) {
        <p class="text-loss mt-2 text-xs">{{ clock.clockError() }}</p>
      }
      <button
        type="button"
        class="bg-primary text-primary-foreground mt-3 h-9 w-full rounded-lg text-sm font-medium disabled:opacity-50"
        [disabled]="
          clock.clockUpdating() || !clock.marketDateTime() || clock.marketSessionId() === null
        "
        (click)="apply(marketDateTimeInput.value)"
      >
        {{ clock.clockUpdating() ? 'Updating…' : 'Apply time' }}
      </button>
    </app-dashboard-header-dropdown>
  `,
})
export class MarketClockControlComponent {
  readonly clock = inject(MarketClockService);
  readonly open = input(false);
  readonly openChange = output<boolean>();
  readonly snapshotApplied = output<MarketSnapshot>();
  protected apply(value: string): void {
    this.clock.applyMarketDateTime(
      value,
      (snapshot) => this.snapshotApplied.emit(snapshot),
      () => this.openChange.emit(false),
    );
  }
}
