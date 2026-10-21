# Stock Forecast

Offline Python pipeline that forecasts whether AAPL's next trading day is up or down (and, as a secondary track, its next-day return) and checks whether any model beats simple baselines. It trains on real daily prices from Yahoo Finance, not on the platform's synthetic market data, and it is not deployed. It prepares `apps/client-ui/public/forecast/scorecard.json` as the placeholder contract for planned market-page Trend card work; the UI does not consume it yet.

## Models compared

Every model is scored on the same days with the same metrics.

| Model | What it predicts | Module |
| --- | --- | --- |
| Naive | Return of 0 ("tomorrow's price = today's") | `baselines.py` |
| Always up | Up every day | `baselines.py` |
| Training-average return | The average training-period return | `baselines.py` |
| 30-day average return | The average of the last 30 returns | `baselines.py` |
| Linear regression | Return, from the last 30 returns | `baselines.py` |
| Logistic regression | Up or down, from the last 30 returns | `baselines.py` |
| VAR(p) | Return, jointly with SPY's return and AAPL's volume change, p chosen by AIC | `var_model.py` |
| LSTM | Return, from 30-day windows of one or more columns | `lstm_model.py` |
| Always up (training up-rate) | The training up-share as a probability, every day | `pipeline.py` |
| Logistic regression (indicators) | Probability of an up day, from today's indicator values | `pipeline.py` |
| Logistic regression (30 returns) | Probability of an up day, from the last 30 returns | `pipeline.py` |
| LSTM direction | Probability of an up day, from windows of the direction features | `lstm_model.py` |
| Training big-move rate (constant) | The training share of big-move days, every day | `pipeline.py` |
| Same as today | Big-move tomorrow if today was a big-move day | `pipeline.py` |
| Logistic regression (recent volatility) | Probability of a big-move day, from today's move size and 10-day volatility | `pipeline.py` |
| Logistic regression (indicators), volatility | Probability of a big-move day, from today's `VOLATILITY_FEATURES` | `pipeline.py` |
| LSTM volatility | Probability of a big-move day, from windows of the volatility features | `lstm_model.py` |

## Direction models

The direction track is the headline. Each direction model outputs P(up) for the next day and calls "up" when it is above `DIRECTION_THRESHOLD` (0.5). Accuracy alone flatters a model that calls "up" nearly every day, so each run also reports:

| Metric | Meaning | No-skill value |
| --- | --- | --- |
| `direction_accuracy` | Share of days called correctly | The always-up rate on the same days |
| `balanced_accuracy` | Mean of the up-day and down-day hit rates | 0.5 |
| `up_call_rate` | Share of days called "up" | Near 1.0 means the model collapsed into always-up |
| `auc` | Chance an up day got a higher probability than a down day | 0.5 |
| `brier_skill` | Improvement in squared probability error over quoting the training up-rate | 0 or below |
| `log_loss` | Cross-entropy of the probabilities; used to choose settings | The base rate's log loss |

Inputs (`DIRECTION_FEATURES`): today's return, SPY's return, volume change, 10-day volatility and 20-day momentum. `data.add_indicators` computes the last two from past rows only and drops the warm-up rows in early 2010. The final training and validation rows carry a label from the next split, so the direction models never fit or early-stop on those labels. Confidence buckets split the scored days into five equal groups by distance from 0.5; accuracy that does not rise with confidence means the probabilities do not tell you which days to trust.

[reports/README.md](reports/README.md) explains every chart for readers without a machine learning background.

## Volatility models

A second track predicts how big tomorrow's move will be instead of its direction. A big-move day is one whose return, up or down, is larger than `BIG_MOVE_QUANTILE` (the median) of training-day moves; `pipeline.big_move_threshold` cuts that threshold from training labels only and reuses it unchanged. Walk-forward folds cut their own threshold from their training years. The metrics are the direction ones under generic names (`accuracy`, `call_rate`, `event_rate`); the bar to clear each year is the better of answering "big" or "calm" every day. Inputs (`VOLATILITY_FEATURES`) add `abs_ret` and `spy_abs_ret`, today's AAPL and SPY move sizes. Volatility runs log to `reports/volatility_results.csv`, not `results.csv`, whose columns are return and direction metrics.

