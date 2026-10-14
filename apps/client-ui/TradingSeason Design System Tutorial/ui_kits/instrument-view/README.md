# Market page kit (full screen)

Recreation of `apps/client-ui/src/app/market-page/` (route `dashboard/markets/:symbol`), opened from **Full screen** in the New Order dialog. Open with `?symbol=NVDA`.

- **Nav** (`MarketPage.jsx`): 40px chevron-left back button, md instrument search, market clock, notifications bell, profile.
- **Summary**: symbol + watchlist star, price, metrics (Mkt Cap, Bid, Ask, Spread, Open, Day Range, Range Volume).
- **Chart panel**: tool buttons for Indicators (SMA 20, EMA 20, Bollinger 20 · 2σ, RSI 14), Graph view (Line, Area, Candles, OHLC, Volume, Percent) and Compare (split view with price labels), plus the 1D/5D/1M/1Y toggle. `MarketChart.jsx` adds wheel zoom, drag pan, zoom/pan/reset controls, crosshair OHLC readout and a current-price label.
- **Tools column** (`MarketTools.jsx`), collapsible with the chevron: Overview / News / AI / Recent Orders tabs, the expanded account control with Available cash and Portfolio value cards, and the compact trade ticket.

Mock values: market caps other than AAPL, the AI reply text and the order confirmation message are placeholders. Indicator colors come from `.indicator-legend` in `market-page.component.css`.

## Layouts
Profile menu → **Flat layout / Card layout** (or `?layout=flat`). Shares `localStorage['ts-client-layout']` with the dashboard, so the choice carries between screens. Flat removes the card frames from the summary, chart panel, tools, account panel and trade ticket; sections are divided by hairlines and a vertical rule separates the tools column.
