"""Write the Trend card's scorecard.json.

--placeholder writes the stand-in the UI is built against (all zeros).
Otherwise this runs the chosen model on the test set ONCE, records the
numbers in reports/test_results.csv, and writes the real scorecard. It
refuses to run the test a second time unless you pass --force, because a
test set you can rerun until you like the answer is no longer a test.
"""
import argparse

import _bootstrap  # noqa: F401

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import append_results, direction_accuracy, rmse, score, up_from_returns
from stock_forecast.pipeline import final_test_prediction, load_dataset
from stock_forecast.scorecard import build_scorecard, placeholder_scorecard, write_scorecard

parser = argparse.ArgumentParser(description=__doc__)
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument("--placeholder", action="store_true")
group.add_argument("--model", choices=["lstm", "var", "linear"],
                   help="a model that forecasts returns, so the card can compare its error with the naive forecast")
parser.add_argument("--force", action="store_true", help="rerun the test even though it has run before")
args = parser.parse_args()

if args.placeholder:
    # This path creates UI scaffolding without fitting or touching the test set.
    print(f"Wrote {write_scorecard(placeholder_scorecard())}")
    raise SystemExit(0)

if config.TEST_RESULTS_CSV.exists() and not args.force:
    raise SystemExit(f"The test set has already been run ({config.TEST_RESULTS_CSV}). Use --force only if the team agrees.")

# Only after model selection: this is the one final evaluation on 2024–2026.
splits = split_by_date(load_dataset())
name, prediction = final_test_prediction(args.model, splits)
actual = splits.test["target"].to_numpy()
predicted_up = prediction.up if prediction.up is not None else up_from_returns(prediction.returns)
naive_rmse = rmse(actual, [0.0] * len(actual))
row = score(name, actual, prediction.returns, predicted_up, split="test")
append_results([row, score("Naive (return = 0)", actual, [0.0] * len(actual), split="test", include_direction=False)],
               config.TEST_RESULTS_CSV, run=f"final test: {args.model}")

card = build_scorecard(
    symbol=config.TICKER,
    model=name,
    test_start=str(splits.test.index.min().date()),
    test_end=str(splits.test.index.max().date()),
    direction_accuracy=direction_accuracy(actual, predicted_up),
    always_up_accuracy=float((actual > 0).mean()),
    model_return_rmse=row["return_rmse"],
    naive_return_rmse=naive_rmse,
)
print(card)
print(f"Wrote {write_scorecard(card)}")
