import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PlatformSignals,
  SignalDay,
  readingFor,
  recentReads,
  riskPointsFor,
} from './platform-signals';
import { PLATFORM_SIGNALS_URL } from './platform-signals.service';
import { RiskOutlookComponent } from './risk-outlook.component';

function day(date: string, overrides: Partial<SignalDay> = {}): SignalDay {
  return {
    date,
    probability: 0.62,
    call: 'stormier',
    usualVolatility: 0.011,
    recentVolatility: 0.009,
    modelHits: 15,
    modelDays: 20,
    ruleHits: 12,
    ruleDays: 20,
    outcome: 'stormier',
    ...overrides,
  };
}

const SIGNALS: PlatformSignals = {
  generatedAt: '2026-10-21T12:00:00+00:00',
  question: 'Will the next 5 trading days be more volatile than usual for this stock?',
  horizonDays: 5,
  usualWindowDays: 40,
  model: 'LSTM trained on the platform',
  rule: 'The next 5 days will be like the last 5',
  symbols: {
    AAPL: {
      firstDay: '2026-07-01',
      lastDay: '2026-07-03',
      days: [day('2026-07-01'), day('2026-07-02'), day('2026-07-03')],
    },
    XOM: {
      firstDay: '2026-07-01',
      lastDay: '2026-07-01',
      // The model trails the rule here, and recent volatility is above usual.
      days: [
        day('2026-07-01', { modelHits: 10, ruleHits: 14, recentVolatility: 0.02, call: 'calmer' }),
      ],
    },
  },
};

describe('readingFor', () => {
  it('uses the latest close strictly before the simulated trading date', () => {
    const reading = readingFor(SIGNALS, 'aapl', '2026-07-03T15:00:00Z');
    expect(reading.kind).toBe('ready');
    expect(reading.kind === 'ready' && reading.asOf).toBe('2026-07-02');
  });

  it('is too early before the first scored day and unknown for a symbol the file lacks', () => {
    expect(readingFor(SIGNALS, 'AAPL', '2026-07-01T15:00:00Z')).toEqual({
      kind: 'too-early',
      firstDay: '2026-07-01',
    });
    expect(readingFor(SIGNALS, 'TSLA', '2026-07-03T15:00:00Z')).toEqual({ kind: 'unknown-symbol' });
  });

  it('shows the model call only where its record beats the rule', () => {
    const model = readingFor(SIGNALS, 'AAPL', '2026-07-03T15:00:00Z');
    expect(model.kind === 'ready' && [model.source, model.call]).toEqual(['model', 'stormier']);
    const rule = readingFor(SIGNALS, 'XOM', '2026-07-02T15:00:00Z');
    // The rule reads recent above usual as stormier even though the model said calmer.
    expect(rule.kind === 'ready' && [rule.source, rule.call]).toEqual(['rule', 'stormier']);
  });

  it('falls back to the rule until the model has enough closed windows', () => {
    const thin: PlatformSignals = {
      ...SIGNALS,
      symbols: {
        AAPL: {
          ...SIGNALS.symbols['AAPL'],
          days: [day('2026-07-01', { modelHits: 9, modelDays: 10, ruleHits: 2, ruleDays: 10 })],
        },
      },
    };
    const reading = readingFor(thin, 'AAPL', '2026-07-02T15:00:00Z');
    expect(reading.kind === 'ready' && reading.source).toBe('rule');
  });
});

describe('recentReads', () => {
  // Twelve daily reads; the model leads from the start, calls alternate, outcomes are all stormier.
  const days = Array.from({ length: 12 }, (_, i) =>
    day(`2026-07-${String(i + 1).padStart(2, '0')}`, {
      call: i % 2 ? 'stormier' : 'calmer',
      outcome: 'stormier',
    }),
  );

  it('lists only reads whose window had closed, most recent first, capped at six', () => {
    const reads = recentReads(days, 11, 5);
    expect(reads.map((r) => r.date)).toEqual([
      '2026-07-07',
      '2026-07-06',
      '2026-07-05',
      '2026-07-04',
      '2026-07-03',
      '2026-07-02',
    ]);
    expect(reads.every((r) => r.source === 'model')).toBe(true);
    // 07-07 is index 6: an even index called calmer, and every outcome was stormier, so it missed.
    expect(reads[0]).toMatchObject({ call: 'calmer', outcome: 'stormier', hit: false });
    expect(reads[1]).toMatchObject({ call: 'stormier', hit: true });
  });

  it('is empty before any window has closed', () => {
    expect(recentReads(days, 4, 5)).toEqual([]);
  });

  it('skips reads whose outcome the file does not carry', () => {
    const partial = days.map((d, i) => (i === 2 ? { ...d, outcome: null } : d));
    expect(recentReads(partial, 11, 5).map((r) => r.date)).not.toContain('2026-07-03');
  });
});

