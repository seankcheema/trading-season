# Stock forecast instructions

Offline Python research pipeline; see [README.md](README.md). It is not a service and must never read or write the `trading_season` database.

- One model owner edits `src/` and `scripts/`; others send findings as Jira or review comments.
- Keep every shared setting in `src/stock_forecast/config.py`. Do not hard-code dates, tickers or paths in scripts.
- Preserve leakage safeguards: chronological splits, scalers fit on training rows, windows and lags built only from past rows, validation for tuning, one test run.
- Never add fallbacks that substitute simulated data or invented predictions for a failed download, a missing package or an untrained model.
- Add or update a test in `tests/` with every behavior change; run `python -m pytest` from this directory.
- The scorecard fields are a contract with `apps/client-ui/src/app/market-page/forecast-scorecard`. Change both sides and the API reference together.
- The platform signal file (`platform_signals.py`, written to `apps/client-ui/public/forecast/platform-signals.json`) is a contract with the market page's risk card in `apps/client-ui/src/app/market-page`. Change both sides together, and keep its track record free of lookahead: a day's counts cover only windows closed by that day.
- Update README.md when commands, outputs or settings change. No emojis in Markdown.