`scripts/extra-volatility-experiments.py` compares `VOLATILITY_FEATURES` with `EXTENDED_VOLATILITY_FEATURES`, which add the intraday range, its 10-day mean, and 20- and 60-day volatility from `data.add_range_features`. By default it scores validation with `EXPERIMENT_SEEDS` seeds and their average; `--walk-forward` retrains each walk-forward year. The extended inputs improved validation (63.3% against about 61%) but not walk-forward (59.5% against 59.8%), so they are not adopted.

## Other symbols

`scripts/compare-symbols.py` runs both tracks on every symbol in `COMPARISON_SYMBOLS` (AAPL, SPY and the `EXTRA_SYMBOLS`) with the settings chosen for AAPL, so nothing is retuned per symbol. When SPY is the stock being predicted, `symbols.inputs_for` drops the SPY market columns, which would copy its own returns. It scores validation and walk-forward only and writes `reports/symbol_comparison.csv` and `.png`; `--no-lstm` runs the regressions alone in seconds. `--symbols NVDA KO` runs only those symbols and replaces only their saved rows for the models just run, so other symbols, and a symbol's LSTM rows after a `--no-lstm` run, are kept. To add a stock, add it to `EXTRA_SYMBOLS` and run `0001-download-data.py --extra`, which downloads only the snapshots not yet saved; `--force` re-downloads them all.

## Shared model and VIX

`scripts/extra-pooled-and-vix.py` tests two ways to improve the big-move model on every comparison symbol: the VIX index as two extra inputs (`data.add_vix`: its level and daily log change, both known at the close; `VIX_FEATURES`), and one LSTM trained on all the stocks together (`pooled.py`). The shared model keeps each stock's own big-move threshold and input scalers, both fit on that stock's training rows, and scores each stock separately. Settings are the AAPL ones; validation and walk-forward only. It writes `reports/pooled_vix_comparison.csv` and `.png`, prints one line per model trained, and `--verbose` adds one line per epoch. `0001-download-data.py --vix` saves the VIX snapshot once.

Walk-forward results (Oct 18): averaged over the five stocks, the shared LSTM scored 61.1% against 60.0% for one LSTM per stock, and VIX lifted SPY's per-stock LSTM from 64.4% to 67.5%. Gains elsewhere were one to two points or none, and JNJ stayed below its bar. Logistic regression with VIX gave the best-calibrated probabilities. None of these replace the frozen AAPL model. The per-stock rows here differ by up to half a point from `compare-symbols.py` because joining VIX drops one early-2010 row.

## VIX family, earnings and prediction windows

These experiments use the VIX family on top of VIX (`0001-download-data.py --vix-family`: VIX9D, VIX3M and VVIX, from Jan 2011) and each stock's earnings announcement times (`--earnings`: dates and times only, never the results). `data.add_vix_family` adds `vix_short` (VIX9D / VIX), `vix_term` (VIX / VIX3M; above 1 is an inverted curve) and `vvix`; `data.add_vix_gap` adds `vix_gap`, VIX minus the market's realized volatility over `VIX_GAP_WINDOW` days; `data.add_earnings` flags the last trading day before an announcement's reaction day (reports at or after `EARNINGS_AFTER_HOUR` move the next day).

- `scripts/extra-vix-family.py` compares VIX, the VIX family, the family plus the gap, and, for stocks with saved earnings dates, all of them plus earnings, for logistic regression and the LSTM, walk-forward on AAPL and SPY. It writes `reports/vix_family_comparison.csv`; `--symbols` reruns some symbols and keeps the others' rows.
- `scripts/extra-horizons.py` changes the question to "will realized volatility over the next H days be above its training median?" (`horizons.future_volatility`), for each H in `HORIZONS`. Labels over H days reach H days ahead, so `pipeline.event_lstm_predictions(purge=H)` drops the last H labels before every split boundary. `--train-years N` trains on only the last N years (a sliding training window). It writes `reports/horizon_comparison.csv`; `--no-lstm` runs the logistic regression alone in seconds.

