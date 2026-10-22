import { AccountHolding } from '../dashboard/accounts/account.models';
import { CandlePointDto } from '../dashboard/market-data.service';
import { Instrument } from '../dashboard/mock-data';

export type DuaChoice = 'daily' | 'holdings' | 'stock';
export interface DuaCard {
  symbol?: string;
  symbols?: string[];
  title?: string;
  takeaway?: string;
  purpose?: string;
  illustrative?: boolean;
  period?: string;
  metrics?: {
    symbol?: string;
    subtext?: string;
    stocks?: { symbol: string; change: string }[];
    label: string;
    value: string;
    tone?: 'gain' | 'loss';
    primary?: boolean;
  }[];
  sparkline?: number[];
  distribution?: { label: string; value: number; tone?: 'gain' | 'loss' }[];
  note?: string;
  text: string;
  detail?: string;
}

export function sparklinePoints(values: readonly number[]): string {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) {
    return '';
  }
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return values
    .map(
      (value, index) =>
        `${((index / (values.length - 1)) * 232 + 4).toFixed(1)},${(range ? 39 - ((value - min) / range) * 34 : 22).toFixed(1)}`,
    )
    .join(' ');
}

// Render plain text as safe text fragments; never interpret response content as HTML.
export function insightTextParts(text: string) {
  return text
    .split(/([+-]?\$[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\b)/g)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      emphasis: /^[+-]?(?:\$|\d)/.test(part),
      tone: part.startsWith('-') ? 'loss' : part.startsWith('+') ? 'gain' : 'neutral',
    }));
}

