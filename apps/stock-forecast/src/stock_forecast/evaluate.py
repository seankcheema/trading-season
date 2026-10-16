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


def direction_metrics(
    actual_returns: np.ndarray, prob_up: np.ndarray, base_rate: float, threshold: float = 0.5
) -> dict:
    """Score up-probabilities, not just the up/down calls made from them.

    base_rate is the training up-share: quoting it every day is the
    probability version of "always up". brier_skill above 0 means the model's
    probabilities beat that constant; at or below 0 it learned nothing usable.
    up_call_rate shows when a model has collapsed into calling "up" every day.
    """
    actual_up = np.asarray(actual_returns, dtype=float) > 0
    prob = np.asarray(prob_up, dtype=float)
    if actual_up.shape != prob.shape:
        raise ValueError(f"Shape mismatch: {actual_up.shape} vs {prob.shape}")
    if np.isnan(prob).any() or (prob < 0).any() or (prob > 1).any():
        raise ValueError("Probabilities must be between 0 and 1 with no NaN")
    called_up = prob > threshold
    # Clip only for the log, so a confident miss costs a lot but stays finite.
    clipped = np.clip(prob, 1e-7, 1 - 1e-7)
    brier = float(np.mean((prob - actual_up) ** 2))
    base_brier = float(np.mean((base_rate - actual_up) ** 2))
    up_days, down_days = actual_up.sum(), (~actual_up).sum()
    return {
        "direction_accuracy": float(np.mean(called_up == actual_up)),
        # Mean of the up-day and down-day hit rates: 0.5 for any constant call.
        "balanced_accuracy": float(np.mean([
            called_up[actual_up].mean() if up_days else np.nan,
            (~called_up[~actual_up]).mean() if down_days else np.nan,
        ])),
        "up_call_rate": float(called_up.mean()),
        "actual_up_rate": float(actual_up.mean()),
        "auc": _auc(actual_up, prob),
        "brier": brier,
        "brier_skill": 1 - brier / base_brier if base_brier > 0 else float("nan"),
        "log_loss": float(-np.mean(actual_up * np.log(clipped) + (~actual_up) * np.log(1 - clipped))),
    }


def _auc(actual_up: np.ndarray, prob: np.ndarray) -> float:
    """Chance a random up day got a higher probability than a random down day (0.5 = no skill)."""
    if actual_up.all() or not actual_up.any():
        return float("nan")
    ranks = pd.Series(prob).rank().to_numpy()  # ties share an average rank
    n_up, n_down = actual_up.sum(), (~actual_up).sum()
    return float((ranks[actual_up].sum() - n_up * (n_up + 1) / 2) / (n_up * n_down))


def confidence_buckets(
    actual_returns: np.ndarray, prob_up: np.ndarray, buckets: int = 5, threshold: float = 0.5
) -> pd.DataFrame:
    """Accuracy by how sure the model was, least confident bucket first.

    Days are ranked by distance from the threshold and cut into equal-sized
    buckets. If accuracy does not rise with confidence, the probabilities are
    not telling you which days to trust.
    """
    actual_up = np.asarray(actual_returns, dtype=float) > 0
    prob = np.asarray(prob_up, dtype=float)
    if actual_up.shape != prob.shape:
        raise ValueError(f"Shape mismatch: {actual_up.shape} vs {prob.shape}")
    confidence = np.abs(prob - threshold)
    # Rank first so ties (a model quoting nearly one value) still give equal buckets.
    bucket = pd.qcut(pd.Series(confidence).rank(method="first"), buckets, labels=False)
    frame = pd.DataFrame({"bucket": bucket + 1, "confidence": confidence, "prob": prob,
                          "called_up": prob > threshold, "actual_up": actual_up})
    frame["correct"] = frame["called_up"] == frame["actual_up"]
    return frame.groupby("bucket").agg(
        days=("correct", "size"),
        mean_prob_up=("prob", "mean"),
        min_confidence=("confidence", "min"),
        accuracy=("correct", "mean"),
        up_call_rate=("called_up", "mean"),
        actual_up_rate=("actual_up", "mean"),
    ).reset_index()


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


