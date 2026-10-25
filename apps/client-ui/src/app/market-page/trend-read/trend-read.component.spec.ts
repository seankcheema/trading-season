import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PlatformTrend,
  TrendCall,
  TrendDay,
  signalRecordAt,
  trendOverview,
  trendReadingFor,
  trendRecentReads,
  trendRecordAt,
} from './platform-trend';
import { PLATFORM_TREND_URL } from './platform-trend.service';
import { TrendReadComponent } from './trend-read.component';

function day(date: string, overrides: Partial<TrendDay> = {}): TrendDay {
  return {
    date,
    probability: 0.64,
    call: 'up',
    momentum: 0.05,
    modelHits: 0,
    modelDays: 0,
    ruleHits: 0,
    ruleDays: 0,
    strength: 1.2,
    signal: 'up',
    signalHits: 0,
    signalDays: 0,
    outcome: 'up',
    move: 0.021,
    ...overrides,
  };
}

/**
 * Thirty consecutive reads from July 1; outcomes are all up with a +2.1% move. Over any
 * twenty in a row the model is right `modelHits` times and the pattern `ruleHits` times.
 * With a 5-day horizon a reading taken after index 24 compares exactly one such run.
 * `signal` gives the strong-trend read's call on each day, or null for no call.
 */
function scoredDays(
  modelHits: number,
  ruleHits: number,
  signal: (i: number) => TrendCall | null,
  modelLate = false,
): TrendDay[] {
  return Array.from({ length: 30 }, (_, i) => {
    const slot = i % 20;
    const modelRight = modelLate ? slot >= 20 - modelHits : slot < modelHits;
    const call = signal(i);
    return day(`2026-07-${String(i + 1).padStart(2, '0')}`, {
      call: modelRight ? 'up' : 'down',
      momentum: slot < ruleHits ? 0.05 : -0.03,
      strength: call ? 1.2 : 0.3,
      signal: call,
    });
  });
}

// No call on every third day, a wrong "down" call on every fifth; the July 29 read (index 28) has no call.
const AAPL_DAYS = scoredDays(15, 12, (i) => (i % 3 === 1 ? null : i % 5 === 3 ? 'down' : 'up'));
// The model trails the pattern here; the strong-trend read calls up on three days in four.
const XOM_DAYS = scoredDays(10, 14, (i) => (i % 4 === 3 ? null : 'up'), true);

const TREND: PlatformTrend = {
  generatedAt: '2026-10-21T12:00:00+00:00',
  question: 'Is the price likely to be higher in 5 trading days?',
  horizonDays: 5,
  momentumDays: 10,
  model: 'Gradient-boosted classifier on momentum inputs',
  rule: 'The next 5 days continue the last 10 days direction',
  signalRule: 'The last 5 days direction, called only when that move is large against its noise',
  signalDays: 5,
  signalCutoffs: { '2026-07': 0.9 },
  notice: 'A machine-learning read on a simulated market.',
  symbols: {
    AAPL: { firstDay: '2026-07-01', lastDay: '2026-07-30', days: AAPL_DAYS },
    XOM: { firstDay: '2026-07-01', lastDay: '2026-07-30', days: XOM_DAYS },
  },
};
const LATE = '2026-07-30T15:00:00Z';

describe('trendReadingFor', () => {
  it('uses the latest close strictly before the simulated trading date', () => {
    const reading = trendReadingFor(TREND, 'aapl', '2026-07-03T15:00:00Z');
    expect(reading.kind === 'ready' && reading.asOf).toBe('2026-07-02');
    expect(trendReadingFor(TREND, 'AAPL', '2026-07-01T15:00:00Z')).toEqual({
      kind: 'too-early',
      firstDay: '2026-07-01',
    });
    expect(trendReadingFor(TREND, 'TSLA', LATE)).toEqual({ kind: 'unknown-symbol' });
  });

  it("leads with the strong-trend read's call, which is null on a week too weak to call", () => {
    const quiet = trendReadingFor(TREND, 'AAPL', LATE);
    expect(quiet.kind === 'ready' && [quiet.call, quiet.modelCall, quiet.ruleCall]).toEqual([
      null,
      'up',
      'up',
    ]);
    expect(quiet.kind === 'ready' && [quiet.modelHits, quiet.ruleHits]).toEqual([15, 12]);
    const called = trendReadingFor(TREND, 'XOM', LATE);
    expect(called.kind === 'ready' && [called.call, called.modelCall]).toEqual(['up', 'down']);
  });

  it('counts the record from outcomes over closed reads only', () => {
    expect(trendRecordAt(AAPL_DAYS, 28, 5)).toEqual({
      modelHits: 15,
      modelDays: 20,
      ruleHits: 12,
      ruleDays: 20,
    });
    expect(trendRecordAt(AAPL_DAYS, 14, 5).modelDays).toBe(10);
    expect(trendRecordAt(AAPL_DAYS, 3, 5).modelDays).toBe(0);
  });

  it("counts the strong-trend read's last closed calls and the weeks it took to make them", () => {
    // 24 closed weeks behind the July 29 read; 16 of them were calls, 12 right.
    expect(signalRecordAt(AAPL_DAYS, 28, 5)).toEqual({
      signalHits: 12,
      signalCalls: 16,
      signalWeeks: 24,
    });
    expect(signalRecordAt(AAPL_DAYS, 14, 5)).toEqual({
      signalHits: 5,
      signalCalls: 7,
      signalWeeks: 10,
    });
    expect(signalRecordAt(AAPL_DAYS, 3, 5)).toEqual({
      signalHits: 0,
      signalCalls: 0,
      signalWeeks: 0,
    });
    // Stops at twenty calls even when more closed weeks lie behind them.
    const long = Array.from({ length: 40 }, (_, i) => day(`2026-08-${i}`, { signal: 'up' }));
    expect(signalRecordAt(long, 39, 5)).toEqual({
      signalHits: 20,
      signalCalls: 20,
      signalWeeks: 20,
    });
  });

  it('lists the recent closed calls with their moves, most recent first, skipping no-call weeks', () => {
    const reads = trendRecentReads(AAPL_DAYS, 28, 5);
    expect(reads.map((r) => r.date)).toEqual([
      '2026-07-24',
      '2026-07-22',
      '2026-07-21',
      '2026-07-19',
      '2026-07-18',
      '2026-07-16',
    ]);
    expect(reads[0]).toMatchObject({ call: 'down', outcome: 'up', move: 0.021, hit: false });
    expect(reads[1]).toMatchObject({ call: 'up', hit: true });
    expect(trendRecentReads(AAPL_DAYS, 4, 5)).toEqual([]);
  });

  it('lists every covered symbol strongest momentum first, with its strong-trend record', () => {
    const rows = trendOverview(TREND, LATE);
    expect(rows.map((r) => r.symbol)).toEqual(['AAPL', 'XOM']);
    expect(rows[0]).toMatchObject({ call: null, hits: 12, calls: 16, weeks: 24 });
    expect(rows[1]).toMatchObject({ call: 'up', hits: 18, calls: 18, weeks: 24 });
    expect(trendOverview(TREND, '2026-07-01T15:00:00Z')).toEqual([]);
  });
});

