# Pre-registration of the week-ahead risk test

Written on Oct 25, 2026 and committed before the test years (2024-01-01 onward) are scored for this question. The commit that adds this file is the record. It also adds the code that scores the test, `src/stock_forecast/week_ahead.py` and `scripts/0006-test-week-ahead-risk.py`, so both are fixed together. The script refuses to run until this file is committed and unchanged, and it writes that commit into every result row. The test runs once and is reported whatever it says.

This is a second question, not a replacement for the direction and volatility test in [PREREGISTRATION.md](PREREGISTRATION.md). That test keeps its own rules and runs separately.

## Why this question

The team's stated goal is 80% accuracy. Of every question studied, only one reached 80% in walk-forward on real prices: whether the market's realized volatility over the next five trading days will be above its usual level. That result comes from the horizon study (`scripts/extra-horizons.py`, `reports/horizon_comparison.csv`). It was chosen from several windows and two symbols. This test exists because that choice was made on the walk-forward years, so only unseen years can show whether it holds.

## What is frozen

| Item | Value |
| --- | --- |
| Symbol | SPY (`WEEK_AHEAD_SYMBOL`) |
| Question | Is the realized volatility of days t+1 to t+5 (root mean square of the daily returns) above the median of that label over the training rows? |
| Window | 5 trading days (`WEEK_AHEAD_HORIZON`) |
| Data snapshot | `data/spy_daily.csv` (blob `8382f9ed8fb8`), `data/vix_daily.csv` (`d161867ca9e8`), `data/vix9d_daily.csv` (`ad5302cee725`), `data/vix3m_daily.csv` (`4a5bbd6b5072`), `data/vvix_daily.csv` (`bf7147c22c8d`), all ending 2026-09-30 |
| Inputs | `HORIZON_FEATURES` without the market columns, which copy SPY's own returns: today's move size, return, volume change, 10-day volatility, 20-day momentum, VIX level and change, VIX9D/VIX, VIX/VIX3M, VVIX, and VIX minus 20-day realized volatility |
| Model | Logistic regression with standard scaling (`baselines.fit_logistic`), "stormier" when the probability is above 0.5 |
| Fit | Training and validation rows, 2010 to 2023, with the last 5 labels before 2024 dropped because they reach into the test years |
| Threshold | The median label of the training rows (2010 to 2021, last 5 dropped), used unchanged on the test days |
| Scored days | 2024-01-02 to the last day with a complete 5-day window before 2026-09-30 |
| Command | `python scripts/0006-test-week-ahead-risk.py`, once; `--force` is not used |

The LSTM is not tested. In walk-forward it did not beat the logistic regression at windows of 3 days or more.

## Bars scored beside it

- **One answer every day:** the better of "stormier" and "calmer" on the test days. It is chosen in hindsight, which flatters the bar.
- **Same as the last 5 days:** "stormier" when the realized volatility of days t-4 to t is above the same threshold. This is what a client could do without any model.

## What we expect, from walk-forward

Walk-forward 2018 to 2023 (`reports/week_ahead_walk_forward.csv`, `scripts/0006-test-week-ahead-risk.py --walk-forward`):

| Reading | Mean accuracy | Weakest year | Years ahead of both bars |
| --- | --- | --- | --- |
| Logistic regression | 80.6% | 69.6% (2023) | 5 of 6 |
| Same as the last 5 days | 74.3% | 61.0% (2021) | Not applicable |
| Model on its most confident 40% of days | 94.2% | 78.6% (2021) | Not applicable |

The model fell behind in 2022, when 98.8% of days were above the threshold and "always stormier" was the better call.

- Test accuracy between 70% and 85%. Year to year, walk-forward accuracy ran from 69.6% to 93.6%, so a result below 80% is a real possibility.
- Accuracy ahead of both bars, with Brier skill above zero.
- AUC above 0.70, unless one answer covers more than 90% of the test days.

Neighbouring days share four of their five label days, so the test holds about 137 independent weeks, not about 685 independent days. At 80% accuracy, that leaves a 95% margin of roughly 7 points either way.

## What counts as what

- **Skill.** The claim is that the model tells stormier weeks from calmer ones better than both bars. It stands if test accuracy beats both bars and Brier skill is above zero. If accuracy beats both bars but Brier skill is at or below zero, the claim is reduced to "better calls, probabilities not trustworthy". If accuracy does not beat "same as the last 5 days", the claim is withdrawn: the model adds nothing a client could not see from last week.
- **The 80% goal.** It is met only if accuracy over all scored test days is at least 80.0% and the skill claim stands. A result of 80% that does not beat both bars does not meet the goal, because a rule anyone can apply would have done as well.
- **Confident weeks.** The script also reports accuracy on the two most confident fifths of test days (`WEEK_AHEAD_CONFIDENT_BUCKETS`). It is a secondary reading. It is never quoted without the share of days it covers, and it never stands in for the headline accuracy. Many of those days fall in high-fear weeks, when "stormier" is the obvious call.

## What will not happen after the test

- No retraining, and no change to the symbol, window, inputs, threshold, cut-off or split. The command runs once.
- No swap to AAPL, another window or the LSTM to find a better-looking number. Those are new questions and need their own pre-registration and unseen data.
- No new metric chosen because it flatters the result. Any metric added later is reported with the ones above, not instead of them.
- If a bug is found in the scoring code, the fix and the rerun are both reported, with the first result kept in `reports/`.

This test is about the real market. It says nothing about the platform's simulated prices or the Outlook card, which reads a separate model trained on them.
