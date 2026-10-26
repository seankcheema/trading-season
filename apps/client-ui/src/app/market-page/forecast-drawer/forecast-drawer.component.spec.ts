import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PlatformSignalsService } from '../risk-outlook/platform-signals.service';
import { PlatformTrendService } from '../trend-read/platform-trend.service';
import { ForecastDrawerComponent } from './forecast-drawer.component';

// Thirty readings before the clock. Trend: the strong-trend read makes no call on every fourth
// day and a wrong "down" call on days 0, 10 and 20; the momentum pattern is right on slots 0-11
// of every twenty. Swings: the model is right on slots 0-14, the rule on slots 0-11.
const trendDays = Array.from({ length: 30 }, (_, i) => ({
  date: `2025-12-${String(i + 1).padStart(2, '0')}`,
  probability: 0.64,
  call: i % 20 < 15 ? 'up' : 'down',
  momentum: i % 20 < 12 ? 0.05 : -0.03,
  modelHits: 0,
  modelDays: 0,
  ruleHits: 0,
  ruleDays: 0,
  strength: i % 4 === 3 ? 0.3 : 1.2,
  signal: i % 4 === 3 ? null : i % 10 === 0 ? 'down' : 'up',
  signalHits: 0,
  signalDays: 0,
  outcome: 'up',
  move: 0.021,
}));
const outlookDays = Array.from({ length: 30 }, (_, i) => ({
  date: `2025-12-${String(i + 1).padStart(2, '0')}`,
  probability: 0.62,
  call: i % 20 < 15 ? 'stormier' : 'calmer',
  usualVolatility: 0.011,
  recentVolatility: i % 20 < 12 ? 0.02 : 0.009,
  modelHits: 0,
  modelDays: 0,
  ruleHits: 0,
  ruleDays: 0,
  outcome: 'stormier',
}));

@Component({
  imports: [ForecastDrawerComponent],
  template: `<app-forecast-drawer
    [symbol]="symbol()"
    marketTimestamp="2026-01-05T15:05:00Z"
    (closed)="closes = closes + 1"
  />`,
})
class HostComponent {
  readonly symbol = signal('AAPL');
  closes = 0;
}

describe('ForecastDrawerComponent', () => {
  function setup(status: 'ready' | 'loading' = 'ready') {
    const trend = {
      trend: signal({
        generatedAt: '2025-12-31T00:00:00Z',
        question: 'q',
        horizonDays: 5,
        momentumDays: 10,
        model: 'm',
        rule: 'r',
        signalRule: 's',
        signalDays: 5,
        signalCutoffs: {},
        notice: 'n',
        symbols: { AAPL: { firstDay: '2025-12-01', lastDay: '2025-12-30', days: trendDays } },
      }),
      status: signal(status),
      load: vi.fn(() => of(null)),
    };
    const signals = {
      signals: signal({
        generatedAt: '2025-12-31T00:00:00Z',
        question: 'q',
        horizonDays: 5,
        usualWindowDays: 40,
        model: 'm',
        rule: 'r',
        symbols: { AAPL: { firstDay: '2025-12-01', lastDay: '2025-12-30', days: outlookDays } },
      }),
      status: signal(status),
      load: vi.fn(() => of(null)),
    };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PlatformTrendService, useValue: trend },
        { provide: PlatformSignalsService, useValue: signals },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = (testId: string) =>
      el.querySelector(`[data-testid=${testId}]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { fixture, el, text };
  }

  it('shows both forecasts, their records and what each is scored against', () => {
    const { el, text } = setup();
    const drawer = el.querySelector('app-forecast-drawer')!;
    expect(drawer.getAttribute('role')).toBe('complementary');
    expect(drawer.getAttribute('aria-label')).toBe('AAPL forecast');
    expect(text('forecast-drawer')).toContain('Model forecast');
    expect(text('forecast-drawer')).toContain('next 5 trading days');

    expect(text('forecast-direction')).toContain('Price likely higher');
    expect(text('forecast-direction')).toContain('84% confidence');

    expect(text('forecast-volatility')).toContain('Bigger price swings likely');
    expect(el.querySelector('[data-testid=forecast-volatility] .drawer-call')!.classList).toContain(
      'swing-more',
    );
    expect(text('forecast-volatility')).toContain('75% confidence');
    expect(el.querySelector('.drawer-meter-track')!.getAttribute('aria-label')).toBe(
      'Model estimate: 62% chance of bigger swings',
    );

    const scores = [...el.querySelectorAll('[data-testid=forecast-scoring] li')].map(
      (li) =>
        `${li.querySelector('span')!.textContent!.trim()}: ${li.querySelector('strong')!.textContent!.trim()}`,
    );
    expect(scores).toEqual([
      'Direction forecast: 16 of last 19 calls (84%)',
      '"Keeps going the same way": 12 of last 20 weeks (60%)',
      'Swings model: 15 of last 20 weeks (75%)',
      '"Like last week": 12 of last 20 weeks (60%)',
    ]);
    expect(text('forecast-drawer')).toMatch(/not investment advice/i);
  });

  it('leads with each call and its record, and keeps the reasons and scoring closed until asked', () => {
    const { fixture, el, text } = setup();
    const summary = el.querySelector('.drawer-summary')!.textContent!.replace(/\s+/g, ' ');
    expect(summary).toContain('Price likely higher');
    expect(summary).toContain('84% confidence');
    expect(summary).toContain('Bigger price swings likely');
    expect(summary).toContain('75% confidence');
    expect(summary).not.toContain('Keeps going the same way');
    expect(summary).not.toContain('moved up');
    expect(el.querySelectorAll('.drawer-summary app-forecast-confidence')).toHaveLength(2);
    expect(text('forecast-why')).toContain('Confidence is how often');

    const why = el.querySelector('[data-testid=forecast-why]') as HTMLDetailsElement;
    const scoring = el.querySelector('[data-testid=forecast-scoring]') as HTMLDetailsElement;
    expect(why.open).toBe(false);
    expect(scoring.open).toBe(false);
    expect(text('forecast-why')).toContain('AAPL moved up over the last 5 days');
    expect(text('forecast-why')).toContain('Called 19 of the last 25 weeks');

    (scoring.querySelector('summary') as HTMLElement).click();
    fixture.detectChanges();
    expect(scoring.open).toBe(true);
  });

  it('closes on its button and on Escape', () => {
    const { fixture, el } = setup();
    (el.querySelector('[aria-label="Close forecast"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.closes).toBe(1);
    el.querySelector('app-forecast-drawer')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(fixture.componentInstance.closes).toBe(2);
  });

  it('says so while loading and for a stock no forecast covers', () => {
    const loading = setup('loading');
    expect(loading.text('forecast-drawer')).toContain('Loading the forecast');
    TestBed.resetTestingModule();

    const { fixture, text } = setup();
    fixture.componentInstance.symbol.set('ZZZZ');
    fixture.detectChanges();
    expect(text('forecast-direction')).toContain('No direction forecast covers ZZZZ.');
    expect(text('forecast-volatility')).toContain('No volatility forecast covers ZZZZ.');
  });
});
