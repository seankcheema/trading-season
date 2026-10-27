"""Does the rest of the VIX family, or the fear-vs-reality gap, improve the big-move model?

Compares VIX_FEATURES, VIX_FAMILY_FEATURES (adding the 9-day/30-day and
30-day/3-month VIX ratios and VVIX) and VIX_GAP_FEATURES (adding VIX minus
realized market volatility) for the logistic regression and the LSTM, plus
the average of the two models with every input, on identical walk-forward
days. Every variant drops the rows before VIX9D's first day (Jan 2011) and
the gap's warm-up.
"""
from __future__ import annotations

import pandas as pd

from . import config
from .data import add_earnings, add_vix_family, add_vix_gap, load_earnings, load_prices
from .pipeline import big_move_days, big_move_threshold, volatility_baselines, volatility_lstm_predictions
from .pooled import vix_dataset
from .symbols import _rows, inputs_for
from .walk_forward import walk_forward_folds


def vix_family_dataset(symbol: str) -> pd.DataFrame:
    frames = {ticker: load_prices(path) for ticker, path in config.VIX_FAMILY_CSVS.items()}
    # The gap is added for every variant, so all of them use the same rows.
    data = add_vix_gap(add_vix_family(vix_dataset(symbol), frames["^VIX9D"], frames["^VIX3M"], frames["^VVIX"]))
    path = config.EARNINGS_CSVS.get(symbol)
    # Earnings only apply to single companies with saved dates; the flag adds no rows or gaps.
    return add_earnings(data, load_earnings(path)) if path is not None and path.exists() else data


def vix_family_rows(symbols: list[str] = config.VIX_FAMILY_SYMBOLS, verbose: int = 0) -> list[dict]:
    """Walk-forward rows per symbol and model variant; adds an earnings variant where dates are saved.

    Never reads the test years.
    """
    rows = []
    for symbol in symbols:
        for fold in walk_forward_folds(vix_family_dataset(symbol)):
            threshold = big_move_threshold(fold.train)
            seen = pd.concat([fold.train, fold.val])
            probs = {}
            variants = [("VIX", config.VIX_FEATURES), ("VIX family", config.VIX_FAMILY_FEATURES),
                        ("VIX family + gap", config.VIX_GAP_FEATURES)]
            if "earnings_next" in fold.test:
                variants.append(("VIX family + gap + earnings", config.EARNINGS_FEATURES))
            for label, features in variants:
                cols = inputs_for(symbol, features)
                probs[f"Logistic regression + {label}"] = volatility_baselines(
                    seen, fold.test, threshold, feature_cols=cols)["Logistic regression (indicators)"]
                print(f"[walk-forward {fold.year}] {symbol}: training LSTM + {label}", flush=True)
                probs[f"LSTM + {label}"] = volatility_lstm_predictions(
                    fold.train, fold.val, fold.test, history=fold.val, threshold=threshold, feature_cols=cols,
                    verbose=verbose).prob_up
            best = variants[-1][0]
            probs[f"Average of both + {best}"] = (probs[f"Logistic regression + {best}"] + probs[f"LSTM + {best}"]) / 2
            actual = big_move_days(fold.test, threshold)
            base_rate = float(big_move_days(seen.iloc[:-1], threshold).mean())
            rows += _rows(symbol, "volatility", f"walk-forward {fold.year}", probs, actual, base_rate,
                          float(max(actual.mean(), 1 - actual.mean())))
    return rows
