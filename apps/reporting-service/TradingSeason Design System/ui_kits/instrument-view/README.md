# Instrument view kit (proposed — not in the product)

A new, expanded instrument screen for advanced traders, designed with TradingSeason's existing visual system. The shipped product only shows instruments inside the New Order dialog; everything here beyond that dialog is a **proposal**.

Data is grounded in the business schema (README ERD in the repo): `candles` (OHLCV + interval), `quotes` (bid/ask), `market_states` (trend, volatility, liquidity, momentum), `market_behaviors` (behavior_type, start_time, duration_seconds, strength), `market_ticks` (price, sequence_number), `stocks.base_volatility`, `holdings`. Values are mock.

Files: `CandleChart.jsx` (new candle + volume chart, styled like PriceChart), `InstrumentView.jsx` (layout), `index.html` (open with `?symbol=NVDA`). Reuses `../_shared/AppHeader.jsx` and `../_shared/OrderTicket.jsx`.

Entry point: New Order dialog → "Full view" in the Client UI kit.
