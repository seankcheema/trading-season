"""Walk-forward testing: does the result hold year after year?

For each test year Y: train on everything up to Y - 2, use Y - 1 for early
stopping (validation), score year Y. Then move one year forward and repeat.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import pandas as pd

from . import config


@dataclass(frozen=True)
class Fold:
    """One walk-forward step."""

    year: int
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def walk_forward_folds(dataset: pd.DataFrame, years: list[int] = config.WALK_FORWARD_YEARS) -> list[Fold]:
    """Build one Fold per test year."""
    folds = []
    for year in years:
        # Use Y-2 and earlier to fit, Y-1 for early stopping, and Y only to score.
        train = dataset.loc[: f"{year - 2}-12-31"]
        val = dataset.loc[f"{year - 1}-01-01" : f"{year - 1}-12-31"]
        test = dataset.loc[f"{year}-01-01" : f"{year}-12-31"]
        for name, part in (("train", train), ("validation", val), ("test", test)):
            if part.empty:
                raise ValueError(f"Walk-forward year {year}: the {name} part is empty")
        folds.append(Fold(year=year, train=train, val=val, test=test))
    return folds


def run_walk_forward(
    dataset: pd.DataFrame,
    evaluate_fold: Callable[[Fold], list[dict]],
    years: list[int] = config.WALK_FORWARD_YEARS,
) -> pd.DataFrame:
    """Run evaluate_fold on every fold; one row per (year, model)."""
    rows = []
    for fold in walk_forward_folds(dataset, years):
        for row in evaluate_fold(fold):
            rows.append({"year": fold.year, **row})
    return pd.DataFrame(rows)
