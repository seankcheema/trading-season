import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlatformSignals, SignalDay, readingFor, recentReads, recordAt } from './platform-signals';
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

/**
 * Thirty consecutive reads from July 1. Over any twenty in a row the model is right
 * `modelHits` times and the rule `ruleHits` times (outcomes are all stormier; the
 * rule reads recent above usual as stormier). With a 5-day horizon, a reading
 * taken after index 24 compares exactly one such run, so the record is fixed.
 */
function scoredDays(modelHits: number, ruleHits: number, modelLate = false): SignalDay[] {
  return Array.from({ length: 30 }, (_, i) => {
    const slot = i % 20;
    const modelRight = modelLate ? slot >= 20 - modelHits : slot < modelHits;
    return day(`2026-07-${String(i + 1).padStart(2, '0')}`, {
      call: modelRight ? 'stormier' : 'calmer',
      recentVolatility: slot < ruleHits ? 0.02 : 0.009,
    });
  });
}

const AAPL_DAYS = scoredDays(15, 12);
// The model trails the rule here; on the last reads it says calmer while recent volatility is above usual.
const XOM_DAYS = scoredDays(10, 14, true);

const SIGNALS: PlatformSignals = {
  generatedAt: '2026-10-21T12:00:00+00:00',
  question: 'Will the next 5 trading days be more volatile than usual for this stock?',
  horizonDays: 5,
  usualWindowDays: 40,
  model: 'LSTM trained on the platform',
  rule: 'The next 5 days will be like the last 5',
  symbols: {
    AAPL: { firstDay: '2026-07-01', lastDay: '2026-07-30', days: AAPL_DAYS },
    XOM: { firstDay: '2026-07-01', lastDay: '2026-07-30', days: XOM_DAYS },
  },
};
const LATE = '2026-07-30T15:00:00Z';

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

  it('shows the model call only where its record over the last twenty closed reads beats the rule', () => {
    const model = readingFor(SIGNALS, 'AAPL', LATE);
    expect(model.kind === 'ready' && [model.source, model.call]).toEqual(['model', 'stormier']);
    expect(model.kind === 'ready' && [model.modelHits, model.modelDays]).toEqual([15, 20]);
    expect(model.kind === 'ready' && [model.ruleHits, model.ruleDays]).toEqual([12, 20]);
    const rule = readingFor(SIGNALS, 'XOM', LATE);
    // The rule reads recent above usual as stormier even though the model said calmer.
    expect(rule.kind === 'ready' && [rule.source, rule.call, rule.modelCall]).toEqual([
      'rule',
      'stormier',
      'calmer',
    ]);
  });

  it('counts the record from the file outcomes, over closed reads only, ignoring the file running totals', () => {
    const record = recordAt(AAPL_DAYS, 28, 5);
    expect(record).toEqual({ modelHits: 15, modelDays: 20, ruleHits: 12, ruleDays: 20 });
    // Reads 24..28 have not closed; the window then reaches back to read 4.
    const shorter = recordAt(AAPL_DAYS, 14, 5);
    expect(shorter.modelDays).toBe(10);
    const unknown = AAPL_DAYS.map((d, i) => (i === 20 ? { ...d, outcome: null } : d));
    expect(recordAt(unknown, 28, 5).modelDays).toBe(20); // skips it and reaches one read further back
    expect(recordAt(AAPL_DAYS, 3, 5)).toEqual({
      modelHits: 0,
      modelDays: 0,
      ruleHits: 0,
      ruleDays: 0,
    });
  });

  it('falls back to the rule until the model has enough closed windows', () => {
    const thin: PlatformSignals = {
      ...SIGNALS,
      symbols: { AAPL: { ...SIGNALS.symbols['AAPL'], days: AAPL_DAYS.slice(0, 15) } },
    };
    const reading = readingFor(thin, 'AAPL', '2026-07-15T15:00:00Z');
    expect(reading.kind === 'ready' && reading.source).toBe('rule');
    expect(reading.kind === 'ready' && reading.modelDays).toBe(9);
  });
});

describe('recentReads', () => {
  // The thirty AAPL reads, where the model leads, then twelve more whose calls alternate; outcomes are all stormier.
  const days = [
    ...AAPL_DAYS,
    ...Array.from({ length: 12 }, (_, i) =>
      day(`2026-08-${String(i + 1).padStart(2, '0')}`, {
        call: (i + 30) % 2 ? 'stormier' : 'calmer',
        outcome: 'stormier',
      }),
    ),
  ];

  it('lists only reads whose window had closed, most recent first, capped at six', () => {
    const reads = recentReads(days, 41, 5);
    expect(reads.map((r) => r.date)).toEqual([
      '2026-08-07',
      '2026-08-06',
      '2026-08-05',
      '2026-08-04',
      '2026-08-03',
      '2026-08-02',
    ]);
    expect(reads.every((r) => r.source === 'model')).toBe(true);
    // 08-07 is index 36: an even index called calmer, and every outcome was stormier, so it missed.
    expect(reads[0]).toMatchObject({ call: 'calmer', outcome: 'stormier', hit: false });
    expect(reads[1]).toMatchObject({ call: 'stormier', hit: true });
  });

  it('is empty before any window has closed', () => {
    expect(recentReads(days, 4, 5)).toEqual([]);
  });

  it('skips reads whose outcome the file does not carry', () => {
    const partial = days.map((d, i) => (i === 32 ? { ...d, outcome: null } : d));
    expect(recentReads(partial, 41, 5).map((r) => r.date)).not.toContain('2026-08-03');
  });
});

@Component({
  imports: [RiskOutlookComponent],
  template: `<app-risk-outlook [symbol]="symbol()" [marketTimestamp]="at()" />`,
})
class HostComponent {
  readonly symbol = signal('AAPL');
  readonly at = signal('2026-07-30T15:00:00Z');
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
    expect(headline.textContent).toContain('Bigger price swings likely');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-direction]').textContent,
    ).toContain('up or down, not a direction');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-basis]').textContent,
    ).toContain('Right 75% of the last 20 weeks on AAPL');
    // The proof is behind the Details toggle.
    expect(fixture.nativeElement.querySelector('[data-testid=outlook-details]')).toBeNull();
    fixture.nativeElement.querySelector('[data-testid=outlook-toggle]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid=outlook-pattern]')
        .textContent.replace(/\s+/g, ' '),
    ).toContain('Bigger swings Last 20 weeks 60% (12 of 20)');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-model]').textContent,
    ).toContain('leads');
    expect(fixture.nativeElement.textContent).toContain('never a recommendation');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-meter]').textContent,
    ).toContain('Model estimate: 62% chance of bigger swings');
    // The latest read whose window had closed by the 07-29 close was made on 07-24.
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-recent]').textContent,
    ).toContain('Jul 24');
  });

  it('follows the symbol and the simulated time', async () => {
    const { fixture, http } = setup();
    http.expectOne(PLATFORM_SIGNALS_URL).flush(SIGNALS);
    fixture.componentInstance.symbol.set('XOM');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-basis]').textContent,
    ).toContain('Right 70% of the last 20 weeks on XOM');
    fixture.nativeElement.querySelector('[data-testid=outlook-toggle]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid=outlook-model]')
        .textContent.replace(/\s+/g, ' '),
    ).toContain('Smaller swings Last 20 weeks 50% (10 of 20)');
    expect(
      fixture.nativeElement.querySelector('[data-testid=outlook-pattern]').textContent,
    ).toContain('leads');
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
