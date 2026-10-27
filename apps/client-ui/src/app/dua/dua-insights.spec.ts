import { CandlePointDto } from '../dashboard/market-data.service';
import { Instrument } from '../dashboard/mock-data';
import {
  dailyCard,
  dailyPreviewCards,
  dailyReview,
  directionCard,
  holdingCards,
  percentChange,
  stockCards,
  stockPreviewCards,
  holdingsPreviewCards,
  DUA_EXPLANATIONS,
  highlightParts,
  insightTextParts,
  outlookForecastRecord,
  sparklinePoints,
  trendForecastRecord,
  watchlistPulse,
} from './dua-insights';

describe('Dua insights', () => {
  it('adds plain-language takeaways without implying positive performance when data is incomplete', () => {
    const holdings = [{ symbol: 'AAPL', quantity: 1, averageCost: 100 }];
    const up = [{ symbol: 'AAPL', name: 'Apple', price: 110, change: 10, changePercent: 10 }];
    expect(holdingCards(holdings, up)[0].takeaway).toContain('holdings are UP');
    expect(holdingCards(holdings, [])[0].takeaway).toContain('missing');
    expect(dailyReview(holdings, [])[1].takeaway).toContain('Missing prices');
    expect(dailyReview(holdings, up)[0].takeaway).toContain('tracked stocks are UP');
  });
  it('keeps result messages free of replacement characters', () => {
    const quotes = [quote('UP', 110, 10), quote('DOWN', 90, -10)];
    const holdings = [{ symbol: 'UP', quantity: 1, averageCost: 100 }];
    const results = [...dailyReview(holdings, quotes), ...holdingCards(holdings, quotes)];
    expect(results.every((card) => !card.takeaway?.includes('\uFFFD'))).toBe(true);
  });
  it('preserves response text while distinguishing signed numeric gains and losses', () => {
    const text = 'AAPL: +$1,250.00 (+10.0%); TSLA: -$30.00 (-2.5%). 2 positions.';
    const parts = insightTextParts(text);
    expect(parts.map((part) => part.text).join('')).toBe(text);
    expect(parts.find((part) => part.text === '+$1,250.00')?.tone).toBe('gain');
    expect(parts.find((part) => part.text === '-2.5%')?.tone).toBe('loss');
    expect(parts.find((part) => part.text === '2')?.emphasis).toBe(true);
    expect(insightTextParts('Prices unavailable.').every((part) => !part.emphasis)).toBe(true);
  });
  const quote = (symbol: string, price: number, change: number): Instrument => ({
    symbol,
    name: symbol,
    price,
    change,
    changePercent: 0,
  });
  const holdings = [
    { symbol: 'AAPL', quantity: 2, averageCost: 100 },
    { symbol: 'TSLA', quantity: 3, averageCost: 100 },
  ];
  const candles = (closes: number[]): CandlePointDto[] =>
    closes.map((close, minute) => ({
      timestamp: `2026-01-05T15:0${minute}:00Z`,
      open: close,
      close,
      high: close,
      low: close,
      volume: 1,
    }));

  it('keeps fundamental previews explicitly illustrative and independent of stock data', () => {
    const cards = stockPreviewCards();
    expect(cards.map((card) => card.title)).toEqual([
      'Growth insight',
      'Valuation insight',
      'Risk insight',
    ]);
    expect(cards.map((card) => card.metrics?.[0].value)).toEqual(['+24.8%', '-18%', '65%']);
    expect(
      cards.every(
        (card) => card.illustrative && !card.symbol && card.purpose?.startsWith('In this example'),
      ),
    ).toBe(true);
    expect(DUA_EXPLANATIONS.stock[0].description).toContain('not figures for the selected stock');
  });
  it('provides three explicit holdings placeholders with example periods', () => {
    const cards = holdingsPreviewCards();
    expect(cards.map((card) => card.title)).toEqual([
      'Portfolio growth',
      'Sector concentration',
      'Top performer',
    ]);
    expect(cards.map((card) => card.metrics?.[0].value)).toEqual(['+12.4%', '68%', '+32.8%']);
    expect(cards.map((card) => card.period)).toEqual(['This Month', 'Current', 'This Month']);
    expect(cards.every((card) => card.illustrative)).toBe(true);
    expect(DUA_EXPLANATIONS.holdings[0].description).toContain('not calculated from your account');
  });
  it('provides three daily examples with explicit event and account limitations', () => {
    const cards = dailyPreviewCards();
    expect(cards.map((card) => card.title)).toEqual([
      'Market overview',
      'Portfolio impact',
      "Tomorrow's outlook",
    ]);
    expect(cards.map((card) => card.metrics?.[0].value)).toEqual(['+1.8%', '$385', '3']);
    expect(cards.map((card) => card.period)).toEqual(['Today', 'Today', 'Up Next']);
    expect(cards.every((card) => card.illustrative)).toBe(true);
    expect(DUA_EXPLANATIONS.daily[0].description).toContain("not today's actual market data");
    expect(DUA_EXPLANATIONS.daily[0].description).toContain('not calculated from your account');
  });
  it('uses opening price rather than purchase cost or a supplied percentage', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(dailyCard(quote('AAPL', 110, 10))?.text).toContain('up 10.0%');
    expect(dailyCard(quote('AAPL', 100, 0))?.text).toContain('unchanged');
    for (const baseline of [0, -1, NaN, Infinity]) expect(percentChange(10, baseline)).toBeNull();
    expect(percentChange(NaN, 100)).toBeNull();
    expect(dailyCard(quote('AAPL', 0, 1))).toBeNull();
  });

  it('separates market pulse from at most four ranked standout movers', () => {
    const quotes = [
      quote('C', 110, 10),
      quote('B', 110, 10),
      quote('A', 110, 10),
      quote('Z', 80, -20),
      quote('Y', 80, -20),
      quote('X', 90, -10),
      quote('FLAT', 100, 0),
    ];
    const cards = dailyReview(holdings, quotes);
    expect(cards.map((card) => card.title)).toEqual(['Market pulse', 'Standout movers']);
    expect(cards[0].metrics?.map((metric) => metric.value)).toEqual(['3', '3']);
    expect(cards[0].metrics?.every((metric) => !metric.stocks)).toBe(true);
    expect(cards[1].symbols).toEqual(['A', 'B', 'Y', 'Z']);
    expect(
      cards[1].metrics?.flatMap((metric) => metric.stocks?.map((stock) => stock.symbol) ?? []),
    ).toEqual(['A', 'B', 'Y', 'Z']);
    expect(dailyReview([], quotes)).toEqual(cards);
    expect(cards[0].detail).toContain('not the entire market');
  });
  it('handles all-up, all-down, flat, missing and empty market data', () => {
    for (const change of [10, -10]) {
      const cards = dailyReview([], [quote('A', 100 + change, change)]);
      expect(cards[1].metrics).toHaveLength(1);
      expect(cards[1].metrics?.[0].tone).toBe(change > 0 ? 'gain' : 'loss');
    }
    const flat = dailyReview([], [quote('A', 100, 0), quote('BAD', 10, 10)]);
    expect(flat[0].takeaway).toContain('unchanged');
    expect(flat[0].note).toContain('1 of 2');
    expect(flat[1].metrics).toEqual([]);
    expect(dailyReview([], [])[0].text).toContain('unavailable');
  });
  it('ranks movers using unrounded percentage changes', () => {
    const cards = dailyReview([], [quote('A', 110.01, 10.01), quote('Z', 110.02, 10.02)]);
    expect(cards[1].symbols).toEqual(['Z', 'A']);
  });
  it('never describes profitable holdings as losses or losing holdings as gains', () => {
    const rows = [
      { symbol: 'A', quantity: 10, averageCost: 100 },
      { symbol: 'B', quantity: 1, averageCost: 100 },
    ];
    const gains = holdingCards(rows, [quote('A', 110, 0), quote('B', 150, 0)]);
    expect(gains[1].metrics).toHaveLength(1);
    expect(gains[1].metrics?.[0]).toMatchObject({ symbol: 'A', tone: 'gain', value: '+$100.00' });
    const losses = holdingCards(rows, [quote('A', 90, 0), quote('B', 50, 0)]);
    expect(losses[1].metrics).toHaveLength(1);
    expect(losses[1].metrics?.[0]).toMatchObject({ symbol: 'A', tone: 'loss', value: '-$100.00' });
    expect(holdingCards(rows, [quote('A', 100, 0), quote('B', 100, 0)])[1].metrics).toEqual([]);
    expect(holdingCards([rows[0]], [quote('A', 110, 0)])[1].metrics).toHaveLength(1);
    expect(holdingCards([], [])).toHaveLength(3);
  });

  it('calculates holdings totals, monetary best/worst, and largest position share', () => {
    const cards = holdingCards(holdings, [quote('AAPL', 120, 10), quote('TSLA', 90, 5)]);
    expect(cards).toHaveLength(3);
    expect(cards[0].text).toContain('$510.00');
    expect(cards[0].detail).toContain('+$10.00 (+2.0%)');
    expect(cards[1].text).toContain('Largest gain: AAPL +$40.00 (+20.0%)');
    expect(cards[1].text).toContain('Largest loss: TSLA -$30.00 (-10.0%)');
    expect(cards[2].text).toContain('TSLA');
    expect(cards[2].text).toContain('52.9%');
    expect(cards[0].detail).toContain('Shared cash is excluded');
    expect(cards[0].metrics?.map((metric) => metric.value)).toEqual([
      '$510.00',
      '+$10.00',
      '+2.0%',
    ]);
    expect(cards[2].metrics?.[0]).toMatchObject({ label: 'TSLA', value: '52.9%' });
    expect(cards[2].distribution?.reduce((sum, segment) => sum + segment.value, 0)).toBeCloseTo(
      100,
    );
  });

  it('uses total purchase cost rather than an average of position return percentages', () => {
    const rows = [
      { symbol: 'AAPL', quantity: 1, averageCost: 100 },
      { symbol: 'TSLA', quantity: 9, averageCost: 100 },
    ];
    expect(holdingCards(rows, [quote('AAPL', 200, 0), quote('TSLA', 100, 0)])[0].detail).toContain(
      '+10.0%',
    );
  });

  it('does not present partial totals or concentration as a complete account value', () => {
    const cards = holdingCards(holdings, [quote('AAPL', 120, 10)]);
    expect(cards[0].text).toContain('unavailable');
    expect(cards[0].text).not.toContain('$240.00');
    expect(cards[0].detail).toContain('unavailable');
    expect(cards[2].text).toContain('unavailable');
    expect(cards[1].detail).toContain('Some positions are unavailable');
    expect(holdingCards(holdings, [])[0].text).toContain('unavailable');
    expect(cards[0].metrics?.[0].value).toBe('Unavailable');
    expect(cards[2].metrics).toEqual([]);
    expect(cards[2].distribution).toBeUndefined();
  });

  it('handles empty holdings, zero quantities and invalid cost without fabricating returns', () => {
    expect(holdingCards([], [])[0].text).toContain('No holdings');
    expect(holdingCards([{ symbol: 'AAPL', averageCost: 100, quantity: 0 }], [])[0].text).toContain(
      'No holdings',
    );
    const cards = holdingCards(
      [{ symbol: 'AAPL', averageCost: 0, quantity: 2 }],
      [quote('AAPL', 20, 1)],
    );
    expect(cards[0].text).toContain('$40.00');
    expect(cards[0].detail).toContain('unavailable');
    expect(cards[1].text).toContain('unavailable');
    expect(cards[2].text).toContain('100.0%');
  });

  it('describes one owned stock and keeps day movement separate from purchase performance', () => {
    const cards = stockCards('TSLA', holdings, [quote('TSLA', 90, 5)], {
      title: 'Recent direction',
      text: 'Mixed.',
    });
    expect(cards).toHaveLength(3);
    expect(cards[0].text).toContain('up');
    expect(cards[0].detail).toContain('$90.00');
    expect(cards[2].text).toContain('3 shares');
    expect(cards[2].detail).toContain('Unrealized loss');
    expect(cards[2].detail).toContain('-10.0%');
    expect(stockCards('OTHER', holdings, [])[1].text).toContain('does not hold');
  });

  it('provides scoped factual explanations for each existing choice', () => {
    expect(DUA_EXPLANATIONS.daily.map((item) => item.term)).toContain('Illustrative daily review');
    expect(DUA_EXPLANATIONS.holdings.map((item) => item.term)).toContain(
      'Illustrative holdings examples',
    );
    expect(DUA_EXPLANATIONS.stock[1].description).toContain('do not predict');
  });

  it('describes rising, falling and mixed closes', () => {
    const result = (closes: number[]) =>
      directionCard('AAPL', candles(closes), '2026-01-05T15:05:00Z', 'America/Chicago');
    expect(result([100, 101, 102, 103, 104]).text).toContain('rose');
    expect(result([104, 103, 102, 101, 100]).text).toContain('fell');
    expect(result([100, 101, 101, 102, 103]).text).toContain('mixed');
    expect(result([100, 101, 102, 103, 104]).detail).toContain('+4.0%');
    expect(result([100, 101, 102, 103, 104]).sparkline).toEqual([100, 101, 102, 103, 104]);
  });
  it('plots observed prices without inventing history for flat or missing series', () => {
    expect(sparklinePoints([100, 110])).toBe('4.0,39.0 236.0,5.0');
    expect(sparklinePoints([100, 100])).toBe('4.0,22.0 236.0,22.0');
    expect(sparklinePoints([100])).toBe('');
    expect(sparklinePoints([100, NaN])).toBe('');
  });

  it('excludes unfinished and future candles and candles from another trading date', () => {
    expect(
      directionCard('AAPL', candles([1, 2, 3, 4, 5, 6]), '2026-01-05T15:04:30Z', 'America/Chicago')
        .text,
    ).toContain('Not enough');
    expect(
      directionCard('AAPL', candles([1, 2, 3, 4, 5]), '2026-01-06T15:05:00Z', 'America/Chicago')
        .text,
    ).toContain('Not enough');
    expect(
      directionCard(
        'AAPL',
        candles([1, 2, 3, 4, 5, 100]),
        '2026-01-05T15:05:00Z',
        'America/Chicago',
      ).detail,
    ).toContain('+400.0%');
  });
  it('summarizes only watchlist stocks without naming them', () => {
    const quotes = [quote('UP', 110, 10), quote('DOWN', 95, -5), quote('OTHER', 150, 50)];
    const card = watchlistPulse(['UP', 'DOWN', 'MISSING'], quotes);
    expect(card.title).toBe('Your watchlist since the open');
    expect(card.metrics?.map((m) => [m.label, m.value])).toEqual([
      ['Rising', '1'],
      ['Falling', '1'],
    ]);
    expect(card.text).toBe(
      'On average, your watchlist stocks moved +2.5% since the open. 2 of 3 have prices.',
    );
    expect(JSON.stringify(card)).not.toMatch(/"UP"|DOWN|OTHER/);
    expect(watchlistPulse(['UP'], quotes).takeaway).toBe('Most of your watchlist is rising.');
    expect(watchlistPulse(['DOWN'], quotes).takeaway).toBe('Most of your watchlist is falling.');
    expect(watchlistPulse(['FLAT'], [quote('FLAT', 100, 0)]).takeaway).toBe(
      'Your watchlist is unchanged since the open.',
    );
    expect(watchlistPulse(['MISSING'], quotes).takeaway).toBe('Watchlist prices are unavailable.');
    expect(watchlistPulse([], quotes).takeaway).toBe('Your watchlist is empty.');
    expect(watchlistPulse(null, quotes).takeaway).toBe('Your watchlist is unavailable.');
  });

  it('keeps a forecast record as a confidence score and how often it called', () => {
    expect(
      trendForecastRecord({
        call: 'down',
        signalHits: 12,
        signalCalls: 16,
        signalWeeks: 24,
      }),
    ).toEqual({
      hits: 12,
      total: 16,
      unit: 'calls',
      percent: 75,
      called: true,
      coverage: 'Called 16 of the last 24 weeks; it makes no call on weeks too weak to read.',
    });
    expect(
      trendForecastRecord({
        call: 'up',
        signalHits: 0,
        signalCalls: 0,
        signalWeeks: 3,
      }),
    ).toBeUndefined();
    const outlook = { modelHits: 15, modelDays: 20, ruleHits: 12, ruleDays: 20 };
    expect(outlookForecastRecord({ ...outlook, source: 'model' })).toEqual({
      hits: 15,
      total: 20,
      unit: 'weeks',
      percent: 75,
      called: true,
    });
    expect(outlookForecastRecord({ ...outlook, source: 'rule' })).toEqual({
      hits: 12,
      total: 20,
      unit: 'weeks',
      percent: 60,
      called: true,
    });
    expect(outlookForecastRecord({ ...outlook, modelDays: 0, source: 'model' })).toBeUndefined();
    expect(
      trendForecastRecord({
        call: null,
        signalHits: 8,
        signalCalls: 10,
        signalWeeks: 14,
      })?.called,
    ).toBe(false);
  });

  it('splits a takeaway around its coloured phrase, and leaves one without it whole', () => {
    expect(
      highlightParts({
        text: '',
        takeaway: 'Expect bigger price swings.',
        highlight: { text: 'bigger price swings', tone: 'more' },
      }),
    ).toEqual(['Expect ', 'bigger price swings', '.']);
    expect(highlightParts({ text: '', takeaway: 'Hold your current positions.' })).toBeNull();
    expect(
      highlightParts({
        text: '',
        takeaway: 'Volatility forecast unavailable.',
        highlight: { text: 'bigger price swings', tone: 'more' },
      }),
    ).toBeNull();
  });
});