Walk-forward results (Oct 19-20): on AAPL's next-day big moves, VIX, the family, the gap and earnings together reached 62.2% (Brier skill 0.094, against 60.2% and 0.050 for the frozen model). SPY's realized volatility over the next 3 to 5 days was predicted correctly about 80% of the time against a bar of 65-68%, beating it in 5 of 6 years; AAPL's longer windows reached about 71% but stayed about 4 points above their bar. Training on all history beat a sliding 3- or 5-year window, and the LSTM did not beat logistic regression at windows of 3 days or more. None of these replace the frozen model.

## TradingSeason demo

`scripts/extra-platform-demo.py` runs the saved direction and volatility models, untrained further, on the platform's simulated 2026 AAPL prices in `data/platform/`. It is a demo that the pipeline runs on platform data, never evidence: the simulation follows scripted monthly trends, so a "follow the 20-day trend" rule, scored alongside, does well there. `platform_demo.py` replaces SPY with the equal-weight average of the platform's 10 stocks and scores two variants on the same days: as trained, and recalibrated, where only the input scalers and the big-move cut-off are re-fit on the warm-up rows before the scored period. It writes `reports/platform_demo.csv` and `.png`; `--symbol MSFT` runs another platform stock through the same AAPL-trained models and writes `platform_demo_msft.csv` and `.png`.

`scripts/extra-platform-spike.py` reads the simulation's scheduled volatility spikes from its config (`PLATFORM_SIM_CONFIG`, read only) and charts the saved volatility model's daily big-move probability around the October spike, dated to the day each forecast is for. It writes `reports/platform_spike.csv` for every platform stock and `reports/platform_spike.png` for `--symbol` (AAPL by default).

`data/platform/` is exported from the seeded simulation archive by `scripts/export-platform-daily.py`, which rolls the archive's one-minute candles into daily bars and runs inside the platform's market-data image (the command is in its docstring). It reads the generated Parquet files, never the `trading_season` database. The platform's candles endpoint serves the same files, but in the local Docker stack both Java services run on Alpine images, where DuckDB's native library cannot load, so their replay endpoints fail with "Selected date has no replay prices available".

`market-conditions.py` is descriptive: the next-day up-rate and mean next-day return after conditions such as a 2% drop or high volatility, in training and validation side by side, with thresholds cut from training rows only. It also writes the lag 1 to 5 autocorrelation of daily returns, the standard mean-reversion check. It never reads the test years.

## Data and splits

`0001-download-data.py` saves `data/aapl_daily.csv` and `data/spy_daily.csv` (adjusted daily bars, Jan 2010 to Sep 2026). Commit both and never re-download mid-project. `0001-download-data.py --extra` saves one snapshot per `EXTRA_SYMBOLS` stock (MSFT, JNJ and KO, downloaded Oct 16) for `compare-symbols.py`; the AAPL models never read them. Row t of the dataset holds what is known at day t's close; its `target` is day t+1's return.

| Split | Dates | Used for |
| --- | --- | --- |
| Train | 2010 to 2021 | Fitting every model and every scaler |
| Validation | 2022 to 2023 | Early stopping, choosing settings, all comparisons during development |
| Test | Jan 2024 to Sep 2026 | One final run, by `0005-export-scorecard.py` |
| Walk-forward | Test years 2018 to 2023 | Checking the result holds year by year |

All dates and settings live in `src/stock_forecast/config.py`.

## Setup (Python 3.14, from the repository root)

```sh
python3.14 -m venv apps/holdings-and-trade-service/stock-forecast/.venv
source apps/holdings-and-trade-service/stock-forecast/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --pre -r apps/holdings-and-trade-service/stock-forecast/requirements.txt
python -m ipykernel install --user --name stock-forecast --display-name "Python (Stock Forecast)"
python -c "import tensorflow, yfinance"
```

