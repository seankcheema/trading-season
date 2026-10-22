import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PlatformTrend,
  TrendDay,
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
    outcome: 'up',
    move: 0.021,
    ...overrides,
  };
}

/**
 * Thirty consecutive reads from July 1; outcomes are all up with a +2.1% move. Over any
 * twenty in a row the model is right `modelHits` times and the pattern `ruleHits` times.
 * With a 5-day horizon a reading taken after index 24 compares exactly one such run.
 */
function scoredDays(modelHits: number, ruleHits: number, modelLate = false): TrendDay[] {
  return Array.from({ length: 30 }, (_, i) => {
    const slot = i % 20;
    const modelRight = modelLate ? slot >= 20 - modelHits : slot < modelHits;
    return day(`2026-07-${String(i + 1).padStart(2, '0')}`, {
      call: modelRight ? 'up' : 'down',
      momentum: slot < ruleHits ? 0.05 : -0.03,
    });
  });
}

const AAPL_DAYS = scoredDays(15, 12);
// The model trails the pattern here; on the last reads it says down while momentum is positive.
const XOM_DAYS = scoredDays(10, 14, true);

const TREND: PlatformTrend = {
  generatedAt: '2026-10-21T12:00:00+00:00',
  question: 'Is the price likely to be higher in 5 trading days?',
  horizonDays: 5,
  momentumDays: 10,
  model: 'Gradient-boosted classifier on momentum inputs',
  rule: 'The next 5 days continue the last 10 days direction',
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

  it('lets the model lead only where its last twenty closed reads beat the pattern', () => {
    const model = trendReadingFor(TREND, 'AAPL', LATE);
    expect(model.kind === 'ready' && [model.source, model.call]).toEqual(['model', 'up']);
    expect(model.kind === 'ready' && [model.modelHits, model.ruleHits]).toEqual([15, 12]);
    const rule = trendReadingFor(TREND, 'XOM', LATE);
    expect(rule.kind === 'ready' && [rule.source, rule.call, rule.modelCall]).toEqual([
      'rule',
      'up',
      'down',
    ]);
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
    const thin = {
      ...TREND,
      symbols: { AAPL: { ...TREND.symbols['AAPL'], days: AAPL_DAYS.slice(0, 15) } },
    };
    const reading = trendReadingFor(thin, 'AAPL', '2026-07-15T15:00:00Z');
    expect(reading.kind === 'ready' && reading.source).toBe('rule');
  });

  it('lists the recent closed reads with their moves, most recent first', () => {
    const reads = trendRecentReads(AAPL_DAYS, 28, 5);
    expect(reads.map((r) => r.date).slice(0, 2)).toEqual(['2026-07-24', '2026-07-23']);
    expect(reads).toHaveLength(6);
    // Read 23 had only 19 closed reads behind it, so the pattern led it; the model leads from read 24.
    expect(reads[0]).toMatchObject({ outcome: 'up', move: 0.021, source: 'rule', hit: true });
    expect(trendRecentReads(AAPL_DAYS, 29, 5)[0]).toMatchObject({
      date: '2026-07-25',
      source: 'model',
    });
    expect(trendRecentReads(AAPL_DAYS, 4, 5)).toEqual([]);
  });

  it('lists every covered symbol strongest momentum first', () => {
    const rows = trendOverview(TREND, LATE);
    expect(rows.map((r) => r.symbol)).toEqual(['AAPL', 'XOM']);
    expect(rows[0]).toMatchObject({ call: 'up', source: 'model', hits: 15, days: 20 });
    expect(rows[1]).toMatchObject({ call: 'up', source: 'rule', hits: 14, days: 20 });
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

  it('shows the suggestion, the notice on every render, and the proof behind Details', async () => {
    const { fixture, http } = setup();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('Loading');
    http.expectOne(PLATFORM_TREND_URL).flush(TREND);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid=trend-headline]')?.textContent).toContain(
      'Consider buying',
    );
    expect(el.querySelector('[data-testid=trend-basis-line]')?.textContent).toContain(
      'AAPL has been trending up 5.1% over the last 10 days',
    );
    expect(el.querySelector('[data-testid=trend-basis]')?.textContent).toContain(
      'Right 75% of the last 20 weeks on AAPL',
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
    expect(el.querySelector('[data-testid=trend-model]')?.textContent).toContain('leads');
    expect(
      el.querySelector('[data-testid=trend-pattern]')?.textContent?.replace(/\s+/g, ' '),
    ).toContain('Price higher Last 20 weeks 60% (12 of 20)');
    expect(el.querySelector('[data-testid=trend-recent]')?.textContent).toContain('+2.1%');
    expect(el.textContent).toContain('not investment advice');
  });

  it('follows the symbol and the simulated time', async () => {
    const { fixture, http } = setup();
    http.expectOne(PLATFORM_TREND_URL).flush(TREND);
    fixture.componentInstance.symbol.set('XOM');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid=trend-basis]')?.textContent).toContain(
      'Right 70% of the last 20 weeks on XOM',
    );
    (el.querySelector('[data-testid=trend-toggle]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid=trend-pattern]')?.textContent).toContain('leads');
    expect(
      el.querySelector('[data-testid=trend-model]')?.textContent?.replace(/\s+/g, ' '),
    ).toContain('Price lower Last 20 weeks 50% (10 of 20)');
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
