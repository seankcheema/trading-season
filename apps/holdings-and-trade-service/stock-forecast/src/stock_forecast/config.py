"""Every setting the pipeline shares, in one place.

Change values here, never inside a script, so every run uses the same split
and every result in reports/ stays comparable.
"""
from pathlib import Path

# Instruments. AAPL is the model's target; SPY (the S&P 500 ETF) gives the
# vector autoregression a view of the overall market.
TICKER = "AAPL"
MARKET_TICKER = "SPY"
# Extra stocks for compare-symbols.py: two low-volatility stocks and one large
# tech stock like AAPL. Downloaded once by 0001-download-data.py --extra.
EXTRA_SYMBOLS = ["MSFT", "JNJ", "KO"]
# The CBOE volatility index: the options market's forecast of S&P 500
# volatility over the next 30 days. Downloaded once by 0001 --vix.
VIX_TICKER = "^VIX"

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

# Direction model: predicts the probability that tomorrow is an up day.
# Indicator windows feed add_indicators(); every column ends at day t's close.
VOLATILITY_WINDOW = 10
MOMENTUM_WINDOW = 20
DIRECTION_FEATURES = ["ret", "spy_ret", "volume_change", "volatility_10", "momentum_20"]
# Chosen by 0003-train-lstm.py --task direction --sweep on Oct 16: lowest validation log loss.
DIRECTION_LOOKBACK = 60
DIRECTION_UNITS = 32
DIRECTION_THRESHOLD = 0.5  # call "up" when the predicted probability is above this
# Settings tried by 0003-train-lstm.py --task direction --sweep (validation only).
DIRECTION_SWEEP_LOOKBACKS = [20, 30, 60]
DIRECTION_SWEEP_UNITS = [16, 32, 64]
CONFIDENCE_BUCKETS = 5
# Buy signal (extra-buy-signal.py): flag a day when P(up) is at or above a cutoff.
# Each candidate is tried on one year and the one with the largest edge over
# that year's up-rate is scored on the next; it needs BUY_SIGNAL_MIN_DAYS flags.
BUY_SIGNAL_CUTOFFS = [0.52, 0.54, 0.56, 0.58, 0.60, 0.62, 0.65]
BUY_SIGNAL_MIN_DAYS = 20

# Volatility model: predicts the probability that tomorrow is a big-move day,
# meaning its return, up or down, is larger than BIG_MOVE_QUANTILE of training
# days. At the median, about half of training days are big-move days.
BIG_MOVE_QUANTILE = 0.5
VOLATILITY_FEATURES = ["abs_ret", "spy_abs_ret", "ret", "volume_change", "volatility_10", "momentum_20"]
# Tried by extra-volatility-experiments.py on Oct 16 and not adopted: it helped on
# validation but not in walk-forward (see reports/README.md).
EXTENDED_VOLATILITY_FEATURES = VOLATILITY_FEATURES + ["range", "range_10", "volatility_20", "volatility_60"]
EXPERIMENT_SEEDS = 5
# Chosen by 0003-train-lstm.py --task volatility --sweep on Oct 16: lowest validation log loss.
VOLATILITY_LOOKBACK = 60
VOLATILITY_UNITS = 64

# Paths. ROOT is apps/holdings-and-trade-service/stock-forecast; REPO_ROOT is the trading-season checkout.
ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parents[2]
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
DIRECTION_MODEL_DIR = MODELS_DIR / "lstm-direction"
VOLATILITY_MODEL_DIR = MODELS_DIR / "lstm-volatility"
REPORTS_DIR = ROOT / "reports"
PRICES_CSV = DATA_DIR / "aapl_daily.csv"
MARKET_CSV = DATA_DIR / "spy_daily.csv"
# Snapshots that compare-symbols.py can use as the stock to predict.
SYMBOL_CSVS = {TICKER: PRICES_CSV, MARKET_TICKER: MARKET_CSV,
               **{symbol: DATA_DIR / f"{symbol.lower()}_daily.csv" for symbol in EXTRA_SYMBOLS}}