@Component({
  imports: [TrendReadComponent],
  template: `<app-trend-read [symbol]="symbol()" [marketTimestamp]="at()" />`,
})
class HostComponent {
  readonly symbol = signal('AAPL');
  readonly at = signal(LATE);
}

describe('TrendReadComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function text(el: HTMLElement, testId: string): string {
    return el.querySelector(`[data-testid=${testId}]`)?.textContent?.replace(/\s+/g, ' ') ?? '';
  }

  it('says there is no clear direction on a weak week, with the notice and the proof behind Details', async () => {
    const { fixture, http } = setup();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('Loading');
    http.expectOne(PLATFORM_TREND_URL).flush(TREND);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el, 'trend-headline')).toContain('No clear direction');
    expect(el.querySelector('.glance-up, .glance-down')).toBeNull();
    expect(text(el, 'trend-basis-line')).toContain(
      "AAPL's recent move is too small against its usual swings to call",
    );
    expect(text(el, 'trend-basis')).toContain(
      'Right 75% of its last 16 calls on AAPL, made on 16 of the last 24 weeks',
    );
    expect(el.querySelector('[data-testid=trend-notice]')?.textContent).toContain(
      'machine-learning read on a simulated market',
    );
    expect(el.querySelector('[data-testid=trend-details]')).toBeNull();
    (el.querySelector('[data-testid=trend-toggle]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid=trend-meter]')?.textContent).toContain(
      'Model estimate: 64% chance the price is higher in 5 trading days',
    );
    expect(text(el, 'trend-signal')).toContain('No call');
    expect(text(el, 'trend-signal')).toContain(
      'Last 16 calls 75% (12 of 16), made on 16 of 24 weeks',
    );
    expect(text(el, 'trend-model')).not.toContain('leads');
    expect(text(el, 'trend-model')).toContain('Price higher Last 20 weeks 75% (15 of 20)');
    expect(text(el, 'trend-pattern')).toContain('Price higher Last 20 weeks 60% (12 of 20)');
    expect(text(el, 'trend-recent')).toContain('+2.1%');
    expect(text(el, 'trend-recent')).toContain('Missed');
    expect(el.textContent).toContain('not investment advice');
  });

  it('follows the symbol and the simulated time', async () => {
    const { fixture, http } = setup();
    http.expectOne(PLATFORM_TREND_URL).flush(TREND);
    fixture.componentInstance.symbol.set('XOM');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el, 'trend-headline')).toContain('Consider buying');
    expect(el.querySelector('.glance-up')).not.toBeNull();
    expect(text(el, 'trend-basis-line')).toContain(
      'XOM moved up over the last 5 days, by more than its usual swings',
    );
    expect(text(el, 'trend-basis')).toContain(
      'Right 100% of its last 18 calls on XOM, made on 18 of the last 24 weeks',
    );
    (el.querySelector('[data-testid=trend-toggle]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text(el, 'trend-signal')).toContain('leads');
    expect(text(el, 'trend-model')).toContain('Price lower Last 20 weeks 50% (10 of 20)');
    fixture.componentInstance.at.set('2026-06-01T15:00:00Z');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.textContent).toContain('No trade signal yet');
  });

  it('offers a retry when the file cannot be loaded', async () => {
    const { fixture, http } = setup();
    http.expectOne(PLATFORM_TREND_URL).flush('missing', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'unavailable',
    );
    fixture.nativeElement.querySelector('button').click();
    http.expectOne(PLATFORM_TREND_URL).flush(TREND);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid=trend-headline]')).not.toBeNull();
  });
});