export function takeawayParts(text: string): { text: string; emphasis: boolean }[] {
  return text
    .split(
      /(\bUP\b|\bDOWN\b|[+-]?\$?[\d,]+(?:\.\d+)?%?|worth more|worth less|closed on a high note|benefited|Three key events|on the rise|heavily invested in tech|leading your portfolio[^!]*|accelerating|below industry valuation|one market|largest holding|strongest position|weakest position|missing[^.]*|unavailable|unchanged|flat)/gi,
    )
    .map((part, index) => ({ text: part, emphasis: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}

const isPositiveNumber = (value: number): boolean => Number.isFinite(value) && value > 0;

export function percentChange(price: number, baseline: number): number | null {
  return isPositiveNumber(price) && isPositiveNumber(baseline)
    ? ((price - baseline) / baseline) * 100
    : null;
}

export function dailyCard(stock: Instrument): DuaCard | null {
  const change = percentChange(stock.price, stock.price - stock.change);
  if (change === null) {
    return null;
  }
  return {
    symbol: stock.symbol,
    title: 'Today',
    takeaway:
      change > 0
        ? `Your stock is UP ${change.toFixed(1)}% today since open!`
        : change < 0
          ? `Your stock is DOWN ${Math.abs(change).toFixed(1)}% today since open.`
          : 'The price is flat since session open.',
    text: `${stock.symbol} is ${change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged at'} ${Math.abs(change).toFixed(1)}% since session open.`,
    detail: `Current price: ${money(stock.price)}.`,
    metrics: [
      { label: 'Since open', value: signedPercent(change), tone: tone(change), primary: true },
      { label: 'Price', value: money(stock.price) },
    ],
  };
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
const signedMoney = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`;
const tone = (value: number): 'gain' | 'loss' | undefined =>
  value > 0 ? 'gain' : value < 0 ? 'loss' : undefined;

function positions(holdings: readonly AccountHolding[], quotes: readonly Instrument[]) {
  return holdings
    .filter((h) => h.quantity !== 0)
    .map((h) => {
      const price = quotes.find((q) => q.symbol === h.symbol)?.price;
      const quantityValid = Number.isFinite(h.quantity) && h.quantity > 0;
      const rawValue = price !== undefined && price > 0 && quantityValid ? price * h.quantity : NaN;
      const rawCost = h.averageCost > 0 && quantityValid ? h.averageCost * h.quantity : NaN;
      const value = Number.isFinite(rawValue) ? rawValue : null;
      const cost = Number.isFinite(rawCost) ? rawCost : null;
      return { ...h, value, cost, gain: value !== null && cost !== null ? value - cost : null };
    });
}

function gainTakeaway(gain: number, cost: number): string {
  if (gain > 0) {
    return `Your holdings are UP ${signedMoney(gain)} (${signedPercent((gain / cost) * 100)}) since purchase. This gain is unrealized because you still hold the shares.`;
  }
  if (gain < 0) {
    return `Your holdings are DOWN ${Math.abs((gain / cost) * 100).toFixed(1)}% since purchase - ${money(Math.abs(gain))} below what you paid.`;
  }
  return 'Your holdings are at their purchase cost.';
}

export function holdingCards(
  holdings: readonly AccountHolding[],
  quotes: readonly Instrument[],
): DuaCard[] {
  const rows = positions(holdings, quotes);
  if (!rows.length) {
    return ['Portfolio snapshot', 'Performance drivers', 'Exposure'].map((title) => ({
      title,
      text: 'No holdings in this account to review yet.',
    }));
  }
  const completePrices = rows.every((p) => p.value !== null);
  const completeCosts = rows.every((p) => p.cost !== null);
  const total = rows.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const cost = rows.reduce((sum, p) => sum + (p.cost ?? 0), 0);
  const totalsValid = completePrices && Number.isFinite(total);
  const performanceValid = totalsValid && completeCosts && Number.isFinite(cost) && cost > 0;
  const gain = total - cost;
  const summary: DuaCard = {
    title: 'Portfolio snapshot',
    metrics: [
      {
        label: 'Holdings value',
        value: totalsValid ? money(total) : 'Unavailable',
        primary: totalsValid,
      },
      {
        label: 'Unrealized Gains',
        value: performanceValid ? signedMoney(gain) : 'Unavailable',
        tone: performanceValid ? tone(gain) : undefined,
      },
      {
        label: 'Since purchase',
        value: performanceValid ? signedPercent((gain / cost) * 100) : 'Unavailable',
        tone: performanceValid ? tone(gain) : undefined,
      },
    ],
    note: !performanceValid ? 'Some prices, quantities or purchase costs are missing.' : undefined,
    takeaway: performanceValid
      ? gainTakeaway(gain, cost)
      : totalsValid
        ? 'Current value is available, but gains need complete purchase costs.'
        : 'Some prices are missing, so the full picture is unavailable.',
    text: totalsValid
      ? `Holdings value: ${money(total)} across ${rows.length} position${rows.length === 1 ? '' : 's'}.`
      : 'Holdings value is unavailable: some positions lack valid market prices or quantities.',
    detail: performanceValid
      ? `Unrealized ${gain < 0 ? 'loss' : 'gain'}: ${signedMoney(gain)} (${signedPercent((gain / cost) * 100)}) versus total purchase cost. Shared cash is excluded.`
      : 'Unrealized performance is unavailable without valid prices and average purchase costs for every position. Shared cash is excluded.',
  };
  const ranked = rows
    .filter((p) => p.gain !== null)
    .sort((a, b) => b.gain! - a.gain! || a.symbol.localeCompare(b.symbol));
  const best = ranked.find((p) => p.gain! > 0);
  const worst = [...ranked]
    .sort((a, b) => a.gain! - b.gain! || a.symbol.localeCompare(b.symbol))
    .find((p) => p.gain! < 0);
  const extremes = [best, worst].filter((p): p is NonNullable<typeof p> => !!p);
  const performance: DuaCard = {
    title: 'Performance drivers',
    metrics: extremes.map((p) => ({
      symbol: p.symbol,
      label: `${p.gain! > 0 ? 'Largest gain' : 'Largest loss'}: ${p.symbol}`,
      value: signedMoney(p.gain!),
      subtext: signedPercent((p.gain! / p.cost!) * 100),
      tone: tone(p.gain!),
    })),
    note:
      ranked.length < rows.length ? 'Only positions with complete data are compared.' : undefined,
    takeaway: extremes.length
      ? `${extremes.map((p) => `${p.symbol} contributes your largest unrealized ${p.gain! > 0 ? 'gain' : 'loss'} at ${signedMoney(p.gain!)}`).join('; ')} since purchase.`
      : ranked.length
        ? 'Your available positions are at purchase cost. There are no unrealized gains or losses to rank.'
        : 'There is not enough data to compare your positions yet.',
    text: extremes.length
      ? extremes
          .map(
            (p) =>
              `${p.gain! > 0 ? 'Largest gain' : 'Largest loss'}: ${p.symbol} ${signedMoney(p.gain!)} (${signedPercent((p.gain! / p.cost!) * 100)}).`,
          )
          .join(' ')
      : ranked.length
        ? 'No unrealized gains or losses since purchase.'
        : 'Position performance is unavailable without valid prices and purchase costs.',
    detail:
      ranked.length < rows.length
        ? 'Some positions are unavailable; comparisons include only positions with valid prices and costs.'
        : 'Based on gains or losses on shares you still hold.',
    symbols: extremes.map((p) => p.symbol),
  };
  const largest = [...rows].sort(
    (a, b) => (b.value ?? 0) - (a.value ?? 0) || a.symbol.localeCompare(b.symbol),
  )[0];
  const concentration: DuaCard = {
    title: 'Exposure',
    distribution:
      totalsValid && total > 0
        ? [
            { label: largest.symbol, value: (largest.value! / total) * 100 },
            { label: 'Other holdings', value: Math.max(0, 100 - (largest.value! / total) * 100) },
          ]
        : undefined,
    metrics:
      totalsValid && total > 0
        ? [
            {
              symbol: largest.symbol,
              label: largest.symbol,
              value: `${((largest.value! / total) * 100).toFixed(1)}%`,
              primary: true,
            },
            { label: 'Position value', value: money(largest.value!) },
          ]
        : [],
    takeaway:
      totalsValid && total > 0
        ? `Your largest holding is ${largest.symbol} at ${((largest.value! / total) * 100).toFixed(1)}% of your holdings - its price moves have the biggest impact on this account.`
        : 'Complete prices are needed to see how your holdings are spread out.',
    text:
      totalsValid && total > 0
        ? `${largest.symbol} is the largest position: ${((largest.value! / total) * 100).toFixed(1)}% of this account's holdings value.`
        : 'Concentration is unavailable without complete market values for this account.',
    detail: 'This is a share of holdings value, excluding shared cash.',
    symbols: totalsValid && total > 0 ? [largest.symbol] : [],
  };
  return [summary, performance, concentration];
}

function marketTakeaway(up: number, down: number, validCount: number): string {
  if (!validCount) {
    return 'There is not enough price data for a market review yet.';
  }
  if (up > down) {
    return `${up} of ${validCount} tracked stocks are UP today. Gains are more widespread than declines.`;
  }
  if (down > up) {
    return `${down} of ${validCount} tracked stocks are DOWN today. Declines are more widespread than gains.`;
  }
  return up === 0
    ? `All ${validCount} tracked stocks with valid prices are unchanged since open.`
    : 'The tracked market is evenly split between rising and falling stocks since open.';
}

export function dailyReview(
  _holdings: readonly AccountHolding[],
  quotes: readonly Instrument[],
): DuaCard[] {
  const valid = quotes
    .filter((q) => dailyCard(q) !== null)
    .map((q) => ({ symbol: q.symbol, change: percentChange(q.price, q.price - q.change)! }));
  const gainers = valid
    .filter((q) => q.change > 0)
    .sort((a, b) => b.change - a.change || a.symbol.localeCompare(b.symbol));
  const losers = valid
    .filter((q) => q.change < 0)
    .sort((a, b) => a.change - b.change || a.symbol.localeCompare(b.symbol));
  const up = gainers.length;
  const down = losers.length;
  const coverage =
    valid.length < quotes.length
      ? `${valid.length} of ${quotes.length} tracked stocks have valid opening prices.`
      : undefined;
  const moverText = [
    gainers[0] ? `${gainers[0].symbol} leads gains at ${signedPercent(gainers[0].change)}` : '',
    losers[0]
      ? `${losers[0].symbol} has the largest decline at ${signedPercent(losers[0].change)}`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
  const groups = [
    { label: 'Gainers', tone: 'gain' as const, rows: gainers.slice(0, 2) },
    { label: 'Losers', tone: 'loss' as const, rows: losers.slice(0, 2) },
  ];
  return [
    {
      title: 'Market pulse',
      metrics: valid.length
        ? [
            { label: 'Up', value: String(up), tone: 'gain' },
            { label: 'Down', value: String(down), tone: 'loss' },
          ]
        : [],
      takeaway: marketTakeaway(up, down, valid.length),
      text: valid.length
        ? `${up} up, ${down} down since open.`
        : 'Tracked market movement is unavailable without valid opening prices.',
      note: coverage,
      detail: `${valid.length} of ${quotes.length} tracked stocks available; not the entire market.`,
    },
    {
      title: 'Standout movers',
      metrics: groups
        .filter((group) => group.rows.length)
        .map((group) => ({
          label: group.label,
          value: signedPercent(group.rows[0].change),
          tone: group.tone,
          stocks: group.rows.map((row) => ({
            symbol: row.symbol,
            change: signedPercent(row.change),
          })),
        })),
      takeaway: !valid.length
        ? 'Missing prices prevent a comparison right now.'
        : moverText
          ? `${moverText} since open.`
          : 'All available tracked stocks are unchanged since open. There are no gainers or losers to rank.',
      text: moverText ? `${moverText} since open.` : 'No moving stocks are available to rank.',
      symbols: groups.flatMap((group) => group.rows.map((row) => row.symbol)),
      note: coverage,
    },
  ];
}

export function stockCards(
  symbol: string,
  holdings: readonly AccountHolding[],
  quotes: readonly Instrument[],
  direction?: DuaCard,
): DuaCard[] {
  const quote = quotes.find((q) => q.symbol === symbol);
  const today = quote ? dailyCard(quote) : null;
  const position = positions(holdings, quotes).find((p) => p.symbol === symbol);
  const owned: DuaCard = !position
    ? {
        title: 'Your position',
        takeaway: "You don't hold this stock in this account.",
        text: `This account does not hold ${symbol}.`,
      }
    : {
        title: 'Your position',
        metrics: [
          {
            label: 'Shares',
            value: Number.isFinite(position.quantity) ? String(position.quantity) : 'Unavailable',
          },
          {
            label: 'Average cost',
            value: position.cost !== null ? money(position.averageCost) : 'Unavailable',
          },
          {
            label: 'Unrealized',
            value:
              position.gain !== null
                ? `${signedMoney(position.gain)} (${signedPercent((position.gain / position.cost!) * 100)})`
                : 'Unavailable',
            tone: position.gain !== null ? tone(position.gain) : undefined,
          },
        ],
        takeaway:
          position.gain === null
            ? 'A few missing numbers prevent a full performance summary.'
            : position.gain > 0
              ? `Your ${symbol} holding is UP ${signedMoney(position.gain)} since purchase!`
              : position.gain < 0
                ? `Your ${symbol} holding is DOWN ${money(Math.abs(position.gain))} since purchase.`
                : 'Your position is at its purchase cost.',
        text: `${symbol}: ${Number.isFinite(position.quantity) ? position.quantity : 'Unavailable'} shares. Average purchase cost: ${Number.isFinite(position.averageCost) && position.averageCost > 0 ? money(position.averageCost) : 'unavailable'}.`,
        detail:
          position.gain !== null
            ? `Unrealized ${position.gain < 0 ? 'loss' : 'gain'}: ${signedMoney(position.gain)} (${signedPercent((position.gain / position.cost!) * 100)} versus purchase cost).`
            : 'Unrealized performance is unavailable without a valid market price and purchase cost.',
      };
  return [
    today ?? {
      title: 'Today',
      note: 'Movement since open is unavailable.',
      text:
        quote && Number.isFinite(quote.price) && quote.price > 0
          ? `${symbol} current price: ${money(quote.price)}.`
          : `Current price for ${symbol} is unavailable.`,
      detail: 'Movement since session open is unavailable.',
    },
    ...(direction ? [direction] : []),
    owned,
  ].map((card) => ({
    ...card,
    purpose:
      card.title === 'Today'
        ? "Compare the current price with the session opening price. This is today's price movement, not your return since purchase."
        : card.title === 'Recent direction'
          ? 'See how the last five completed one-minute candles moved. This short interval does not predict the next move.'
          : 'Compare shares you still own with what you paid. Gains and losses remain unrealized until you sell.',
  }));
}

export function dailyPreviewCards(): DuaCard[] {
  return [
    {
      title: 'Market overview',
      illustrative: true,
      period: 'Today',
      metrics: [{ label: 'S&P 500 daily return', value: '+1.8%', tone: 'gain', primary: true }],
      takeaway: 'The market closed on a high note!',
      purpose:
        'The S&P 500 rose 1.8% as technology stocks rallied, supported by strong earnings and renewed investor optimism.',
      text: 'Illustrative market review: S&P 500 +1.8%.',
    },
    {
      title: 'Portfolio impact',
      illustrative: true,
      period: 'Today',
      metrics: [{ label: 'Portfolio gain today', value: '$385', tone: 'gain', primary: true }],
      takeaway: "Your holdings benefited from today's rally.",
      purpose:
        'Your portfolio gained $385 today, with NVIDIA contributing $210 as semiconductor stocks outperformed the broader market.',
      text: 'Illustrative portfolio impact: $385, including $210 from NVIDIA.',
    },
    {
      title: "Tomorrow's outlook",
      illustrative: true,
      period: 'Up Next',
      metrics: [{ label: 'Key events tomorrow', value: '3', primary: true }],
      takeaway: 'Three key events could move markets tomorrow.',
      purpose:
        'Two major earnings reports and an inflation release are scheduled, potentially bringing higher volatility to technology and consumer stocks.',
      text: 'Illustrative outlook: two earnings reports and one inflation release.',
    },
  ];
}

export function holdingsPreviewCards(): DuaCard[] {
  return [
    {
      title: 'Portfolio growth',
      illustrative: true,
      period: 'This Month',
      metrics: [{ label: 'Portfolio growth', value: '+12.4%', tone: 'gain', primary: true }],
      takeaway: 'Your portfolio is on the rise!',
      purpose:
        'Your holdings gained $2,450 this month, with NVIDIA and Apple driving most of your growth.',
      text: 'Illustrative monthly portfolio growth: +12.4%, or $2,450.',
    },
    {
      title: 'Sector concentration',
      illustrative: true,
      period: 'Current',
      metrics: [{ label: 'Technology allocation', value: '68%', primary: true }],
      takeaway: 'Your portfolio is heavily invested in tech.',
      purpose:
        'Technology stocks make up 68% of your holdings. A downturn in this sector could have a significant impact on your portfolio.',
      text: 'Illustrative technology sector concentration: 68%.',
    },
    {
      title: 'Top performer',
      illustrative: true,
      period: 'This Month',
      metrics: [{ label: 'NVIDIA monthly return', value: '+32.8%', tone: 'gain', primary: true }],
      takeaway: "NVIDIA is leading your portfolio's gains!",
      purpose:
        "NVIDIA is your best-performing holding this month, climbing 32.8% and contributing $1,280 to your portfolio's gains.",
      text: 'Illustrative NVIDIA monthly return: +32.8%, contributing $1,280.',
    },
  ];
}

export function stockPreviewCards(): DuaCard[] {
  return [
    {
      title: 'Growth insight',
      illustrative: true,
      metrics: [
        { label: 'Year-over-year revenue growth', value: '+24.8%', tone: 'gain', primary: true },
      ],
      takeaway: 'Revenue growth is accelerating.',
      purpose:
        'In this example, revenue grew 24.8% year over year, illustrating stronger demand and business expansion.',
      text: 'Illustrative revenue growth: +24.8%.',
    },
    {
      title: 'Valuation insight',
      illustrative: true,
      metrics: [
        { label: 'P/E versus industry average', value: '-18%', tone: 'loss', primary: true },
      ],
      takeaway: 'Trading below industry valuation.',
      purpose:
        'In this example, the P/E ratio is 18% below the industry average. A lower multiple can reflect different growth expectations or risks, not necessarily a bargain.',
      text: 'Illustrative P/E discount: -18%.',
    },
    {
      title: 'Risk insight',
      illustrative: true,
      metrics: [{ label: 'Revenue from one geographic market', value: '65%', primary: true }],
      takeaway: 'Revenue depends on one market.',
      purpose:
        'In this example, 65% of revenue comes from one geographic market, increasing exposure to regional economic and regulatory changes.',
      text: 'Illustrative geographic revenue concentration: 65%.',
    },
  ];
}

export const DUA_EXPLANATIONS: Record<DuaChoice, readonly { term: string; description: string }[]> =
  {
    daily: [
      {
        term: 'Illustrative daily review',
        description:
          "All figures and events on these cards are illustrative examples, not today's actual market data. The portfolio impact is not calculated from your account. No actual earnings or inflation-release schedule is being shown.",
      },
      {
        term: 'Understanding the review',
        description:
          "Market Overview demonstrates a market-day summary, Portfolio Impact demonstrates how holdings could contribute to a daily result, and Tomorrow's Outlook demonstrates an upcoming-event summary. These placeholders are not forecasts or trade recommendations.",
      },
    ],
    holdings: [
      {
        term: 'Illustrative holdings examples',
        description:
          'These placeholder figures demonstrate Portfolio Growth, Sector Concentration and Top Performer cards. They are not calculated from your account, trades or actual monthly performance.',
      },
      {
        term: 'Understanding the signals',
        description:
          "Portfolio growth describes a change over a month, sector concentration shows the share invested in one sector, and top performer highlights a holding's monthly return and contribution. The examples use fictional figures and do not predict future returns.",
      },
    ],
    stock: [
      {
        term: 'Illustrative preview',
        description:
          'These example figures demonstrate a future Growth, Valuation and Risk experience. They are not figures for the selected stock and do not come from its financial statements.',
      },
      {
        term: 'Understanding the signals',
        description:
          'Growth compares revenue with the prior year. Valuation compares P/E with an industry average; a discount alone does not prove a bargain. Risk shows geographic revenue concentration. These examples do not predict returns or recommend a trade.',
      },
    ],
  };

// 1D candles are one-minute buckets. A candle is complete only after its full minute.
export function directionCard(
  symbol: string,
  points: readonly CandlePointDto[],
  cursor: string,
  timezone: string,
): DuaCard {
  const at = Date.parse(cursor);
  const date = (time: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(time);
  const isCompleteToday = (p: CandlePointDto): boolean => {
    const opened = Date.parse(p.timestamp);
    return (
      Number.isFinite(opened) &&
      opened + 60_000 <= at &&
      date(opened) === date(at) &&
      isPositiveNumber(p.close)
    );
  };
  const completed = points
    .filter(isCompleteToday)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-5);
  if (completed.length < 5) {
    return {
      symbol,
      title: 'Recent direction',
      takeaway: 'A little more completed price history is needed.',
      text: 'Not enough completed candles to describe recent direction.',
    };
  }
  const rising = completed.slice(1).every((p, i) => p.close > completed[i].close);
  const falling = completed.slice(1).every((p, i) => p.close < completed[i].close);
  const change = percentChange(completed[4].close, completed[0].close)!;
  const time = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(value));
  return {
    symbol,
    title: 'Recent direction',
    metrics: [
      {
        label: 'Change over 5 candles',
        value: signedPercent(change),
        tone: tone(change),
        primary: true,
      },
    ],
    sparkline: completed.map((point) => point.close),
    note: `${time(new Date(Date.parse(completed[0].timestamp) + 60_000).toISOString())} to ${time(new Date(Date.parse(completed[4].timestamp) + 60_000).toISOString())}`,
    takeaway: rising
      ? `${symbol} is UP ${Math.abs(change).toFixed(1)}% across the last five completed candles - each close was higher.`
      : falling
        ? `${symbol} is DOWN ${Math.abs(change).toFixed(1)}% across the last five completed candles - each close was lower.`
        : 'Recent closes do not show a consistent rise or fall.',
    text: `${symbol} ${rising ? 'rose' : falling ? 'fell' : 'had mixed movement'} across the last 5 completed candles.`,
    detail: `${time(new Date(Date.parse(completed[0].timestamp) + 60_000).toISOString())} to ${time(new Date(Date.parse(completed[4].timestamp) + 60_000).toISOString())}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}% from first close to last.`,
  };
}