COMPARISON_SYMBOLS = [TICKER, MARKET_TICKER, *EXTRA_SYMBOLS]
VIX_CSV = DATA_DIR / "vix_daily.csv"
VIX_FEATURES = VOLATILITY_FEATURES + ["vix", "vix_change"]
# The rest of the VIX family (0001 --vix-family): 9-day and 3-month expected
# volatility, and the volatility of VIX itself. VIX9D starts in Jan 2011.
VIX_FAMILY_CSVS = {"^VIX9D": DATA_DIR / "vix9d_daily.csv", "^VIX3M": DATA_DIR / "vix3m_daily.csv",
                   "^VVIX": DATA_DIR / "vvix_daily.csv"}
VIX_FAMILY_FEATURES = VIX_FEATURES + ["vix_short", "vix_term", "vvix"]
# Fear vs reality: VIX minus the market's realized volatility over the last
# VIX_GAP_WINDOW days, both annualized.
VIX_GAP_WINDOW = 20
VIX_GAP_FEATURES = VIX_FAMILY_FEATURES + ["vix_gap"]
# Earnings announcement dates and times (0001 --earnings), never the results.
# A report at or after EARNINGS_AFTER_HOUR moves the next trading day.
EARNINGS_CSVS = {symbol: DATA_DIR / f"{symbol.lower()}_earnings.csv" for symbol in [TICKER, *EXTRA_SYMBOLS]}
EARNINGS_AFTER_HOUR = 12
EARNINGS_FEATURES = VIX_GAP_FEATURES + ["earnings_next"]
# Prediction windows: is the market's realized volatility over the next H
# trading days above the training median? H = 1 is the next-day big move.
HORIZONS = [1, 2, 3, 5, 10, 15, 21]
HORIZON_FEATURES = VIX_GAP_FEATURES
HORIZON_COMPARISON_CSV = REPORTS_DIR / "horizon_comparison.csv"
VIX_FAMILY_SYMBOLS = [TICKER, MARKET_TICKER]
VIX_FAMILY_COMPARISON_CSV = REPORTS_DIR / "vix_family_comparison.csv"
POOLED_COMPARISON_CSV = REPORTS_DIR / "pooled_vix_comparison.csv"
# TradingSeason demo: daily bars exported from the platform's simulated 2026
# archive by export-platform-daily.py. Simulated prices: a demo, never evidence.
PLATFORM_DIR = DATA_DIR / "platform"
PLATFORM_SYMBOL = "AAPL"
PLATFORM_RESULTS_CSV = REPORTS_DIR / "platform_demo.csv"
# The simulation's own settings, read only for its scheduled volatility spikes.
PLATFORM_SIM_CONFIG = (REPO_ROOT / "apps" / "market-data" / "db" / "scripts" / "python" / "config"
                       / "synthetic-market-data-2026-v1.json")
PLATFORM_SPIKE_CSV = REPORTS_DIR / "platform_spike.csv"
SYMBOL_COMPARISON_CSV = REPORTS_DIR / "symbol_comparison.csv"
RESULTS_CSV = REPORTS_DIR / "results.csv"
TEST_RESULTS_CSV = REPORTS_DIR / "test_results.csv"
WALK_FORWARD_CSV = REPORTS_DIR / "walk_forward.csv"
DIRECTION_RESULTS_CSV = REPORTS_DIR / "direction_results.csv"
TEST_DIRECTION_CSV = REPORTS_DIR / "test_direction_results.csv"
VOLATILITY_RESULTS_CSV = REPORTS_DIR / "volatility_results.csv"
TEST_VOLATILITY_CSV = REPORTS_DIR / "test_volatility_results.csv"
WALK_FORWARD_VOLATILITY_CSV = REPORTS_DIR / "walk_forward_volatility.csv"
BUY_SIGNAL_CSV = REPORTS_DIR / "buy_signal.csv"
MARKET_CONDITIONS_CSV =REPORTS_DIR / "market_conditions.csv"
AUTOCORRELATION_CSV = REPORTS_DIR / "return_autocorrelation.csv"
SCORECARD_JSON = REPO_ROOT / "apps" / "client-ui" / "public" / "forecast" / "scorecard.json"
PRICE_CHART = REPORTS_DIR / "aapl_price.png"
DAILY_RETURNS_CHART = REPORTS_DIR / "aapl_daily_returns.png"
