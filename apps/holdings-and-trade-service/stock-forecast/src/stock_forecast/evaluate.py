"""Metrics, the results log and the charts for the presentation."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # write image files; never open windows
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Matplotlib placement names shared by several charts.
OFFSET_POINTS = "offset points"
UPPER_LEFT = "upper left"


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


def event_metrics(
    actual_event: np.ndarray, prob: np.ndarray, base_rate: float, threshold: float = 0.5
) -> dict:
    """Score the probabilities of a yes/no event, not just the calls made from them.

    base_rate is the event's training share: quoting it every day is the
    no-information forecast. brier_skill above 0 means the model's
    probabilities beat that constant; at or below 0 it learned nothing usable.
    call_rate shows when a model has collapsed into calling one answer every day.
    """
    actual = np.asarray(actual_event, dtype=bool)
    prob = np.asarray(prob, dtype=float)
    if actual.shape != prob.shape:
        raise ValueError(f"Shape mismatch: {actual.shape} vs {prob.shape}")
    if np.isnan(prob).any() or (prob < 0).any() or (prob > 1).any():
        raise ValueError("Probabilities must be between 0 and 1 with no NaN")
    called = prob > threshold
    # Clip only for the log, so a confident miss costs a lot but stays finite.
    clipped = np.clip(prob, 1e-7, 1 - 1e-7)
    brier = float(np.mean((prob - actual) ** 2))
    base_brier = float(np.mean((base_rate - actual) ** 2))
    yes_days, no_days = actual.sum(), (~actual).sum()
    return {
        "accuracy": float(np.mean(called == actual)),
        # Mean of the yes-day and no-day hit rates: 0.5 for any constant call.
        "balanced_accuracy": float(np.mean([
            called[actual].mean() if yes_days else np.nan,
            (~called[~actual]).mean() if no_days else np.nan,
        ])),
        "call_rate": float(called.mean()),
        "event_rate": float(actual.mean()),
        "auc": _auc(actual, prob),
        "brier": brier,
        "brier_skill": 1 - brier / base_brier if base_brier > 0 else float("nan"),
        "log_loss": float(-np.mean(actual * np.log(clipped) + (~actual) * np.log(1 - clipped))),
    }


def direction_metrics(
    actual_returns: np.ndarray, prob_up: np.ndarray, base_rate: float, threshold: float = 0.5
) -> dict:
    """event_metrics for "tomorrow is up", with the direction column names used in the reports.

    base_rate is the training up-share; up_call_rate near 1 means the model
    has collapsed into calling "up" every day.
    """
    metrics = event_metrics(np.asarray(actual_returns, dtype=float) > 0, prob_up, base_rate, threshold)
    return _rename(metrics, {"accuracy": "direction_accuracy", "call_rate": "up_call_rate",
                             "event_rate": "actual_up_rate"})


def _rename(row: dict, names: dict) -> dict:
    return {names.get(key, key): value for key, value in row.items()}


def _auc(actual_up: np.ndarray, prob: np.ndarray) -> float:
    """Chance a random up day got a higher probability than a random down day (0.5 = no skill)."""
    if actual_up.all() or not actual_up.any():
        return float("nan")
    ranks = pd.Series(prob).rank().to_numpy()  # ties share an average rank
    n_up, n_down = actual_up.sum(), (~actual_up).sum()
    return float((ranks[actual_up].sum() - n_up * (n_up + 1) / 2) / (n_up * n_down))


def event_confidence_buckets(
    actual_event: np.ndarray, prob: np.ndarray, buckets: int = 5, threshold: float = 0.5
) -> pd.DataFrame:
    """Accuracy by how sure the model was, least confident bucket first.

    Days are ranked by distance from the threshold and cut into equal-sized
    buckets. If accuracy does not rise with confidence, the probabilities are
    not telling you which days to trust.
    """
    actual = np.asarray(actual_event, dtype=bool)
    prob = np.asarray(prob, dtype=float)
    if actual.shape != prob.shape:
        raise ValueError(f"Shape mismatch: {actual.shape} vs {prob.shape}")
    confidence = np.abs(prob - threshold)
    # Rank first so ties (a model quoting nearly one value) still give equal buckets.
    bucket = pd.qcut(pd.Series(confidence).rank(method="first"), buckets, labels=False)
    frame = pd.DataFrame({"bucket": bucket + 1, "confidence": confidence, "prob": prob,
                          "called": prob > threshold, "actual": actual})
    frame["correct"] = frame["called"] == frame["actual"]
    return frame.groupby("bucket").agg(
        days=("correct", "size"),
        mean_prob=("prob", "mean"),
        min_confidence=("confidence", "min"),
        accuracy=("correct", "mean"),
        call_rate=("called", "mean"),
        event_rate=("actual", "mean"),
    ).reset_index()


def confidence_buckets(
    actual_returns: np.ndarray, prob_up: np.ndarray, buckets: int = 5, threshold: float = 0.5
) -> pd.DataFrame:
    """event_confidence_buckets for "tomorrow is up", with direction column names."""
    table = event_confidence_buckets(np.asarray(actual_returns, dtype=float) > 0, prob_up, buckets, threshold)
    return table.rename(columns={"mean_prob": "mean_prob_up", "call_rate": "up_call_rate",
                                 "event_rate": "actual_up_rate"})


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
    ax.annotate("always up", (always_up_rate * 100, len(rows) - 0.5), xytext=(4, 0), textcoords=OFFSET_POINTS)
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
    table: pd.DataFrame, path: Path, highlight: tuple[str, ...] = ("LSTM direction", "LSTM"),
    metric: str = "direction_accuracy", title: str = "Walk-forward: direction accuracy per test year",
) -> Path:
    """Accuracy per test year: highlighted models in colour, plus always-up when the table has its rate.

    Every other model is drawn thin and grey, so the comparison that matters
    stays readable while the rest remain visible for context.
    """
    fig, ax = plt.subplots(figsize=(9, 4.5))
    scored = table.dropna(subset=[metric])
    for model, rows in scored.groupby("model"):
        if model not in highlight:
            ax.plot(rows["year"], rows[metric] * 100, color="lightgrey", linewidth=1, zorder=1)
    if "always_up_rate" in table:
        years = table.groupby("year")["always_up_rate"].first()
        ax.plot(years.index, years * 100, color="black", linestyle="--", linewidth=2, marker="s",
                label="Always up (bar to clear)", zorder=2)
    for model in highlight:
        rows = scored[scored["model"] == model]
        if not rows.empty:
            ax.plot(rows["year"], rows[metric] * 100, marker="o", linewidth=2, label=model, zorder=3)
    ax.plot([], [], color="lightgrey", linewidth=1, label="Other baselines")
    ax.set_xlabel("Test year")
    ax.set_ylabel(f"{metric.replace('_', ' ').capitalize()} (%)")
    ax.set_title(title)
    ax.legend(fontsize=8)
    return _save(fig, path)


def plot_confidence(
    table: pd.DataFrame, always_up_rate: float, path: Path, title: str, baseline_label: str = "always up",
    ylabel: str = "Direction accuracy (%)", event_rate_label: str | None = "share of days that went up",
) -> Path:
    """Accuracy per confidence bucket, with a constant-answer rate as the bar to clear.

    When the table has each bucket's event rate (actual_up_rate or event_rate)
    it is drawn as a marker on every bar: a bar that merely tracks its marker
    shows a model that calls the event every day, not one that knows when.
    """
    fig, ax = plt.subplots(figsize=(8, 4.5))
    labels = [f"{b}" for b in table["bucket"]]
    ax.bar(labels, table["accuracy"] * 100, label="accuracy")
    rate_col = next((c for c in ("actual_up_rate", "event_rate") if c in table), None)
    if event_rate_label and rate_col:
        ax.scatter(labels, table[rate_col] * 100, color="black", marker="_", s=400, linewidths=2, zorder=3,
                   label=event_rate_label)
    ax.axhline(always_up_rate * 100, linestyle="--", color="black", linewidth=1, label=baseline_label)
    ax.axhline(50, linestyle=":", color="grey", linewidth=1, label="coin flip")
    ax.set_xlabel("Confidence bucket (1 = least sure, equal days in each)")
    ax.set_ylabel(ylabel)
    rates = table[rate_col] if rate_col and event_rate_label else table["accuracy"]
    lo = min(table["accuracy"].min(), rates.min(), always_up_rate, 0.5) * 100
    hi = max(table["accuracy"].max(), rates.max(), always_up_rate) * 100
    ax.set_ylim(max(0, lo - 5), min(100, hi + 5))
    ax.set_title(title)
    ax.legend()
    return _save(fig, path)


def plot_buy_signal(walk: pd.DataFrame, path: Path, title: str) -> Path:
    """Per walk-forward year: how often each model's flagged days went up, against every day's up-rate.

    A year with no flagged days gets no bar. The day count sits on each bar
    so a high rate on a handful of days is not mistaken for a result.
    """
    years = sorted(walk["year"].unique())
    models = list(dict.fromkeys(walk["model"]))
    width = 0.8 / max(len(models), 1)
    fig, ax = plt.subplots(figsize=(9, 4.5))
    x = np.arange(len(years))
    for i, model in enumerate(models):
        rows = walk[walk["model"] == model].set_index("year").reindex(years)
        offset = x + (i - (len(models) - 1) / 2) * width
        ax.bar(offset, rows["hit_rate"] * 100, width, color=_model_color(model), label=f"{model}: flagged days up")
        for xi, (rate, n) in zip(offset, zip(rows["hit_rate"], rows["signals"])):
            if n > 0:
                ax.annotate(f"{int(n)} d", (xi, rate * 100), xytext=(0, 2), textcoords=OFFSET_POINTS,
                            ha="center", fontsize=7)
    up = walk.groupby("year")["up_rate"].first().reindex(years)
    ax.scatter(x, up * 100, color="black", marker="_", s=600, linewidths=2, zorder=3, label="every day's up-rate (bar to clear)")
    ax.set_xticks(x, [str(y) for y in years])
    ax.set_xlabel("Test year (cutoff chosen on the year before)")
    ax.set_ylabel("Share of days that went up (%)")
    lo = np.nanmin([walk["hit_rate"].min(), up.min()]) * 100
    hi = np.nanmax([walk["hit_rate"].max(), up.max()]) * 100
    # Head-room above the tallest bar keeps the legend off the bars.
    ax.set_ylim(max(0, lo - 8), min(100, hi + 14))
    ax.set_title(title)
    ax.legend(fontsize=8, loc=UPPER_LEFT)
    return _save(fig, path)


def plot_platform_calibration(summary: pd.DataFrame, path: Path, title: str, bar_variant: str) -> Path:
    """Accuracy per platform symbol, one bar per variant, with the one-answer rule's accuracy as the mark to clear."""
    symbols = list(dict.fromkeys(summary["symbol"]))
    variants = [v for v in dict.fromkeys(summary["variant"]) if v != bar_variant]
    width = 0.8 / max(len(variants), 1)
    fig, ax = plt.subplots(figsize=(11, 4.8))
    x = np.arange(len(symbols))
    for i, variant in enumerate(variants):
        rows = summary[summary["variant"] == variant].set_index("symbol").reindex(symbols)
        # One colour per variant from the default cycle: three variants here start with "LSTM".
        ax.bar(x + (i - (len(variants) - 1) / 2) * width, rows["accuracy"] * 100, width, label=variant)
    bar = summary[summary["variant"] == bar_variant].set_index("symbol").reindex(symbols)["accuracy"]
    ax.scatter(x, bar * 100, color="black", marker="_", s=500, linewidths=2, zorder=3, label=f"{bar_variant} (bar to clear)")
    ax.set_xticks(x, symbols)
    ax.set_ylabel("Big-move accuracy (%)")
    ax.set_ylim(max(0, (summary["accuracy"].min() * 100) - 8), min(100, summary["accuracy"].max() * 100 + 16))
    ax.set_title(title)
    ax.legend(fontsize=7, loc=UPPER_LEFT, ncol=2)
    return _save(fig, path)


