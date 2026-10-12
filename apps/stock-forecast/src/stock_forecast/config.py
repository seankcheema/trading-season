"""Every setting the pipeline shares, in one place.

Change values here, never inside a script, so every run uses the same split
and every result in reports/ stays comparable.
"""
from pathlib import Path

# Instruments. AAPL is the model's target; SPY (the S&P 500 ETF) gives the
# vector autoregression a view of the overall market.
TICKER = "AAPL"
MARKET_TICKER = "SPY"

# Download window. yfinance treats END as exclusive, so this ends Sep 30, 2026.
START = "2010-01-01"
END = "2026-10-01"

# Chronological split. Never shuffle, never overlap, never change mid-project.
TRAIN_END = "2021-12-31"
VAL_START = "2022-01-01"
VAL_END = "2023-12-31"
TEST_START = "2024-01-01"

# Walk-forward test years: retrain on everything before year Y, using year
# Y - 1 for early stopping, then score year Y.
WALK_FORWARD_YEARS = list(range(2018, 2024))

# Model settings.
LOOKBACK = 30            # days of history in each LSTM / regression window
MA_WINDOW = 30           # moving-average baseline window
VAR_MAX_LAGS = 10        # largest VAR order tried by AIC
VAR_COLUMNS = ["ret", "spy_ret", "volume_change"]
LSTM_UNITS = 32
LSTM_DROPOUT = 0.2
LSTM_EPOCHS = 100
LSTM_BATCH_SIZE = 32
LSTM_PATIENCE = 10
SEED = 42

# Paths. ROOT is apps/stock-forecast; REPO_ROOT is the trading-season checkout.
ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parents[1]
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
PRICES_CSV = DATA_DIR / "aapl_daily.csv"
MARKET_CSV = DATA_DIR / "spy_daily.csv"
RESULTS_CSV = REPORTS_DIR / "results.csv"
TEST_RESULTS_CSV = REPORTS_DIR / "test_results.csv"
WALK_FORWARD_CSV = REPORTS_DIR / "walk_forward.csv"
SCORECARD_JSON = REPO_ROOT / "apps" / "client-ui" / "public" / "forecast" / "scorecard.json"
