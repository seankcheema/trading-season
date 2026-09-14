# Reporting UI Mockup Guide

## Design System

### Color Palette
- **Primary:** `#2563EB` (Blue) — CTAs, active states
- **Success:** `#10B981` (Green) — Positive metrics, winning trades
- **Danger:** `#EF4444` (Red) — Negative metrics, losing trades
- **Warning:** `#F59E0B` (Amber) — Alerts, warnings
- **Neutral:** `#6B7280` (Gray) — Text, borders, backgrounds

### Typography
- **Headline 1:** 32px, Bold, Color: Gray-900
- **Headline 2:** 24px, Semibold, Color: Gray-800
- **Headline 3:** 20px, Semibold, Color: Gray-800
- **Body:** 14px, Regular, Color: Gray-700
- **Caption:** 12px, Regular, Color: Gray-500

---

## Page Layouts

### 1. Dashboard Overview

**Path:** `/reporting/dashboard`

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD                   [Date Range Selector] [Export] │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  KPI CARDS (4-column grid)                                  │
├──────────────────────────────────────────────────────────────┤

┌─────────────────────┬──────────────────┬──────────────────────┐
│  TOTAL RETURN       │ SHARPE RATIO     │ MAX DRAWDOWN        │
│  ┌─────────────────┐│┌────────────────┐│┌────────────────────┐│
│  │ +15.24%         ││  1.85           ││ -8.32%             ││
│  │ ↑ 2.14% vs prev ││ ↑ 0.21 vs prev  ││ ↓ 1.23% vs prev    ││
│  └─────────────────┘│└────────────────┘│└────────────────────┘│
└─────────────────────┴──────────────────┴──────────────────────┘

┌─────────────────────┐
│ WIN RATE            │
│┌───────────────────┐│
││ ██████████░░░░░░░ ││
││ 64.5%             ││
│└───────────────────┘│
└─────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PERFORMANCE CHART (Line Chart)                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                                                      ╱    ││
│  │                                              ╱            ││
│  │                                      ╱                    ││
│  │                          ╱────                            ││
│  │              ╱───╲                                        ││
│  │         ╱──╲                                              ││
│  │    ╱                                                      ││
│  │___________________________________________________         ││
│  │ Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep              ││
│  └──────────────────────────────────────────────────────────┘│
│  Legend: Portfolio Value    Benchmark (SPX)                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  RECENT TRADES                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Date       | Instrument | Qty   | Entry  | Exit  | P&L   ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 09/09/26   | AAPL       | 100   | 228.50 | 230.12| +162  ││
│  │ 09/08/26   | MSFT       | 50    | 425.00 | 424.50|-25    ││
│  │ 09/08/26   | GOOGL      | 200   | 142.30 | 143.00|+140   ││
│  │ [View All]                                                ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 2. Performance Report

**Path:** `/reporting/performance`

```
┌─────────────────────────────────────────────────────────────┐
│  PERFORMANCE REPORT          [Date Range] [Export PDF/Excel] │
└─────────────────────────────────────────────────────────────┘

TAB NAVIGATION:
[Summary] [Returns] [Risk] [Trades] [Holdings]

SUMMARY TAB:
┌──────────────────────────────────────────────────────────────┐
│  PERFORMANCE METRICS                                         │
├──────────────────────────────────────────────────────────────┤
│  Metric                    │ Value      │ Target   │ Status   │
├──────────────────────────────────────────────────────────────┤
│  Total Return              │ +15.24%    │ +12.00%  │ ✓ PASS   │
│  YTD Return                │ +18.50%    │ +15.00%  │ ✓ PASS   │
│  Sharpe Ratio              │ 1.85       │ 1.50     │ ✓ PASS   │
│  Sortino Ratio             │ 2.42       │ 2.00     │ ✓ PASS   │
│  Max Drawdown              │ -8.32%     │ -15.00%  │ ✓ PASS   │
│  Win Rate                  │ 64.5%      │ 55.00%   │ ✓ PASS   │
│  Profit Factor             │ 2.15       │ 1.50     │ ✓ PASS   │
│  Avg Trade Return          │ +$1,250    │ +$1,000  │ ✓ PASS   │
└──────────────────────────────────────────────────────────────┘

RETURNS TAB:
┌─────────────────────────┬────────────────────────────┐
│  CUMULATIVE RETURNS     │  MONTHLY RETURNS           │
│  ┌───────────────────┐  │  ┌────────────────────────┐│
│  │                 ╱ │  │  │ Sep: +3.24%            ││
│  │            ╱───  │  │  │ Aug: +2.15%            ││
│  │       ╱─────      │  │  │ Jul: -1.45%            ││
│  │    ╱──            │  │  │ Jun: +4.32%            ││
│  │ ╱                 │  │  │ May: +2.87%            ││
│  │___________________│  │  │ Apr: +1.56%            ││
│  └───────────────────┘  │  └────────────────────────┘│
└─────────────────────────┴────────────────────────────┘

RISK TAB:
┌──────────────────────────────────────────────────────────────┐
│  RISK METRICS                                                │
├──────────────────────────────────────────────────────────────┤
│  Value at Risk (95%)       │ -$12,456                        │
│  Conditional VaR (95%)     │ -$15,234                        │
│  Beta                      │ 0.85                            │
│  Correlation to Market     │ 0.72                            │
│  Portfolio Concentration   │ 12.34%                          │
│  Leverage Ratio            │ 1.25x                           │
│  Volatility (Annualized)   │ 18.45%                          │
└──────────────────────────────────────────────────────────────┘
```