def plot_event_probability(
    dates: pd.Index, prob: np.ndarray, actual_event: np.ndarray, path: Path, title: str,
    event: str = "up-day", window: int = 20,
) -> Path:
    """The model's rolling event probability against the rolling share of days the event happened."""
    prob = pd.Series(np.asarray(prob, dtype=float), index=dates)
    actual = pd.Series(np.asarray(actual_event, dtype=bool).astype(float), index=dates)
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.plot(dates, actual.rolling(window).mean() * 100, label=f"Actual {event} share, {window}-day", linewidth=1.5)
    ax.plot(dates, prob.rolling(window).mean() * 100, label=f"Model {event} probability, {window}-day mean",
            linewidth=1.5, linestyle="--")
    ax.axhline(50, color="grey", linestyle=":", linewidth=1)
    ax.set_xlabel("Forecast made at the close of")
    ax.set_ylabel("Percent")
    ax.set_title(title)
    ax.legend()
    fig.autofmt_xdate()
    return _save(fig, path)


def plot_up_probability(
    dates: pd.Index, prob_up: np.ndarray, actual_returns: np.ndarray, path: Path, title: str, window: int = 20
) -> Path:
    """The model's rolling up-probability against the rolling share of days that were up."""
    return plot_event_probability(dates, prob_up, np.asarray(actual_returns, dtype=float) > 0, path, title,
                                  event="up-day", window=window)


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


