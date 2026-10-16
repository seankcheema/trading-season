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

`market-conditions.py` is descriptive: the next-day up-rate and mean next-day return after conditions such as a 2% drop or high volatility, in training and validation side by side, with thresholds cut from training rows only. It also writes the lag 1 to 5 autocorrelation of daily returns, the standard mean-reversion check. It never reads the test years.

## Data and splits

`0001-download-data.py` saves `data/aapl_daily.csv` and `data/spy_daily.csv` (adjusted daily bars, Jan 2010 to Sep 2026). Commit both and never re-download mid-project. Row t of the dataset holds what is known at day t's close; its `target` is day t+1's return.

| Split | Dates | Used for |
| --- | --- | --- |
| Train | 2010 to 2021 | Fitting every model and every scaler |
| Validation | 2022 to 2023 | Early stopping, choosing settings, all comparisons during development |
| Test | Jan 2024 to Sep 2026 | One final run, by `0005-export-scorecard.py` |
| Walk-forward | Test years 2018 to 2023 | Checking the result holds year by year |

All dates and settings live in `src/stock_forecast/config.py`.

## Setup (Python 3.14, from the repository root)

```sh
python3.14 -m venv apps/stock-forecast/.venv
source apps/stock-forecast/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --pre -r apps/stock-forecast/requirements.txt
python -m ipykernel install --user --name stock-forecast --display-name "Python (Stock Forecast)"
python -c "import tensorflow, yfinance"
```

On Windows PowerShell, create the environment with
`py -3.14 -m venv apps/stock-forecast/.venv` and activate it with
`apps/stock-forecast/.venv/Scripts/Activate.ps1` before running the remaining commands.

TensorFlow 2.22 is currently a release candidate and provides the Python 3.14
wheel used by this setup. `--pre` also makes prerelease dependencies available
to pip; the requirements select the Python 3.14 build. Native Windows TensorFlow
runs CPU-only, which is enough for this data.

## Run order

Run from `apps/stock-forecast` with the virtual environment active.

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
cd apps/stock-forecast
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