### 3. Trade Analytics

**Path:** `/reporting/analytics`

```
┌─────────────────────────────────────────────────────────────┐
│  TRADE ANALYTICS            [Filters] [Export CSV/Excel]     │
└─────────────────────────────────────────────────────────────┘

FILTER BAR:
[Instrument: All ▼] [Status: All ▼] [Min P&L: $__] [Max P&L: $__]

┌──────────────────────────────────────────────────────────────┐
│  TRADE SUMMARY BY INSTRUMENT                                 │
├──────────────────────────────────────────────────────────────┤
│ Instrument | Trades | Win Rate | Profit Factor | Total P&L   │
├──────────────────────────────────────────────────────────────┤
│ AAPL       │ 45     │ 68.9%    │ 2.34          │ +$8,450     │
│ MSFT       │ 38     │ 60.5%    │ 1.92          │ +$5,320     │
│ GOOGL      │ 32     │ 59.4%    │ 1.78          │ +$3,850     │
│ TSLA       │ 28     │ 57.1%    │ 1.45          │ +$2,100     │
│ AMZN       │ 22     │ 50.0%    │ 0.95          │ -$1,200     │
│ TOTAL      │ 165    │ 61.2%    │ 1.88          │ +$18,520    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  DETAILED TRADE LIST (with pagination)                       │
├──────────────────────────────────────────────────────────────┤
│ Date       │ Inst  │ Side │ Qty │ Entry  │ Exit  │ P&L   │ Hrs │
├──────────────────────────────────────────────────────────────┤
│ 09/09/26   │ AAPL  │ BUY  │ 100 │ 228.50 │ 230.12│+162   │ 2.5 │
│ 09/08/26   │ MSFT  │ SELL │ 50  │ 425.00 │ 424.50│-25    │ 1.2 │
│ 09/08/26   │ GOOGL │ BUY  │ 200 │ 142.30 │ 143.00│+140   │ 0.8 │
│ 09/07/26   │ TSLA  │ BUY  │ 75  │ 245.60 │ 248.90│+248   │ 3.1 │
│ [Show 46-50 of 165]                                          │
└──────────────────────────────────────────────────────────────┘
```

### 4. Risk Dashboard

**Path:** `/reporting/risk`

```
┌─────────────────────────────────────────────────────────────┐
│  RISK DASHBOARD                        [Date] [Market Data]  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PORTFOLIO CONCENTRATION HEATMAP                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Sector Distribution          │ Top 10 Holdings           ││
│  │ ┌─────────┐                  │ ┌─────────────────────────┐││
│  │ │ Tech    │ 35.2%            │ 1. AAPL    12.34%       │││
│  │ │ Finance │ 22.1%            │ 2. MSFT     9.87%       │││
│  │ │ Health  │ 18.5%            │ 3. GOOGL    8.45%       │││
│  │ │ Energy  │  9.2%            │ 4. AMZN     7.23%       │││
│  │ │ Other   │ 15.0%            │ 5. TSLA     6.12%       │││
│  │ └─────────┘                  │ [... 5 more]            │││
│  │                              │ └─────────────────────────┘││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  DRAWDOWN HISTORY                                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │       ░░░░░░░░░░░░░░░░░░░░░░░░░                         ││
│  │      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                      ││
│  │    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                  ││
│  │ 0% ┼─────────────────────────────────────────────────── ││
│  │    │                                                     ││
│  │ -5%│                                                     ││
│  │    │                                                     ││
│  │-10%│                                                     ││
│  │  └──────────────────────────────────────────────────────┘│
│  │  Current Drawdown: -4.56%    Max Drawdown: -12.34%       │
│  └──────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  RISK METRICS SUMMARY                                        │
├──────────────────────────────────────────────────────────────┤
│  VaR (95%, 1-day)        │ -$12,456  │ Daily risk limit     │
│  Expected Shortfall      │ -$15,234  │ Average of tail risks│
│  Beta to Market          │ 0.85      │ 15% less volatile    │
│  Volatility (Annual)     │ 18.45%    │ Within target        │
│  Leverage Ratio          │ 1.25x     │ Within limits        │
└──────────────────────────────────────────────────────────────┘
```