def plot_symbol_comparison(summary: pd.DataFrame, path: Path, title: str) -> Path:
    """Walk-forward average accuracy per symbol, one panel per task, with each symbol's bar to clear."""
    tasks = list(dict.fromkeys(summary["task"]))
    bars = summary.groupby("task").size().max()  # symbols x models in the busiest panel
    fig, axes = plt.subplots(1, len(tasks), figsize=(max(5.0, 2 + 0.3 * bars) * len(tasks), 4.5), squeeze=False)
    for ax, task in zip(axes[0], tasks):
        rows = summary[summary["task"] == task]
        symbols = list(dict.fromkeys(rows["symbol"]))
        models = list(dict.fromkeys(rows["model"]))
        width = 0.8 / len(models)
        for i, model in enumerate(models):
            # A symbol not yet run with this model gets no bar rather than an error.
            values = [rows[(rows["symbol"] == s) & (rows["model"] == model)]["accuracy"].mean() * 100 for s in symbols]
            ax.bar(np.arange(len(symbols)) + (i - (len(models) - 1) / 2) * width, values, width=width, label=model,
                   color=_model_color(model))
        for j, symbol in enumerate(symbols):
            bar = rows[rows["symbol"] == symbol]["bar_to_clear"].iloc[0] * 100
            ax.hlines(bar, j - 0.45, j + 0.45, colors="black", linestyles="--", linewidth=1.5,
                      label="Bar to clear" if j == 0 else None)
        ax.set_xticks(np.arange(len(symbols)), symbols)
        ax.set_ylim(40, 70)
        ax.set_ylabel("Walk-forward average accuracy (%)")
        ax.set_title(task.capitalize())
        if len(models) > 3:
            # Many variants: keep the legend beside the bars instead of over them.
            ax.legend(fontsize=8, loc=UPPER_LEFT, bbox_to_anchor=(1.01, 1), borderaxespad=0)
        else:
            ax.legend(fontsize=8, loc=UPPER_LEFT)
    fig.suptitle(title)
    return _save(fig, path)


