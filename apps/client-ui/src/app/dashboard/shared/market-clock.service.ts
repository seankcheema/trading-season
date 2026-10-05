import { Injectable, computed, inject, signal, DestroyRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MarketCalendarAvailability,
  MarketDataService,
  MarketSnapshot,
} from '../market-data.service';

const DEFAULT_MARKET_CALENDAR: MarketCalendarAvailability = {
  timezone: 'America/Chicago',
  firstTimestamp: '2026-01-01T14:30:00Z',
  lastTimestamp: '2026-12-31T20:59:59Z',
  tradingDates: marketWeekdays(2026),
};

@Injectable()
export class MarketClockService {
  private readonly marketData = inject(MarketDataService);
  private readonly destroyRef = inject(DestroyRef);
  readonly marketSessionId = signal<number | null>(null);
  readonly currentMarketTimestamp = signal('');
  readonly marketCalendar = signal<MarketCalendarAvailability>(DEFAULT_MARKET_CALENDAR);
  readonly marketDateTime = signal('');
  readonly clockError = signal('');
  readonly clockUpdating = signal(false);
  readonly marketClockLabel = computed(() =>
    this.currentMarketTimestamp()
      ? this.formatMarketTime(this.currentMarketTimestamp(), {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        })
      : 'Market time',
  );
  readonly marketClockRangeLabel = computed(() => {
    const calendar = this.marketCalendar();
    return `${this.formatMarketTime(calendar.firstTimestamp, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })} - ${this.formatMarketTime(calendar.lastTimestamp, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })}`;
  });
  readonly marketClockShortRangeLabel = computed(() => {
    const calendar = this.marketCalendar();
    return `${this.formatMarketTime(calendar.firstTimestamp, {
      month: 'short',
      day: 'numeric',
    })} - ${this.formatMarketTime(calendar.lastTimestamp, {
      month: 'short',
      day: 'numeric',
    })}`;
  });
  readonly marketDateTimeMin = computed(() => {
    const calendar = this.marketCalendar();
    return this.isoToMarketLocal(calendar.firstTimestamp);
  });
  readonly marketDateTimeMax = computed(() => {
    const calendar = this.marketCalendar();
    return this.isoToMarketLocal(calendar.lastTimestamp);
  });

  sync(snapshot: MarketSnapshot): void {
    this.marketSessionId.set(snapshot.sessionId);
    this.currentMarketTimestamp.set(snapshot.marketTimestamp);
    this.marketCalendar.set(snapshot.calendar);
    this.marketDateTime.set(this.isoToMarketLocal(snapshot.marketTimestamp));
  }
  applyMarketDateTime(
    value = this.marketDateTime(),
    onSnapshot: (snapshot: MarketSnapshot) => void = () => {},
    onApplied: () => void = () => {},
  ): void {
    const sessionId = this.marketSessionId();
    this.marketDateTime.set(value);
    if (sessionId === null || !value) {
      return;
    }
    const resolved = this.resolveMarketDateTime(value);
    if (resolved.error) {
      this.clockError.set(resolved.error);
      return;
    }
    this.marketDateTime.set(resolved.value);
    this.clockUpdating.set(true);
    this.clockError.set('');
    this.marketData
      .setClock(sessionId, this.marketLocalToIso(resolved.value))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snapshot) => {
          onSnapshot(snapshot);
          this.clockUpdating.set(false);
          onApplied();
        },
        error: (error: HttpErrorResponse) => {
          this.clockError.set(this.clockErrorMessage(error));
          this.clockUpdating.set(false);
        },
      });
  }

  private isoToMarketLocal(timestamp: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  }

  private resolveMarketDateTime(value: string): { value: string; error: string } {
    const calendar = this.marketCalendar();
    const selected = value.slice(0, 10);
    const min = this.marketDateTimeMin();
    const max = this.marketDateTimeMax();
    if ((min && value < min) || (max && value > max)) {
      return {
        value,
        error: `This simulation has market data from ${this.marketClockRangeLabel()}.`,
      };
    }
    if (!calendar.tradingDates.includes(selected)) {
      const replacement = this.nearestLoadedDateInMonth(selected);
      if (!replacement) {
        return {
          value,
          error: `${this.formatMarketDate(selected)} is not in this simulation archive. Choose one of the loaded trading dates.`,
        };
      }
      return { value: `${replacement}${value.slice(10)}`, error: '' };
    }
    return { value, error: '' };
  }

  private nearestLoadedDateInMonth(value: string): string {
    const calendar = this.marketCalendar();
    const month = value.slice(0, 7);
    const dates = calendar.tradingDates.filter((date) => date.startsWith(month));
    const next = dates.find((date) => date >= value);
    if (next) return next;
    for (let index = dates.length - 1; index >= 0; index--) {
      if (dates[index] <= value) return dates[index];
    }
    return '';
  }

  private clockErrorMessage(error: HttpErrorResponse): string {
    const message = typeof error.error?.error === 'string' ? error.error.error : '';
    return (
      message ||
      `Unable to update the market clock. Available range: ${this.marketClockRangeLabel()}.`
    );
  }

  private formatMarketDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  private formatMarketTime(timestamp: string, options: Intl.DateTimeFormatOptions): string {
    const calendar = this.marketCalendar();
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: calendar?.timezone ?? 'America/Chicago',
    })
      .format(new Date(timestamp))
      .replace(/\bC[DS]T\b/, 'CT');
  }

  private marketLocalToIso(value: string): string {
    const [date, time] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    let instant = desired;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const parts = formatter.formatToParts(new Date(instant));
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((item) => item.type === type)?.value);
      const represented = Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
      );
      instant += desired - represented;
    }
    return new Date(instant).toISOString();
  }
}

function marketWeekdays(year: number): string[] {
  const dates: string[] = [];
  for (
    let time = Date.UTC(year, 0, 1);
    time <= Date.UTC(year, 11, 31);
    time += 24 * 60 * 60 * 1000
  ) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(time).toISOString().slice(0, 10));
    }
  }
  return dates;
}
