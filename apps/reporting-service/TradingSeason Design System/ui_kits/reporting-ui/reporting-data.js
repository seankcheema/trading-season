// Mock reporting data shaped after the business schema (users, accounts, orders, fills, cash_transactions, audit_trail).
(function () {
  const USERS = [
    { id: 'u-7f3a', name: 'Sean Cheema', initials: 'SC', email: 'sean@example.com', role: 'TRADER', status: 'ACTIVE', level: 'Advanced', failed: 0, locked: null, accounts: 2, cash: 4820.55, portfolio: 28985.08, last: '3:44 PM' },
    { id: 'u-12bd', name: 'Jane Doe', initials: 'JD', email: 'jane.doe@example.com', role: 'TRADER', status: 'LOCKED', level: 'Beginner', failed: 5, locked: 'Sep 14, 4:15 PM', accounts: 1, cash: 5000.0, portfolio: 0, last: '3:30 PM' },
    { id: 'u-9c01', name: 'Marcus Lee', initials: 'ML', email: 'marcus.lee@example.com', role: 'TRADER', status: 'ACTIVE', level: 'Intermediate', failed: 1, locked: null, accounts: 3, cash: 12040.1, portfolio: 64210.77, last: '3:41 PM' },
    { id: 'u-44e8', name: 'Priya Natarajan', initials: 'PN', email: 'priya.n@example.com', role: 'TRADER', status: 'ACTIVE', level: 'Advanced', failed: 0, locked: null, accounts: 2, cash: 880.42, portfolio: 118402.5, last: '3:39 PM' },
    { id: 'u-0a77', name: 'Tom Alvarez', initials: 'TA', email: 'tom.alvarez@example.com', role: 'TRADER', status: 'SUSPENDED', level: 'Beginner', failed: 0, locked: null, accounts: 1, cash: 0, portfolio: 0, last: 'Sep 9' },
    { id: 'u-3b5f', name: 'Ada Brooks', initials: 'AB', email: 'ada.brooks@example.com', role: 'ADMIN', status: 'ACTIVE', level: '—', failed: 0, locked: null, accounts: 0, cash: 0, portfolio: 0, last: '3:12 PM' },
  ];
  const ORDERS = [
    { id: 10482, ref: '9f1c…a2e4', time: '3:44:12 PM', user: 'Sean Cheema', account: 'Growth', symbol: 'AAPL', side: 'buy', type: 'MARKET', qty: 4, price: 316.59, status: 'FILLED' },
    { id: 10481, ref: '7b20…11fd', time: '3:43:58 PM', user: 'Priya Natarajan', account: 'Core', symbol: 'NVDA', side: 'sell', type: 'MARKET', qty: 25, price: 184.77, status: 'FILLED' },
    { id: 10480, ref: 'c3e9…04b1', time: '3:42:31 PM', user: 'Marcus Lee', account: 'Swing', symbol: 'TSLA', side: 'buy', type: 'MARKET', qty: 40, price: null, status: 'REJECTED', reason: 'Insufficient cash' },
    { id: 10479, ref: '2d88…9c7a', time: '3:41:05 PM', user: 'Marcus Lee', account: 'Income', symbol: 'SPY', side: 'buy', type: 'MARKET', qty: 6, price: 648.2, status: 'FILLED' },
    { id: 10478, ref: 'e6a1…53d0', time: '3:39:47 PM', user: 'Priya Natarajan', account: 'Core', symbol: 'META', side: 'buy', type: 'MARKET', qty: 3, price: null, status: 'PENDING' },
    { id: 10477, ref: '51f4…aa19', time: '3:37:20 PM', user: 'Sean Cheema', account: 'Retirement', symbol: 'MSFT', side: 'buy', type: 'MARKET', qty: 2, price: 512.3, status: 'FILLED' },
    { id: 10476, ref: '0c6b…e8f2', time: '3:35:02 PM', user: 'Marcus Lee', account: 'Swing', symbol: 'AMZN', side: 'sell', type: 'MARKET', qty: 10, price: null, status: 'CANCELLED' },
    { id: 10475, ref: 'a9d3…7710', time: '3:31:44 PM', user: 'Priya Natarajan', account: 'Core', symbol: 'GOOGL', side: 'sell', type: 'MARKET', qty: 12, price: 208.44, status: 'FILLED' },
  ];
  const AUDIT = {
    10482: [['ORDER_RECEIVED', '3:44:12.084 PM'], ['VALIDATED', '3:44:12.091 PM'], ['QUOTE_LOCKED', '3:44:12.102 PM'], ['FILLED', '3:44:12.118 PM'], ['HOLDINGS_UPDATED', '3:44:12.121 PM']],
    10480: [['ORDER_RECEIVED', '3:42:31.402 PM'], ['VALIDATION_FAILED', '3:42:31.410 PM · Insufficient cash'], ['REJECTED', '3:42:31.411 PM']],
    10478: [['ORDER_RECEIVED', '3:39:47.220 PM'], ['VALIDATED', '3:39:47.231 PM'], ['AWAITING_QUOTE', '3:39:47.240 PM']],
    10476: [['ORDER_RECEIVED', '3:35:02.019 PM'], ['VALIDATED', '3:35:02.027 PM'], ['CANCELLED', '3:35:09.550 PM · by user']],
  };
  const FEED = [
    { t: '3:44 PM', kind: 'fill', text: 'Sean Cheema bought 4 AAPL', v: '$1,266.36' },
    { t: '3:43 PM', kind: 'fill', text: 'Priya Natarajan sold 25 NVDA', v: '$4,619.25' },
    { t: '3:42 PM', kind: 'reject', text: 'Order #10480 rejected — insufficient cash', v: 'TSLA' },
    { t: '3:40 PM', kind: 'cash', text: 'Marcus Lee deposited cash', v: '+$2,500.00' },
    { t: '3:30 PM', kind: 'lock', text: 'Jane Doe locked after 5 failed sign-ins', v: 'Security' },
    { t: '3:12 PM', kind: 'cash', text: 'Priya Natarajan withdrew cash', v: '-$800.00' },
  ];
  const STATUS = [['FILLED', 1284, 'gain'], ['PENDING', 42, 'primary'], ['REJECTED', 67, 'loss'], ['CANCELLED', 31, 'muted']];
  const TOP = [['NVDA', 312, 1840220], ['AAPL', 268, 1210450], ['TSLA', 201, 902118], ['SPY', 164, 1402800], ['MSFT', 120, 688010]];
  window.TSReport = { USERS, ORDERS, AUDIT, FEED, STATUS, TOP };
})();