def plot_platform_demo(table: pd.DataFrame, path: Path, title: str) -> Path:
    """Accuracy on the simulated platform prices, one panel per task, AUC printed on each bar."""
    panels = [("direction", None), ("volatility", "as trained"), ("volatility", "recalibrated")]
    fig, axes = plt.subplots(1, len(panels), figsize=(14, 4.8))
    for ax, (task, variant) in zip(axes, panels):
        rows = table[table["task"] == task]
        if variant is not None:
            rows = rows[rows["variant"] == variant]
        # The direction panel holds both LSTM variants, so name the variant there.
        labels = [f"{m}\n({v})" if task == "direction" and v != "rule" else m
                  for m, v in zip(rows["model"], rows["variant"])]
        colors = ["#2f5bd3" if m.startswith("LSTM") else "#9aa3ad" for m in rows["model"]]
        bars = ax.bar(range(len(rows)), rows["accuracy"] * 100, color=colors)
        for bar, auc in zip(bars, rows["auc"]):
            if pd.notna(auc):
                ax.annotate(f"AUC {auc:.2f}", (bar.get_x() + bar.get_width() / 2, bar.get_height()),
                            xytext=(0, 3), textcoords=OFFSET_POINTS, ha="center", fontsize=8)
        ax.set_xticks(range(len(rows)), labels, rotation=20, ha="right", fontsize=8)
        ax.set_ylim(40, 90)
        ax.axhline(50, color="grey", linestyle=":", linewidth=1)
        ax.set_ylabel("Accuracy (%)")
        if task == "direction":
            ax.set_title("Direction")
        else:
            cut = rows["threshold"].iloc[0]
            ax.set_title(f"Big moves, {variant} (over {cut:.2%})")
    fig.suptitle(title)
    return _save(fig, path)


