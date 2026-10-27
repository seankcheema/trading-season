"""Write the Trend card's scorecard.json.

--placeholder writes the stand-in the UI is built against (all zeros).
Otherwise this runs the chosen model on the test set ONCE, records the
numbers in reports/test_results.csv, and writes the real scorecard. It
refuses to run the test a second time unless you pass --force, because a
test set you can rerun until you like the answer is no longer a test.

--model lstm-volatility runs the big-move model's one test instead. It
writes reports/test_volatility_results.csv and its charts, has its own
run-once guard, and leaves scorecard.json alone: the card shows direction.
"""
import argparse

import _bootstrap  # noqa: F401

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import (append_results, confidence_buckets, direction_accuracy, event_confidence_buckets,
                                     plot_confidence, plot_event_probability, plot_up_probability, rmse, score,
                                     up_from_returns)
from stock_forecast.pipeline import (big_move_days, direction_baselines, direction_row, final_test_prediction,
                                     final_volatility_prediction, load_dataset, load_direction_dataset,
                                     training_up_rate, volatility_baselines, volatility_row)
from stock_forecast.scorecard import build_scorecard, placeholder_scorecard, write_scorecard

parser = argparse.ArgumentParser(description=__doc__)
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument("--placeholder", action="store_true")
group.add_argument("--model", choices=["lstm-direction", "lstm", "var", "linear", "lstm-volatility"],
                   help="lstm-direction predicts up/down only, so its card has no return RMSE; "
                        "lstm-volatility writes test results but no scorecard")
parser.add_argument("--force", action="store_true", help="rerun the test even though it has run before")
args = parser.parse_args()

if args.placeholder:
    # This path creates UI scaffolding without fitting or touching the test set.
    print(f"Wrote {write_scorecard(placeholder_scorecard())}")
    raise SystemExit(0)

if args.model == "lstm-volatility":
    if config.TEST_VOLATILITY_CSV.exists() and not args.force:
        raise SystemExit(f"The volatility test has already been run ({config.TEST_VOLATILITY_CSV}). "
                         "Use --force only if the team agrees.")
    splits = split_by_date(load_direction_dataset())
    name, prob, threshold = final_volatility_prediction(splits)
    actual = big_move_days(splits.test, threshold)
    base_rate = float(big_move_days(splits.train.iloc[:-1], threshold).mean())
    probs = {name: prob, **volatility_baselines(splits.train, splits.test, threshold)}
    rows = [{**volatility_row(n, actual, p, base_rate, "test"), "threshold": threshold} for n, p in probs.items()]
    append_results(rows, config.TEST_VOLATILITY_CSV, run="final test: lstm-volatility")
    buckets = event_confidence_buckets(actual, prob, config.CONFIDENCE_BUCKETS, config.DIRECTION_THRESHOLD)
    buckets.to_csv(config.REPORTS_DIR / "volatility_confidence_test.csv", index=False)
    plot_confidence(buckets, max(actual.mean(), 1 - actual.mean()),
                    config.REPORTS_DIR / "volatility_confidence_test.png",
                    "LSTM volatility: accuracy by confidence, test", baseline_label="one answer every day", ylabel="Big-move accuracy (%)",
                    event_rate_label="share of big-move days")
    plot_event_probability(splits.test.index, prob, actual, config.REPORTS_DIR / "volatility_probability_test.png",
                           "LSTM volatility: predicted vs actual big-move days, test", event="big-move day")
    for r in rows:
        print(f"{r['model']}: accuracy {r['accuracy']:.1%}, AUC {r['auc']:.3f}, brier skill {r['brier_skill']:+.4f}")
    raise SystemExit(0)

if config.TEST_RESULTS_CSV.exists() and not args.force:
    raise SystemExit(f"The test set has already been run ({config.TEST_RESULTS_CSV}). Use --force only if the team agrees.")

# Only after model selection: this is the one final evaluation on 2024–2026.
is_direction = args.model == "lstm-direction"
splits = split_by_date(load_direction_dataset() if is_direction else load_dataset())
name, prediction = final_test_prediction(args.model, splits)
actual = splits.test["target"].to_numpy()
predicted_up = prediction.up if prediction.up is not None else up_from_returns(prediction.returns)
naive_rmse = rmse(actual, [0.0] * len(actual))
row = score(name, actual, prediction.returns, predicted_up, split="test")
append_results([row, score("Naive (return = 0)", actual, [0.0] * len(actual), split="test", include_direction=False)],
               config.TEST_RESULTS_CSV, run=f"final test: {args.model}")

if is_direction:
    # Score the direction baselines on the same test days, fitted on train only as in validation.
    base_rate = training_up_rate(splits.train)
    probs = {name: prediction.prob_up, **direction_baselines(splits.train, splits.test, history=splits.val)}
    rows = [direction_row(n, actual, p, base_rate, "test") for n, p in probs.items()]
    append_results(rows, config.TEST_DIRECTION_CSV, run=f"final test: {args.model}")
    buckets = confidence_buckets(actual, prediction.prob_up, config.CONFIDENCE_BUCKETS, config.DIRECTION_THRESHOLD)
    buckets.to_csv(config.REPORTS_DIR / "direction_confidence_test.csv", index=False)
    plot_confidence(buckets, float((actual > 0).mean()), config.REPORTS_DIR / "direction_confidence_test.png",
                    "LSTM direction: accuracy by confidence, test")
    plot_up_probability(splits.test.index, prediction.prob_up, actual,
                        config.REPORTS_DIR / "direction_probability_test.png",
                        "LSTM direction: predicted vs actual up-days, test")
    for r in rows:
        print(f"{r['model']}: accuracy {r['direction_accuracy']:.1%}, brier skill {r['brier_skill']:+.4f}")

card = build_scorecard(
    symbol=config.TICKER,
    model=name,
    test_start=str(splits.test.index.min().date()),
    test_end=str(splits.test.index.max().date()),
    direction_accuracy=direction_accuracy(actual, predicted_up),
    always_up_accuracy=float((actual > 0).mean()),
    model_return_rmse=row["return_rmse"],  # None for a direction-only model
    naive_return_rmse=naive_rmse,
)
print(card)
print(f"Wrote {write_scorecard(card)}")