On Windows PowerShell, create the environment with
`py -3.14 -m venv apps/holdings-and-trade-service/stock-forecast/.venv` and activate it with
`apps/holdings-and-trade-service/stock-forecast/.venv/Scripts/Activate.ps1` before running the remaining commands.

TensorFlow 2.22 is currently a release candidate and provides the Python 3.14
wheel used by this setup. `--pre` also makes prerelease dependencies available
to pip; the requirements select the Python 3.14 build. Native Windows TensorFlow
runs CPU-only, which is enough for this data.

## Run order

Run from `apps/holdings-and-trade-service/stock-forecast` with the virtual environment active.

| Step | Command | Writes | When |
| --- | --- | --- | --- |
| 1 | `python scripts/0001-download-data.py` | `data/*.csv` | Once, week 1; refuses to overwrite either existing snapshot unless `--force` is supplied |
| 2 | `python scripts/plot-data.py` | `reports/aapl_price.png`, `reports/aapl_daily_returns.png` | After downloading or changing the snapshot |
| 3 | `python scripts/0005-export-scorecard.py --placeholder` | Placeholder `scorecard.json` for the UI | Once, week 1 |
| 4 | `python scripts/0002-evaluate-baselines.py` | `reports/results.csv`, direction chart | Week 1, again after changes |
| 5 | `python scripts/0003-train-lstm.py` | `models/`, `reports/results.csv`, loss and lag charts | Week 2 |
| 6 | `python scripts/market-conditions.py` | `reports/market_conditions.csv` and `.png`, `reports/return_autocorrelation.csv` | Week 3 |
| 7 | `python scripts/0003-train-lstm.py --task direction --sweep` | `models/lstm-direction/`, `reports/direction_results.csv`, confidence, probability and loss charts | Week 3 |
| 8 | `python scripts/0004-walk-forward.py --with-lstm --with-direction-lstm` | `reports/walk_forward.csv`, chart | Week 3 |
| 9 | `python scripts/0003-train-lstm.py --task volatility --sweep` | `models/lstm-volatility/`, `reports/volatility_results.csv`, volatility confidence, probability and loss charts | Week 3 |
| 10 | `python scripts/0004-walk-forward.py --task volatility --with-volatility-lstm` | `reports/walk_forward_volatility.csv`, chart | Week 3 |
| 10a | `python scripts/0001-download-data.py --extra` | `data/msft_daily.csv`, `jnj_daily.csv`, `ko_daily.csv` | Once, Oct 16 |
| 10b | `python scripts/compare-symbols.py` | `reports/symbol_comparison.csv` and `.png` | Week 3, up to an hour on a laptop CPU |
| 10c | `python scripts/0001-download-data.py --vix` | `data/vix_daily.csv` | Once, Oct 17 |
| 10d | `python scripts/extra-pooled-and-vix.py` | `reports/pooled_vix_comparison.csv` and `.png` | Week 3, one to two hours |
| 10e | `export-platform-daily.py` through Docker (see its docstring) | `data/platform/*.csv` | Once, after seeding the platform's market data |
| 10f | `python scripts/extra-platform-demo.py` | `reports/platform_demo.csv` and `.png` | Any time; under a minute |
| 10g | `python scripts/0001-download-data.py --vix-family` and `--earnings` | `data/vix9d_daily.csv`, `vix3m_daily.csv`, `vvix_daily.csv`, `data/*_earnings.csv` | Once, Oct 19 |
| 10h | `python scripts/extra-vix-family.py` | `reports/vix_family_comparison.csv` | Week 3, about 30 minutes |
| 10i | `python scripts/extra-horizons.py` | `reports/horizon_comparison.csv` | Week 3; seconds with `--no-lstm`, about 30 minutes with the LSTM |
| 10j | `python scripts/extra-platform-spike.py` | `reports/platform_spike.csv` and `.png` | Any time; under a minute |
| 11 | `python scripts/0005-export-scorecard.py --model lstm-direction` | `reports/test_results.csv`, `reports/test_direction_results.csv`, test confidence charts, real `scorecard.json` | Once, Oct 22, after the final review |
| 12 | `python scripts/0005-export-scorecard.py --model lstm-volatility` | `reports/test_volatility_results.csv`, test volatility charts; no scorecard | Once, Oct 22, after the final review |

