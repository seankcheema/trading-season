# Stock Forecast

Offline Python pipeline that forecasts AAPL's next-day return and checks whether any model beats simple baselines. It trains on real daily prices from Yahoo Finance, not on the platform's synthetic market data, and it is not deployed. It prepares `apps/client-ui/public/forecast/scorecard.json` as the placeholder contract for planned market-page Trend card work; the UI does not consume it yet.

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
| 6 | `python scripts/0004-walk-forward.py --with-lstm` | `reports/walk_forward.csv`, chart | Week 3 |
| 7 | `python scripts/0005-export-scorecard.py --model lstm` | `reports/test_results.csv`, real `scorecard.json` | Once, Oct 22 |

`0003-train-lstm.py --features ret spy_ret volume_change` trains on several columns. `0005` accepts `--model lstm`, `var` or `linear`, and refuses to rerun the test unless given `--force`.

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
- `scorecard.py` defines the fields for the planned UI contract. Coordinate field changes with the client UI when its scorecard service and API documentation are added.