def plot_loss(history: dict, path: Path, ylabel: str = "Mean squared error (scaled)") -> Path:
    """Training vs validation loss by epoch. Diverging lines mean memorising."""
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(history["loss"], label="Training loss")
    ax.plot(history["val_loss"], label="Validation loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel(ylabel)
    ax.legend()
    return _save(fig, path)


def plot_walk_forward(
    table: pd.DataFrame, path: Path, highlight: tuple[str, ...] = ("LSTM direction", "LSTM")
) -> Path:
    """Direction accuracy per test year: always-up as the bar to clear, highlighted models in colour.

    Every other model is drawn thin and grey, so the comparison that matters
    stays readable while the rest remain visible for context.
    """
    fig, ax = plt.subplots(figsize=(9, 4.5))
    scored = table.dropna(subset=["direction_accuracy"])
    for model, rows in scored.groupby("model"):
        if model not in highlight:
            ax.plot(rows["year"], rows["direction_accuracy"] * 100, color="lightgrey", linewidth=1, zorder=1)
    if "always_up_rate" in table:
        years = table.groupby("year")["always_up_rate"].first()
        ax.plot(years.index, years * 100, color="black", linestyle="--", linewidth=2, marker="s",
                label="Always up (bar to clear)", zorder=2)
    for model in highlight:
        rows = scored[scored["model"] == model]
        if not rows.empty:
            ax.plot(rows["year"], rows["direction_accuracy"] * 100, marker="o", linewidth=2, label=model, zorder=3)
    ax.plot([], [], color="lightgrey", linewidth=1, label="Other baselines")
    ax.set_xlabel("Test year")
    ax.set_ylabel("Direction accuracy (%)")
    ax.set_title("Walk-forward: direction accuracy per test year")
    ax.legend(fontsize=8)
    return _save(fig, path)


def plot_confidence(table: pd.DataFrame, always_up_rate: float, path: Path, title: str) -> Path:
    """Accuracy per confidence bucket, with the always-up rate as the bar to clear."""
    fig, ax = plt.subplots(figsize=(8, 4.5))
    labels = [f"{b}" for b in table["bucket"]]
    ax.bar(labels, table["accuracy"] * 100)
    ax.axhline(always_up_rate * 100, linestyle="--", color="black", linewidth=1, label="always up")
    ax.axhline(50, linestyle=":", color="grey", linewidth=1, label="coin flip")
    ax.set_xlabel("Confidence bucket (1 = least sure, equal days in each)")
    ax.set_ylabel("Direction accuracy (%)")
    lo = min(table["accuracy"].min(), always_up_rate, 0.5) * 100
    hi = max(table["accuracy"].max(), always_up_rate) * 100
    ax.set_ylim(max(0, lo - 5), min(100, hi + 5))
    ax.set_title(title)
    ax.legend()
    return _save(fig, path)


def plot_up_probability(
    dates: pd.Index, prob_up: np.ndarray, actual_returns: np.ndarray, path: Path, title: str, window: int = 20
) -> Path:
    """The model's rolling up-probability against the rolling share of days that were up."""
    prob = pd.Series(np.asarray(prob_up, dtype=float), index=dates)
    actual = pd.Series((np.asarray(actual_returns, dtype=float) > 0).astype(float), index=dates)
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.plot(dates, actual.rolling(window).mean() * 100, label=f"Actual up-day share, {window}-day", linewidth=1.5)
    ax.plot(dates, prob.rolling(window).mean() * 100, label=f"Model up-probability, {window}-day mean",
            linewidth=1.5, linestyle="--")
    ax.axhline(50, color="grey", linestyle=":", linewidth=1)
    ax.set_xlabel("Forecast made at the close of")
    ax.set_ylabel("Percent")
    ax.set_title(title)
    ax.legend()
    fig.autofmt_xdate()
    return _save(fig, path)


def plot_market_conditions(table: pd.DataFrame, path: Path, title: str) -> Path:
    """Next-day up-rate after each market condition, one bar per period.

    Each period's dashed line is its "Every day" up-rate: the normal rate a
    condition has to differ from. Error bars span one standard error, so a
    bar whose error bar crosses its dashed line is within ordinary noise.
    """
    periods = [c.removesuffix("_up_rate") for c in table.columns if c.endswith("_up_rate")]
    baseline = table.set_index("condition").loc["Every day"]
    fig, ax = plt.subplots(figsize=(9, 0.55 * len(table) + 1.5))
    height = 0.8 / len(periods)
    positions = np.arange(len(table))
    colors = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    for i, period in enumerate(periods):
        rate, days = table[f"{period}_up_rate"], table[f"{period}_days"]
        # Standard error of a share: sqrt(p(1 - p) / n), in percentage points.
        error = np.sqrt(rate * (1 - rate) / days.where(days > 0)) * 100
        ax.barh(positions + i * height, rate * 100, height=height, xerr=error, capsize=2,
                color=colors[i], error_kw={"elinewidth": 0.8, "ecolor": "black"},
                label=f"{period} (every day: {baseline[f'{period}_up_rate']:.1%})")
        ax.axvline(baseline[f"{period}_up_rate"] * 100, color=colors[i], linestyle="--", linewidth=1)
    ax.set_yticks(positions + height * (len(periods) - 1) / 2, table["condition"])
    ax.invert_yaxis()
    ax.set_xlabel("Next-day up-rate (%); error bars = 1 standard error")
    ax.set_xlim(30, 70)
    ax.set_title(title)
    ax.legend(fontsize=8, title="Dashed line = normal up-rate", title_fontsize=8)
    return _save(fig, path)


def _save(fig: plt.Figure, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path