describe('riskPointsFor', () => {
  const days = Array.from({ length: 12 }, (_, i) =>
    day(`2026-07-${String(i + 1).padStart(2, '0')}`, {
      probability: 0.1 * (i + 1),
      outcome: i % 2 ? 'stormier' : 'calmer',
    }),
  );
  const signals: PlatformSignals = {
    ...SIGNALS,
    symbols: { AAPL: { firstDay: '2026-07-01', lastDay: '2026-07-12', days } },
  };

  it('includes only readings made before the simulated trading date, as percentages', () => {
    const points = riskPointsFor(signals, 'aapl', '2026-07-10T15:00:00Z');
    expect(points.map((p) => p.time.toISOString().slice(0, 10)).at(-1)).toBe('2026-07-09');
    expect(points).toHaveLength(9);
    expect(points[0].value).toBe(10);
  });

  it('marks an outcome only once its window had closed by that date', () => {
    const points = riskPointsFor(signals, 'AAPL', '2026-07-10T15:00:00Z');
    // Nine readings (indices 0..8); a window of 5 has closed for indices 0..3 only.
    expect(points.slice(0, 4).map((p) => p.stormier)).toEqual([false, true, false, true]);
    expect(points.slice(4).every((p) => p.stormier === null)).toBe(true);
  });

  it('is empty for a symbol the file lacks', () => {
    expect(riskPointsFor(signals, 'TSLA', '2026-07-10T15:00:00Z')).toEqual([]);
  });
});

@Component({
  imports: [RiskOutlookComponent],
  template: `<app-risk-outlook [symbol]="symbol()" [marketTimestamp]="at()" />`,
})
class HostComponent {
  readonly symbol = signal('AAPL');
  readonly at = signal('2026-07-03T15:00:00Z');
}

describe('RiskOutlookComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('shows a skeleton while loading, then the reading', async () => {
    const { fixture, http } = setup();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('Loading');
    http.expectOne(PLATFORM_SIGNALS_URL).flush(SIGNALS);
    fixture.detectChanges();
    await fixture.whenStable();
    const headline = fixture.nativeElement.querySelector('[data-testid=outlook-headline]');
    expect(headline.textContent).toContain('Stormier than usual');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-basis]').textContent,
    ).toContain('Headline from the platform model');
    expect(
      fixture.nativeElement
        .querySelector('[data-testid=outlook-pattern]')
        .textContent.replace(/\s+/g, ' '),
    ).toContain('calmer next week like last · right 12 of 20');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-model]').textContent,
    ).toContain('shown');
    expect(fixture.nativeElement.textContent).toContain('never a recommendation');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-recent]').textContent,
    ).toContain('No week has closed yet');
  });

  it('follows the symbol and the simulated time', async () => {
    const { fixture, http } = setup();
    http.expectOne(PLATFORM_SIGNALS_URL).flush(SIGNALS);
    fixture.componentInstance.symbol.set('XOM');
    fixture.componentInstance.at.set('2026-07-02T15:00:00Z');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-basis]').textContent,
    ).toContain('Headline from the recent pattern');
    expect(
      fixture.nativeElement
        .querySelector('[data-testid=outlook-model]')
        .textContent.replace(/\s+/g, ' '),
    ).toContain('calmer 62% chance of stormier · right 10 of 20');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-pattern]').textContent,
    ).toContain('shown');
    fixture.componentInstance.at.set('2026-06-01T15:00:00Z');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No outlook yet');
  });

  it('offers a retry when the file cannot be loaded', async () => {
    const { fixture, http } = setup();
    http.expectOne(PLATFORM_SIGNALS_URL).flush('missing', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'unavailable',
    );
    fixture.nativeElement.querySelector('button').click();
    http.expectOne(PLATFORM_SIGNALS_URL).flush(SIGNALS);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid=outlook-headline]')).not.toBeNull();
  });
});
