"""Metrics, the results log and the charts for the presentation."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # write image files; never open windows
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Root mean squared error."""
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    if actual.shape != predicted.shape:
        raise ValueError(f"Shape mismatch: {actual.shape} vs {predicted.shape}")
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Mean absolute error."""
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    if actual.shape != predicted.shape:
        raise ValueError(f"Shape mismatch: {actual.shape} vs {predicted.shape}")
    return float(np.mean(np.abs(actual - predicted)))


def direction_accuracy(actual_returns: np.ndarray, predicted_up: np.ndarray) -> float:
    """Share of days where the up/down call matched what happened."""
    # Zero is treated as not-up, for both actual returns and model calls.
    actual_up = np.asarray(actual_returns, dtype=float) > 0
    predicted_up = np.asarray(predicted_up, dtype=bool)
    if actual_up.shape != predicted_up.shape:
        raise ValueError(f"Shape mismatch: {actual_up.shape} vs {predicted_up.shape}")
    return float(np.mean(actual_up == predicted_up))


def up_from_returns(predicted_returns: np.ndarray) -> np.ndarray:
    """Turn predicted returns into up (True) / down (False) calls."""
    return np.asarray(predicted_returns, dtype=float) > 0


def score(
    model: str,
    actual_returns: np.ndarray,
    predicted_returns: np.ndarray | None = None,
    predicted_up: np.ndarray | None = None,
    split: str = "validation",
    include_direction: bool = True,
) -> dict:
    """One row of the results table.

    Pass predicted_returns for return models, predicted_up for direction-only
    models, or both. include_direction=False for the naive forecast, whose
    'return = 0' has no direction.
    """
    for name, values in (("predicted_returns", predicted_returns), ("predicted_up", predicted_up)):
        if values is not None and np.isnan(np.asarray(values, dtype=float)).any():
            raise ValueError(f"{model}: {name} contains NaN; pass history so every day has a forecast")
    if predicted_up is None and predicted_returns is not None and include_direction:
        predicted_up = up_from_returns(predicted_returns)
    return {
        "model": model,
        "split": split,
        "days": int(len(actual_returns)),
        "return_rmse": None if predicted_returns is None else rmse(actual_returns, predicted_returns),
        "direction_accuracy": None if (predicted_up is None or not include_direction)
        else direction_accuracy(actual_returns, predicted_up),
    }


def failed_run_row(error: Exception, split: str = "validation") -> dict:
    """Represent a failed experiment in the same append-only results log."""
    return {
        "model": f"Baseline run failed ({type(error).__name__}: {error})",
        "split": split,
        "days": 0,
        "return_rmse": None,
        "direction_accuracy": None,
    }


def append_results(rows: list[dict], path: Path, run: str) -> pd.DataFrame:
    """Append rows to the results log, so every experiment is kept, good or bad."""
    # Timestamp each run and append instead of replacing history.
    frame = pd.DataFrame(rows)
    frame.insert(0, "run", run)
    frame.insert(0, "logged_at", datetime.now(timezone.utc).isoformat(timespec="seconds"))
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, mode="a", header=not path.exists(), index=False)
    return frame


def predicted_prices(close_today: np.ndarray, predicted_returns: np.ndarray) -> np.ndarray:
    """Convert next-day return forecasts into next-day price forecasts, for charts only."""
    return np.asarray(close_today, dtype=float) * (1 + np.asarray(predicted_returns, dtype=float))


def plot_price(prices: pd.Series, path: Path, title: str) -> Path:
    """Save a chronological daily closing-price chart."""
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.plot(prices.index, prices.to_numpy(dtype=float), linewidth=1)
    ax.set_title(title)
    ax.set_xlabel("Date")
    ax.set_ylabel("Price (USD)")
    fig.autofmt_xdate()
    return _save(fig, path)


def plot_daily_returns(returns: pd.Series, path: Path, title: str) -> Path:
    """Save a chart of daily returns, expressed in percent."""
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.plot(returns.index, returns.to_numpy(dtype=float) * 100, linewidth=0.6)
    ax.axhline(0, color="black", linewidth=0.8)
    ax.set_title(title)
    ax.set_xlabel("Date")
    ax.set_ylabel("Daily return (%)")
    fig.autofmt_xdate()
    return _save(fig, path)


def plot_actual_vs_predicted(
    dates: pd.Index, actual_next: np.ndarray, predicted_next: np.ndarray, path: Path, title: str, last_n: int = 60
) -> Path:
    """Actual vs predicted next-day close over the last `last_n` days: shows any one-day lag."""
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.plot(dates[-last_n:], actual_next[-last_n:], label="Actual next-day close", linewidth=2)
    ax.plot(dates[-last_n:], predicted_next[-last_n:], label="Predicted next-day close", linewidth=1.5, linestyle="--")
    ax.set_title(title)
    ax.set_xlabel("Forecast made at the close of")
    ax.set_ylabel("Price (USD)")
    ax.legend()
    fig.autofmt_xdate()
    return _save(fig, path)


def plot_direction_accuracy(table: pd.DataFrame, always_up_rate: float, path: Path, title: str) -> Path:
    """Direction accuracy by model, with a line at the always-up rate to beat."""
    rows = table.dropna(subset=["direction_accuracy"]).sort_values("direction_accuracy")
    fig, ax = plt.subplots(figsize=(8, 0.5 * len(rows) + 1.5))
    ax.barh(rows["model"], rows["direction_accuracy"] * 100)
    ax.axvline(always_up_rate * 100, linestyle="--", color="black", linewidth=1)
    ax.annotate("always up", (always_up_rate * 100, len(rows) - 0.5), xytext=(4, 0), textcoords="offset points")
    ax.set_xlabel("Direction accuracy (%)")
    lo = min(rows["direction_accuracy"].min(), always_up_rate) * 100
    hi = max(rows["direction_accuracy"].max(), always_up_rate) * 100
    ax.set_xlim(max(0, lo - 5), min(100, hi + 5))
    ax.set_title(title)
    return _save(fig, path)


def plot_loss(history: dict, path: Path) -> Path:
    """Training vs validation loss by epoch. Diverging lines mean memorising."""
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(history["loss"], label="Training loss")
    ax.plot(history["val_loss"], label="Validation loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Mean squared error (scaled)")
    ax.legend()
    return _save(fig, path)


def plot_walk_forward(table: pd.DataFrame, path: Path) -> Path:
    """Direction accuracy per test year, one line per model."""
    fig, ax = plt.subplots(figsize=(9, 4.5))
    for model, rows in table.dropna(subset=["direction_accuracy"]).groupby("model"):
        ax.plot(rows["year"], rows["direction_accuracy"] * 100, marker="o", label=model)
    ax.set_xlabel("Test year")
    ax.set_ylabel("Direction accuracy (%)")
    ax.legend(fontsize=8)
    return _save(fig, path)


def _save(fig: plt.Figure, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path
