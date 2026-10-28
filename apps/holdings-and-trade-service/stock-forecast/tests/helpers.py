"""Synthetic data for tests: random-walk prices with no real pattern to find."""
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.data import build_dataset, save_prices


def make_prices(seed: int = 0, start: str = "2014-01-01", end: str = "2026-09-30",
                drift: float = 0.0004, vol: float = 0.017, start_price: float = 100.0) -> pd.DataFrame:
    """Daily OHLCV bars on business days, with log-normal random-walk closes."""
    # Synthetic random walks keep tests deterministic and independent of Yahoo Finance.
    index = pd.bdate_range(start, end, name="Date")
    rng = np.random.default_rng(seed)
    close = start_price * np.exp(np.cumsum(rng.normal(drift, vol, len(index))))
    open_ = close * (1 + rng.normal(0, 0.002, len(index)))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.003, len(index))))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.003, len(index))))
    volume = rng.integers(1_000_000, 5_000_000, len(index))
    return pd.DataFrame({"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume}, index=index)


def make_dataset(seed: int = 0, start: str = "2014-01-01") -> pd.DataFrame:
    """A model-ready dataset built from two independent random walks."""
    return build_dataset(
        make_prices(seed, start=start), make_prices(seed + 1, start=start, start_price=300.0)
    )


def simulate_var(coefs: list, intercept: list, n: int, noise: float = 0.5, seed: int = 0,
                 columns=("a", "b")) -> pd.DataFrame:
    """Simulate a VAR with known coefficients (coefs[i] multiplies the value i + 1 steps back)."""
    # Burn in initial zero rows so tests measure the stable process, not startup.
    rng = np.random.default_rng(seed)
    coefs = [np.asarray(c, dtype=float) for c in coefs]
    intercept = np.asarray(intercept, dtype=float)
    k, p, burn = len(intercept), len(coefs), 200
    y = np.zeros((n + burn, k))
    for t in range(p, n + burn):
        y[t] = intercept + sum(coefs[i] @ y[t - 1 - i] for i in range(p)) + rng.normal(0, noise, k)
    return pd.DataFrame(y[burn:], columns=list(columns))


def snapshot_patches(folder: Path, symbols=("AAPL", "SPY"), earnings=("AAPL",)) -> list:
    """Write synthetic price, VIX, VIX-family and earnings snapshots; return patches pointing config at them."""
    folder = Path(folder)
    csvs = {}
    for i, symbol in enumerate(symbols):
        csvs[symbol] = folder / f"{symbol.lower()}_daily.csv"
        save_prices(make_prices(i, start_price=100.0 + 200 * i), csvs[symbol])
    vix = folder / "vix_daily.csv"
    save_prices(make_prices(20, start_price=20.0), vix)
    family = {}
    for i, ticker in enumerate(("^VIX9D", "^VIX3M", "^VVIX")):
        family[ticker] = folder / f"{ticker[1:].lower()}_daily.csv"
        save_prices(make_prices(21 + i, start_price=(18.0, 22.0, 90.0)[i]), family[ticker])
    dates = {}
    for symbol in earnings:
        dates[symbol] = folder / f"{symbol.lower()}_earnings.csv"
        quarters = pd.date_range("2014-01-20", "2026-07-20", freq="QS-JAN") + pd.Timedelta(days=20, hours=16)
        pd.DataFrame({"announced_at": quarters.tz_localize("America/New_York")}).to_csv(dates[symbol], index=False)
    return [mock.patch.object(config, "SYMBOL_CSVS", csvs), mock.patch.object(config, "PRICES_CSV", csvs["AAPL"]),
            mock.patch.object(config, "MARKET_CSV", csvs["SPY"]), mock.patch.object(config, "VIX_CSV", vix),
            mock.patch.object(config, "VIX_FAMILY_CSVS", family), mock.patch.object(config, "EARNINGS_CSVS", dates)]


class FakeLstm:
    """Stands in for the Keras calls, so the code around an LSTM runs, and is checked, without TensorFlow.

    Patches the lstm_model functions where pipeline, pooled and platform_demo
    imported them, or only in `modules`. Every fit is recorded in `fits`; a
    model's P(event) is a fixed function of each window's last input, so it
    is reproducible and strictly between 0 and 1. `save` registers a model
    for load_artifacts.
    """

    def __init__(self, modules=("pipeline", "pooled", "platform_demo")):
        self.fits, self.saved = [], {}
        build = lambda lookback=10, n_features=1, units=4, base_rate=0.5, seed=0, **_: SimpleNamespace(
            input_shape=(None, lookback, n_features), base_rate=base_rate)
        functions = {"build_direction_lstm": build, "train_lstm": self._train,
                     "build_lstm": lambda lookback=config.LOOKBACK, n_features=1, **_: build(lookback, n_features),
                     "predict_up_probability": lambda model, X: 1 / (1 + np.exp(-np.asarray(X)[:, -1, 0])),
                     "predict_returns": lambda model, X, scalers: np.zeros(len(X)),
                     "load_artifacts": lambda directory=config.MODELS_DIR: self.saved[Path(directory)]}
        self.patches = [mock.patch(f"stock_forecast.{module}.{name}", function)
                        for module, names in (("pipeline", functions),
                                              ("pooled", ("build_direction_lstm", "train_lstm", "predict_up_probability")),
                                              ("platform_demo", ("load_artifacts", "predict_up_probability")))
                        if module in modules for name, function in functions.items() if name in names]

    def _train(self, model, X_train, y_train, X_val, y_val, verbose=0, **_):
        self.fits.append({"X_train": X_train, "y_train": y_train, "X_val": X_val, "y_val": y_val})
        return {"loss": [0.69], "val_loss": [0.69]}

    def save(self, directory: Path, lookback: int, scalers) -> None:
        model = SimpleNamespace(input_shape=(None, lookback, len(scalers.feature_cols)))
        self.saved[Path(directory)] = (model, scalers)

    def start(self) -> "FakeLstm":
        for patch in self.patches:
            patch.start()
        return self

    def stop(self) -> None:
        for patch in reversed(self.patches):
            patch.stop()

    def __enter__(self):
        return self.start()

    def __exit__(self, *exc):
        self.stop()
