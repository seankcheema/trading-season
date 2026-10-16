# Reading the charts

A plain-language guide to every chart in this folder. No machine learning background needed.

## The question

Can a computer model tell whether Apple's stock (AAPL) will go **up or down tomorrow**, better than a simple rule?

The simple rule to beat is **"always up"**: guess "up" every single day. Because AAPL rose over most of these years, that rule is usually right a little more than half the time (between 47% and 58%, depending on the year). A model is only useful if it beats that.

## Words used below

| Word | Meaning |
| --- | --- |
| Up-rate | The share of days the stock closed higher than the day before |
| Accuracy | The share of days the model guessed up or down correctly |
| Training years | 2010 to 2021: the history the model learns from |
| Validation years | 2022 and 2023: used to check and tune the model; it never learns from them |
| Test years | 2024 to 2026: kept sealed and used once, at the very end |
| LSTM | The type of neural network used here; it reads the last few weeks of prices in order |
| Noise | Random ups and downs that look like a pattern but are not one |

## The data

**`aapl_price.png`**: AAPL's closing price from 2010 to 2026. It shows the long upward trend, which is why "always up" is a strong rule to beat.

**`aapl_daily_returns.png`**: how much the price moved each day, in percent. Most days sit close to zero, with occasional big jumps (such as the 2020 crash). The model predicts these daily moves, not the price itself, because the price mostly repeats yesterday's value and would make any model look good.

## Market conditions

**`market_conditions.png`**: after a certain kind of day, how often was the next day up?

- Blue bars are the training years, orange bars the validation years.
- The **dashed lines** show the normal up-rate on any day: 53.2% in training, 51.4% in validation. Being above 50% is normal for this stock and not, by itself, a signal.
- The **thin black lines** on each bar show how much the number could move by chance. If a bar's black line crosses its dashed line, the difference may just be noise.

What to take away:

- **After a gain of 2% or more**, the next day was up less often than normal (about 47% in both periods). This is the most consistent pattern, though still small.
- **20-day momentum flipped**: in training, rising stocks kept rising slightly more often; in validation the opposite happened. Patterns from the past do not always carry forward.
- Conditions with few days, such as **volume surge** (28 validation days), are too noisy to trust.

This chart describes history; it is not a forecast.

### Is it mean reversion?

Mean reversion means a big move tends to be partly given back the next day. Two numbers test it, both in the data files rather than the chart.

**Average next-day return** (`market_conditions.csv`, the `_mean_return` columns) weighs how big the moves were, not just whether they were up:

| After | Training, next day | Validation, next day |
| --- | --- | --- |
| Any day (normal) | +0.13% | +0.03% |
| A gain of 2% or more | +0.02% | -0.25% |
| A drop of 2% or more | +0.26% | +0.19% |

Both periods point the same way: big gains were followed by weaker days and big drops by stronger ones. But a single day's return typically varies by about 1.8%, so with only about 57 such days in validation, these differences are within noise there.

**Autocorrelation** (`return_autocorrelation.csv`) measures how much one day's return predicts a later day's, across all days. Negative means moves partly reverse; positive means they continue; zero means no link.

- Training, next day: **-0.053**, about three times its noise level, so a real but tiny reversal effect in 2010 to 2021.
- Validation, next day: **-0.004**, indistinguishable from zero. The effect did not show up in 2022 to 2023.

For a finance audience: AAPL showed mild short-term reversal historically, consistent across both periods in direction, but it is far too small and unstable to trade, especially after costs.

## How the models did

**`direction_accuracy_validation.png`**: accuracy of the simple models on 2022 and 2023, with "always up" marked by the dashed line. Bars to the left of the line did worse than guessing "up" every day.

**`walk_forward.png`**: the most important chart. Each year from 2018 to 2023, the models were retrained on all earlier years and then scored on that one year.

- **Black dashed line**: "always up", the bar to clear.
- **Blue**: the direction LSTM. **Orange**: the earlier LSTM that predicts the size of the move.
- **Grey**: other simple models, for context.

The direction LSTM beat "always up" in only 2 of 6 years, averaging 52.8% against 53.3% for "always up". In other words, **it did not reliably beat the simple rule**, which is an honest and common result for daily stock prediction.

## Inside the direction model

**`direction_probability.png`**: the model gives a probability that tomorrow is up. The dashed line is its average probability over 20 days; the solid line is how often the stock actually went up over the same 20 days. The model's line stays close to 50 to 60% and moves far less than reality, meaning it mostly hedges.

**`direction_confidence_validation.png`**: days are sorted into five equal groups, from the days the model was least sure (1) to the days it was most sure (5). If the model knew when to trust itself, the bars would rise from left to right. They do not: group 1 scored 57% and group 3 scored 50%, so its confidence is not a reliable guide.

**`lstm_direction_loss.png`**: how the model's error changed while it learned. Training error (blue) keeps falling, but validation error (orange) starts rising after about 8 rounds. That means the model began memorising the training years instead of learning something general, so training stopped and the best earlier version was kept.

## The earlier return model

**`lstm_loss.png`**: the same learning chart for the LSTM that predicts the size of tomorrow's move.

**`lstm_lag_check.png`**: predicted next-day price against the actual price. The two lines look very close, but the predicted line is mostly the actual line shifted one day to the right: the model largely repeats today's price. A chart like this looks impressive while showing almost no real skill.

## Charts made after the final test

These appear only once the sealed 2024 to 2026 test has been run:

- **`direction_confidence_test.png`**: the confidence chart for the test years.
- **`direction_probability_test.png`**: the probability chart for the test years.

## The data files

The CSV files hold the numbers behind the charts. `results.csv` and `direction_results.csv` log every experiment, including the bad ones, so nothing can be quietly left out.