### 5. Audit Trail

**Path:** `/reporting/audit`

```
┌─────────────────────────────────────────────────────────────┐
│  AUDIT TRAIL                    [Search] [Date Range] [Export]│
└─────────────────────────────────────────────────────────────┘

SEARCH & FILTER:
[Search by Order ID, Ticker, User...] [Filter by Event Type: All ▼]

┌──────────────────────────────────────────────────────────────┐
│  EVENT LOG                                                   │
├──────────────────────────────────────────────────────────────┤
│ Timestamp  │ Event Type │ Order ID │ Details                │
├──────────────────────────────────────────────────────────────┤
│ 09/09 3:42 │ ORDER_SUB  │ ORD-5823 │ BUY 100 AAPL @ 228.50  │
│ 09/09 3:43 │ ORDER_ACC  │ ORD-5823 │ Order accepted         │
│ 09/09 3:45 │ FILL       │ ORD-5823 │ Filled @ 229.12, +$62  │
│ 09/09 3:45 │ CASH_TXRX  │ CA-2154  │ -$22,912 for fill      │
│ 09/09 3:45 │ HOLD_MOVE  │ HM-4521  │ +100 AAPL              │
│ 09/09 3:47 │ ORDER_SUB  │ ORD-5824 │ SELL 50 MSFT @ 425.00  │
│ 09/09 3:48 │ ORDER_REJ  │ ORD-5824 │ Insufficient margin    │
│ 09/09 3:50 │ ORDER_SUB  │ ORD-5825 │ SELL 50 MSFT @ 425.00  │
│ [Show 9-16 of 2,847]                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Library

### 1. Metric Card

```html
<app-metric-card
  [label]="'Total Return'"
  [value]="'+15.24%'"
  [trend]="+2.14%"
  [trendUp]="true"
  [color]="'success'"
></app-metric-card>
```

### 2. Performance Chart

```html
<app-performance-chart
  [data]="equityCurveData"
  [benchmarkData]="benchmarkData"
  [showBenchmark]="true"
  [height]="400"
></app-performance-chart>
```

### 3. Data Table

```html
<app-data-table
  [columns]="tableColumns"
  [rows]="tableData"
  [sortable]="true"
  [filterable]="true"
  [pageable]="true"
  [pageSize]="50"
></app-data-table>
```

### 4. Period Selector

```html
<app-date-range-picker
  [defaultRange]="'month'"
  [allowCustom]="true"
  (rangeChange)="onDateRangeChange($event)"
></app-date-range-picker>
```

### 5. Export Button

```html
<app-export-button
  [formats]="['PDF', 'Excel', 'CSV']"
  [fileName]="'Performance_Report_2026-09-09'"
  (export)="onExport($event)"
></app-export-button>
```

---

## Responsive Breakpoints

- **Mobile:** < 640px — Single column, stacked cards
- **Tablet:** 640px - 1024px — Two columns, condensed charts
- **Desktop:** > 1024px — Full layout with sidebars

---

## Accessibility Features

- High contrast color scheme (WCAG AA compliant)
- Keyboard navigation for all tables
- ARIA labels for charts and metrics
- Screen reader support for numbers and percentages
- Focus indicators on all interactive elements

---

## Animation & Transitions

- Metric card value updates: 300ms ease-out
- Chart animations: 500ms on load
- Table row hover: 100ms ease-in-out
- Modal open/close: 200ms fade

---

## Dark Mode Support

Dark mode toggle in header:
- Background: `#1F2937` (Gray-900)
- Cards: `#111827` (Gray-950)
- Text: `#F3F4F6` (Gray-100)
- Accent: `#3B82F6` (Blue-500)

---

**Last Updated:** 2026-09-09  
**Version:** 1.0 (Mockup)  
**Designer:** UI/UX Team
