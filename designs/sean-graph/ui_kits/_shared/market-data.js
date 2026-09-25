// Mock market + account data shared by the UI kits. Instruments and transactions mirror
// apps/client-ui/src/app/dashboard/mock-data.ts; the rest is illustrative.
(function () {
  const INSTRUMENTS = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 316.59, change: 15.65, changePercent: 5.2 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 512.3, change: 6.12, changePercent: 1.21 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 184.77, change: -3.41, changePercent: -1.81 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 231.05, change: 2.88, changePercent: 1.26 },
    { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', price: 208.44, change: -1.02, changePercent: -0.49 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 347.12, change: 12.4, changePercent: 3.7 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', price: 741.9, change: -9.33, changePercent: -1.24 },
    { symbol: 'SPCX', name: 'Space Exploration Holdings', price: 127.43, change: 6.3, changePercent: 5.2 },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 289.61, change: 0.84, changePercent: 0.29 },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: 648.2, change: 3.15, changePercent: 0.49 },
  ];
  const TRANSACTIONS = [
    { kind: 'trade', symbol: 'TSLA', side: 'buy', shares: 1, price: 301.8, date: 'Sep 12' },
    { kind: 'cash', reason: 'DEPOSIT', value: 2500, date: 'Sep 11' },
    { kind: 'trade', symbol: 'SPY', side: 'buy', shares: 3, price: 610.5, date: 'Sep 10' },
    { kind: 'trade', symbol: 'META', side: 'sell', shares: 2, price: 752.1, date: 'Sep 8' },
    { kind: 'trade', symbol: 'MSFT', side: 'buy', shares: 2, price: 455.0, date: 'Sep 3' },
    { kind: 'cash', reason: 'WITHDRAWAL', value: 800, date: 'Aug 30' },
    { kind: 'trade', symbol: 'NVDA', side: 'buy', shares: 10, price: 190.25, date: 'Aug 28' },
    { kind: 'trade', symbol: 'AAPL', side: 'buy', shares: 4, price: 280.1, date: 'Aug 21' },
  ];
  const POSITIONS = { AAPL: { shares: 4, cost: 280.1 }, NVDA: { shares: 10, cost: 190.25 }, MSFT: { shares: 2, cost: 455.0 }, SPY: { shares: 3, cost: 610.5 }, TSLA: { shares: 1, cost: 301.8 } };
  const ACCOUNTS = [{ id: 1, name: 'Growth' }, { id: 2, name: 'Retirement' }];

  function series(seed, count, endValue) {
    let s = 0;
    for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const w = []; let v = 100;
    for (let i = 0; i < count; i++) { s = (s * 1664525 + 1013904223) >>> 0; v += ((s / 2 ** 32 - 0.45) * 20) / Math.sqrt(count); w.push(v); }
    const k = endValue / w[w.length - 1];
    return w.map((x) => x * k);
  }
  function candles(seed, count, endClose) {
    const closes = series(seed, count + 1, endClose);
    let s = 7;
    for (const ch of seed) s = (s * 17 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    return closes.slice(1).map((c, i) => {
      const o = closes[i];
      const hi = Math.max(o, c) * (1 + rnd() * 0.006), lo = Math.min(o, c) * (1 - rnd() * 0.006);
      return { open: o, high: hi, low: lo, close: c, volume: Math.round(400000 + rnd() * 1600000) };
    });
  }
  const LABELS = {
    '1D': ['9:30 AM', '11:00 AM', '12:30 PM', '2:00 PM', '3:30 PM'],
    '5D': ['Mon 8', 'Tue 9', 'Wed 10', 'Thu 11', 'Fri 12'],
    '1M': ['Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 14'],
    '1Y': ["Oct '25", "Jan '26", "Apr '26", "Jul '26", "Sep '26"],
  };
  const COUNTS = { '1D': 27, '5D': 35, '1M': 22, '1Y': 53 };
  const money = (v, d = 2) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  const find = (sym) => INSTRUMENTS.find((i) => i.symbol === sym);

  window.TSData = { INSTRUMENTS, TRANSACTIONS, POSITIONS, ACCOUNTS, series, candles, LABELS, COUNTS, money, pct, find };
})();
