"""Week-ahead risk on SPY: the walk-forward check, or the one pre-registered test.

--walk-forward scores 2018-2023 only and writes reports/week_ahead_walk_forward.csv;
it never reads the test years and can be rerun.

Without it, this runs the test of PREREGISTRATION_WEEK_AHEAD.md ONCE: it fits on
2010-2023, scores Jan 2024 to the last complete 5-day window, appends the rows to
reports/test_week_ahead_results.csv and writes the model's accuracy by confidence
to reports/week_ahead_confidence_test.csv. It refuses to start unless the
pre-registration is committed and unchanged since that commit, records that
commit with the results, and refuses to run a second time unless given --force.
"""
import argparse
import subprocess

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import append_results
from stock_forecast.week_ahead import MODEL, RULE, final_test_period, most_confident, walk_forward_rows

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--walk-forward", action="store_true", help="score 2018-2023 only; never reads the test years")
parser.add_argument("--force", action="store_true", help="rerun the test even though it has run before")
args = parser.parse_args()
pd.set_option("display.width", 200)
fmt = {"float_format": lambda v: f"{v:.3f}"}

if args.walk_forward:
    table = walk_forward_rows()
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    table.to_csv(config.WEEK_AHEAD_WALK_FORWARD_CSV, index=False)
    print(table[["split", "model", "days", "accuracy", "one_answer_bar", "rule_accuracy", "auc", "brier_skill"]]
          .to_string(index=False, **fmt))
    for model, rows in table.groupby("model", sort=False):
        # The rule is one of the two bars, so it is only compared with the other.
        bar = rows["one_answer_bar"] if model == RULE else rows[["one_answer_bar", "rule_accuracy"]].max(axis=1)
        print(f"{model}: mean accuracy {rows['accuracy'].mean():.1%}, worst year {rows['accuracy'].min():.1%}, "
              f"ahead of {'one answer' if model == RULE else 'both bars'} in {int((rows['accuracy'] > bar).sum())}"
              f" of {len(rows)} years")
    print(f"Wrote {config.WEEK_AHEAD_WALK_FORWARD_CSV}")
    raise SystemExit(0)

if config.TEST_WEEK_AHEAD_CSV.exists() and not args.force:
    raise SystemExit(f"The week-ahead test has already been run ({config.TEST_WEEK_AHEAD_CSV}). "
                     "Use --force only if the team agrees.")
prereg = config.WEEK_AHEAD_PREREGISTRATION


def git(*argv: str) -> str:
    try:
        return subprocess.run(["git", *argv], cwd=config.ROOT, capture_output=True, text=True,
                              check=True).stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Could not check the pre-registration with git ({error}); run the test from a checkout.")


commit = git("log", "-1", "--format=%h", "--", prereg.name)
if not commit or git("status", "--porcelain", "--", prereg.name):
    raise SystemExit(f"Commit {prereg.name} before running the test, and do not change it afterwards: "
                     "the commit is the record that the test was fixed before it was scored.")

rows, buckets = final_test_period()
rows.insert(0, "preregistration_commit", commit)
append_results(rows.to_dict("records"), config.TEST_WEEK_AHEAD_CSV, run="final test: week-ahead risk")
buckets.to_csv(config.WEEK_AHEAD_CONFIDENCE_TEST_CSV, index=False)
print(rows[["model", "first_day", "last_day", "days", "accuracy", "one_answer_bar", "rule_accuracy", "auc",
            "brier_skill", "call_rate", "event_rate"]].to_string(index=False, **fmt))
model = rows.set_index("model").loc[MODEL]
accuracy, share = most_confident(buckets, config.WEEK_AHEAD_CONFIDENT_BUCKETS)
print(f"{MODEL}: {model['accuracy']:.1%} against {model['one_answer_bar']:.1%} for one answer and "
      f"{model['rule_accuracy']:.1%} for '{RULE}'; Brier skill {model['brier_skill']:+.3f}")
print(f"Most confident {share:.0%} of days: {accuracy:.1%}")
print(f"Wrote {config.TEST_WEEK_AHEAD_CSV} and {config.WEEK_AHEAD_CONFIDENCE_TEST_CSV}")