`0003-train-lstm.py --features ret spy_ret volume_change` trains the return LSTM on several columns. With `--task direction`, `--sweep` tries every `DIRECTION_SWEEP_LOOKBACKS` and `DIRECTION_SWEEP_UNITS` pair on validation and saves the lowest-log-loss run; without it, `--lookback`, `--units` and `--seed` train one model (use `--seed` to check that a result is not one lucky initialisation). Copy the chosen settings into `DIRECTION_LOOKBACK` and `DIRECTION_UNITS`, which walk-forward uses. `--task volatility` takes the same options, tries the same grid, and its settings go in `VOLATILITY_LOOKBACK` and `VOLATILITY_UNITS`. `0005` accepts `--model lstm-direction`, `lstm`, `var`, `linear` or `lstm-volatility`, and refuses to rerun a test unless given `--force`; the volatility test has its own guard and never writes the scorecard.

`0002-evaluate-baselines.py` scores six forecasts on the same 2022-2023
validation dates: zero return, always up, 30-day average, training average,
linear regression and logistic regression. The 2021 rows supply history for
the first validation forecast, while fitted targets stop before a label that
would cross into validation. Each run is appended to `reports/results.csv`
with a UTC timestamp; failed runs are recorded there before the error is raised.
The direction chart is saved as `reports/direction_accuracy_validation.png`.

`data.py` builds each row from values known at that date's close. The target
alone shifts by one row: it is the next trading day's return. The ordered split
uses 2010-2021 for training, 2022-2023 for validation, and 2024 onward for
testing; invalid boundaries, unsorted dates, duplicate dates, empty parts, and
missing values raise errors. `plot-data.py` validates the dataset and saves
the chronological price and daily-return charts under `reports/`.

## Tests

```powershell
cd apps/holdings-and-trade-service/stock-forecast
python -m pytest
```

Tests use synthetic random-walk prices, so they need no network. The LSTM tests skip where TensorFlow is missing. `test_no_model_beats_a_coin_flip_on_a_random_walk` is a leak alarm: random-walk data has nothing to learn, so a model scoring 60% or more on it means future data reached its inputs.

## Vector autoregression

`var_model.py` fits the VAR by least squares in numpy, so each step is visible: build lagged inputs, solve, read off the coefficient matrices, forecast one day ahead. The textbook's version is `Chapter08/03_vector_autoregressive_model.ipynb` in the Hands-On Machine Learning for Algorithmic Trading repository, using statsmodels. `scripts/extra-check-var-with-statsmodels.py` compares the two after `pip install statsmodels`.

The order is chosen by AIC on the training years only. Volume changes are strongly anti-correlated day to day, which can push the order up to `VAR_MAX_LAGS` even when returns need one lag. If that happens, compare against `VAR_COLUMNS = ["ret", "spy_ret"]` in `config.py` and keep the better validation result.

## Rules

- Split by date; never shuffle before splitting. Fit scalers on training rows only.
- Every input for day t uses data known at day t's close. The only `shift(-1)` is the target.
- Tune on validation. Run the test once. Every run is appended to `reports/results.csv`, good or bad.
- No fallbacks that invent data or predictions: a failed download or missing package stops the run.
- `data/` and `reports/` are committed; `models/` is not (the scripts rebuild it).
- `scorecard.py` defines the fields for the planned UI contract. `modelReturnRmse` is `null` for a direction-only model. Coordinate field changes with the client UI when its scorecard service and API documentation are added.