def plot_spike(daily: pd.DataFrame, spikes: list, path: Path, title: str, start: str, end: str) -> Path:
    """The model's daily big-move probability against the moves that happened, scheduled spikes shaded."""
    window = daily.loc[start:end]
    fig, ax = plt.subplots(figsize=(11, 4.5))
    ax.bar(window.index, window["move"] * 100, color=["#d98a2b" if b else "#c9ced6" for b in window["big"]],
           width=0.8, label="Actual move that day (%), orange = big move")
    ax.set_ylabel("Actual move (%)")
    twin = ax.twinx()
    twin.plot(window.index, window["prob_big"] * 100, color="#2f5bd3", linewidth=2, label="Model's big-move probability")
    twin.set_ylabel("Big-move probability (%)")
    twin.set_ylim(0, 100)
    for spike_id, first, last in spikes:
        if first <= window.index.max() and last >= window.index.min():
            ax.axvspan(first - pd.Timedelta(hours=12), last + pd.Timedelta(hours=12), color="#e45756", alpha=0.12,
                       label="Scheduled volatility spike")
    handles = ax.get_legend_handles_labels()[0] + twin.get_legend_handles_labels()[0]
    labels = ax.get_legend_handles_labels()[1] + twin.get_legend_handles_labels()[1]
    ax.legend(handles, labels, fontsize=8, loc=UPPER_LEFT)
    ax.set_title(title)
    fig.autofmt_xdate()
    return _save(fig, path)


def _model_color(model: str) -> str:
    """One colour family per kind of model, so the same kind matches across panels; "+ VIX" is darker."""
    vix = model.endswith("+ VIX")
    if model.startswith("LSTM, all stocks"):
        return "#1c7a55" if vix else "#5cbf90"
    if model.startswith("LSTM"):
        return "#1f3f9a" if vix else "#2f5bd3"
    if model.startswith("Logistic"):
        return "#a35f12" if vix else "#d98a2b"
    return "#9aa3ad"


def _save(fig: plt.Figure, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path
