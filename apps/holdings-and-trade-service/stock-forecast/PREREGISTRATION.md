# Pre-registration of the final test run

Written and committed before the test years (2024-01-01 onward) are scored. The commit that adds this file is the record: everything below was fixed before anyone saw a test number. The test is run once, by the commands in the run order of [README.md](README.md) (steps 11 and 12), and the result is reported whatever it says.

## What is frozen

| Item | Value |
| --- | --- |
| Data snapshot | `data/aapl_daily.csv` (blob `e962f7e75976`, 2010-01-04 to 2026-09-30) and `data/spy_daily.csv` (blob `8382f9ed8fb8`) |
| Split | Train 2010-2021, validation 2022-2023, test 2024 to the end of the snapshot (`config.py`) |
| Direction model | `models/lstm-direction/` (`lstm.keras` blob `97c21e6a99da`, `scalers.joblib` blob `eba92cfba164`); `DIRECTION_FEATURES`, 60-day window, 32 units, "up" when P(up) > 0.5 |
| Volatility model | `models/lstm-volatility/` (`lstm.keras` blob `ffd3ae6be5f2`, `scalers.joblib` blob `66a9c98cc483`); `VOLATILITY_FEATURES`, 60-day window, 64 units, big move = next-day move larger than the training median |
| Baselines scored beside them | The same ones as on validation: always up and the two logistic regressions for direction; the constant big-move rate, "same as today" and the two logistic regressions for volatility |
| Commands | `python scripts/0005-export-scorecard.py --model lstm-direction` and `--model lstm-volatility`, each once; `--force` is not used |

Blob ids are `git hash-object` of each file, so a reviewer can confirm the files the test used are the ones frozen here.

## What we expect, from validation and walk-forward

Direction (validation 2022-2023: 55.3% against 51.3% for always up, AUC 0.57, Brier skill +0.011; walk-forward 2018-2023: 52.8% against 53.3% for always up, 2 of 6 years ahead):

- Test accuracy within three points of the always-up rate on the same days, in either direction.
- AUC between 0.50 and 0.58 and Brier skill within 0.02 of zero.
- "Up" called on more than 75% of days.

Volatility (validation 2022-2023: 62.5% against 55.9% for one answer every day, AUC 0.65, Brier skill +0.079; walk-forward 2018-2023: 60.2% against a 55.4% bar, 4 of 6 years ahead):

- Test accuracy above the one-answer bar on the same days.
- AUC above 0.60 and Brier skill above zero.

## What counts as what

- Direction: no claim of skill is made in advance, and none will be made afterwards unless the test beats always up by more than three points with Brier skill above zero. The expected outcome is a reported negative: the model does not reliably tell up days from down days.
- Volatility: the claim is that the model tells big-move days from calm ones better than a constant answer. It stands if test accuracy beats the one-answer bar and Brier skill is above zero. If accuracy beats the bar but Brier skill is at or below zero, the claim is reduced to "better than constant, probabilities not trustworthy". If accuracy does not beat the bar, the claim is withdrawn.
- The buy signal ([reports/README.md](reports/README.md), "Would it tell a client to buy?") is not scored on the test years. Its walk-forward verdict, no usable signal, stands.

## What will not happen after the test

- No retraining, no change to features, windows, units, thresholds or the split, and no second run of either command.
- No swap of symbol, model or baseline to find a better-looking comparison.
- No new metric chosen because it flatters the result. Any metric added later is reported with the ones above, not instead of them.
- If a bug is found in the scoring code, the fix and the rerun are both reported, with the first result kept in `reports/`.

The scorecard the client UI reads is written from the direction test in the same run, with the always-up rate beside the model's accuracy, so the card cannot show one without the other.
