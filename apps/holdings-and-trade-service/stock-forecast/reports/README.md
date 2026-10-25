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

**`direction_confidence_validation.png`**: days are sorted into five equal groups, from the days the model was least sure (1) to the days it was most sure (5). If the model knew when to trust itself, the bars would rise from left to right. They do not: group 1 scored 57% and group 3 scored 50%, so its confidence is not a reliable guide. The black mark on each bar is the share of that group's days that actually went up. From group 3 on, the model says "up" on more than 90% of days, so its bar can only match its mark: group 5's 62% is the 63% of those days that went up, not skill. The only groups where the bar clears the mark are 1 and 2, where the model still says "down" on about a third of days and is right more often than not.

**`lstm_direction_loss.png`**: how the model's error changed while it learned. Training error (blue) keeps falling, but validation error (orange) starts rising after about 8 rounds. That means the model began memorising the training years instead of learning something general, so training stopped and the best earlier version was kept.

## Would it tell a client to buy?

**`buy_signal.csv`**: a "buy" flag goes up on days the model's probability of an up day is at or above a cutoff, such as 58%. The cutoff for each year is picked using only the year before, then tested on the year itself. A flag is useful only if flagged days go up more often than an ordinary day, because buying every day already catches every up day.

**`buy_signal.png`**: one pair of bars per year. Each bar is the share of a model's flagged days that went up, with the number of flagged days written on it; the black mark is the share of every day that year that went up, the bar to clear. A bar below its mark means a client following the flags would have picked worse days than buying at random.

The direction LSTM's flagged days beat an ordinary day in 4 of 6 years (2018-2023), but only by about one point on average: 258 of its 464 flagged days went up, against 253 expected from each year's up-rate (`buy_signal_summary.csv`). If flagging were pure luck, a surplus at least that large would happen one time in three (p = 0.33), so it is not evidence of skill. The best cutoff also moved from year to year (52% to 58%), so there is no stable rule. The simpler indicator regression did worse: no flags at all in two years, a better-than-ordinary result in only 2 of 6, and fewer hits than luck predicts (p = 0.68).

The validation row shows a 62% cutoff with 77% of 26 flagged days going up. Those are the same days the cutoff was picked on, so that number flatters the rule and is not evidence. **The model is not good enough to tell a client to buy, and the platform does not do so.**

## Predicting big-move days instead

Because up-or-down turned out to be close to a coin flip, a second model asks an easier, well-known question: **will tomorrow be a big-move day?** A big-move day is one where the price moves more than 0.87% in either direction, which is the typical move size in the training years, so about half of training days qualify.

This works better because calm and stormy periods tend to last for weeks. A model that has seen the last few weeks can tell which kind of period it is in, even though it cannot tell which way the price will go.

**`volatility_probability.png`**: the solid line is how often recent days were big-move days; the dashed line is the model's average forecast. Unlike the direction chart, the two lines move together: the model sees calm and stormy stretches coming.

**`volatility_confidence_validation.png`**: the same five confidence groups as before. Here the model's most confident days were right 70 to 76% of the time, so its confidence is a useful guide. The dashed line is the score from giving the same answer every day.

**`walk_forward_volatility.png`**: accuracy each test year from 2018 to 2023, retrained each year. Blue is the LSTM, orange the strongest simple model, green "same as today" (copy today's answer). The LSTM averaged 60% and was above 50% every year. In 2020 and 2022, about two-thirds of days were big-move days, so simply answering "big" every day scored higher (the grey peaks). Even then, the model's probabilities beat the historical rate in all six years, meaning it still told stormy days from calm ones better than a fixed guess.

**`lstm_volatility_loss.png`**: the learning chart for this model, read the same way as the direction one.

What it means: the model is a reasonable gauge of **how much** AAPL is likely to move, not **which way**. That is useful for risk (for example, sizing a position smaller before a likely big-move day), but it is not a buy or sell signal.

## Other stocks: AAPL, MSFT, SPY, JNJ and KO

**`symbol_comparison.png`**: the same models, with the same settings and nothing retuned, run on five stocks. MSFT moves about as much as AAPL each day; SPY (an S&P 500 index fund), JNJ and KO move about 40% less. Each bar is the six-year walk-forward average; the dashed line is that stock's bar to clear.

- **Direction (left):** no edge on any of the five. The closest was SPY, where the LSTM matched "always up" (54.6% against 54.5%); on the other four every model fell short of it.
- **Volatility (right):** the model's probabilities beat the historical rate on all five stocks, but plain accuracy cleared the bar only on AAPL (60.2%), SPY (64.1%) and KO (58.8%). MSFT was level with its bar and JNJ fell short.

What it shows: SPY is the easy case because it is the whole market, not because it is calm. JNJ and KO are just as calm but did not improve, because a single company also moves on its own news. A simple logistic regression came close to the LSTM on most stocks.

## Two upgrades: VIX and one shared model

**`pooled_vix_comparison.png`**: two ways to improve the big-move model, tested on all five stocks over the six walk-forward years. Darker bars use the VIX index, the options market's forecast of how much the S&P 500 will move. Green bars are one LSTM trained on all five stocks at once instead of one per stock.

- **VIX helps most where you would expect:** on SPY, the index VIX is built from, accuracy rose from 64.4% to 67.5%, and the worst year was 62%. On single stocks it added a point at most, and on JNJ it hurt the LSTM.
- **One shared model helps a little:** averaged over the five stocks it scored 61.1% against 60.0% for separate models. On AAPL it reached 61.9%, the best AAPL result so far.
- **JNJ never cleared its bar,** with any model.
- **A logistic regression with VIX gave the most trustworthy probabilities** on average, so the simple model stays competitive.

What it means: more data and better inputs move accuracy up by one to three points, mostly for the whole-market fund. That fits everything else here: big moves are partly predictable, and the inputs matter more than the model.

## On TradingSeason's own prices (demo)

**`platform_demo.png`**: the trained models, unchanged, run on the platform's simulated 2026 AAPL prices from late April to December (the earlier months fill the model's 60-day window). Blue bars are the models; grey bars are simple rules on the same days. The number on each bar is the AUC: 0.5 means the model ranks days no better than chance.

- **Direction (left):** the model scored 58.9%, but its AUC of 0.48 shows that is luck. The simple rule "follow the 20-day trend" scored 68.9%, because the simulation's prices follow scripted monthly trends. A high score on these prices only shows a model learned the script.
- **Big moves, as trained (middle):** simulated AAPL is much calmer than the real stock, so only about a quarter of days pass the 0.87% cut-off and "always calm" scores 77%. The model scores about the same, but still ranks stormy days above calm ones (AUC 0.67).
- **Big moves, recalibrated (right):** re-fitting the input scaling and the cut-off on the 59 warm-up days made it worse (AUC 0.50). Too few days to re-learn from, so the model works best as trained.

What it means: the pipeline runs end to end on platform data, but the platform's prices cannot measure the model. That is why the model is trained and tested on real prices.

**`platform_spike.png`** (demo): the platform's simulation schedules a volatility spike on Oct 12-17, 2026. The model, unchanged, raised its big-move probability on all 10 platform stocks during that week (to 50-76%, from 31-50% on other days). The chart shows it reacts within a day of the storm starting rather than predicting it, then stays cautious for a few weeks, as real storms tend to linger.

**`platform_calibration.png`** and **`platform_calibration.csv`**: can the model answer "will this stock move more than usual tomorrow?" on the platform's own prices? The question is asked for every one of the ten platform stocks, September to December, with "usual" meaning the stock's typical move over the previous 40 days. The black mark is the rule anyone could follow by looking: "tomorrow will be like today". Three things stand out. The frozen model, trained on real AAPL, does not transfer: on its own or recalibrated, it is worse than a coin flip here. A model trained on the platform's own market (the last bar in each group) is the only one that beats the look-and-see rule on most stocks, about 65% against 62% on average, and it fails on AMZN, MSFT, NVDA and UNH. And the look-and-see rule itself is hard to beat, because the simulation's volatility comes in stretches: once you know today was a big day, you know most of what there is to know about tomorrow. For the chatbot this means a risk card can only be backed by a model trained on the platform's market, labelled as such, and only on the stocks where it passes the bar.

**`platform_horizon_5d.png`** and **`platform_horizon_10d.png`**: the same question asked about the next week or two instead of tomorrow: "will the next 5 (or 10) days be more volatile than usual?" Over several days the day-to-day randomness averages out and what remains is the market's current mood, which on the platform lasts about a month. That makes the question more answerable, but also easier for a rule: "the next week will be like the last week" is right about two times in three. On the same October to December days, the model trained on the platform's market beats that rule at 5 days, about 70% against 66%, and clears the bar on 4 of the 10 stocks; at 10 days it does not. Nothing reaches 80%. A calculation that assumes perfect knowledge of how the simulation generates prices puts the best possible score at about 84% for the 5-day question, so the gap between 70% and 80% is partly the model and partly luck on 60 days, and a number above 80% would be a sign that something had leaked, not that the model had improved.

## More inputs and longer windows

**VIX family, fear gap and earnings dates** (`vix_family_comparison.csv`): adding the 9-day and 3-month versions of VIX, the volatility of VIX, the gap between expected and actual volatility, and AAPL's earnings dates raised AAPL's six-year accuracy from 60.2% to 62.2%. The bigger change is in how well the probabilities separate stormy from calm days: almost twice as good as the frozen model. Earnings matter on few days but strongly: after the evening before an AAPL earnings reaction, the next day was a big move 85% of the time.

**Longer prediction windows** (`horizon_comparison.csv`): instead of "will tomorrow be a big-move day?", these ask "will the next 3 (or 5, 10, 21) days be more volatile than usual?". For SPY, the whole market, that is right about 80% of the time 3 to 5 days ahead, against about 65-68% for always giving the same answer, and it beat that bar in 5 of 6 years. For AAPL it reaches about 71%, but only about 4 points above its bar, because a single company also moves on its own news. Past two weeks the advantage fades. Training on only the last few years instead of all history did worse: the older crisis years teach the model what stress looks like.

**The week-ahead test** (`week_ahead_walk_forward.csv`): the SPY 5-day question gets its own sealed test, because it was picked as the best of several windows on these same years. A second bar joins "one answer every day": "same as the last 5 days", which calls a stormy week ahead whenever the past week was stormy. Over 2018 to 2023 the model averaged 80.6% and the rule 74.3%. The model was ahead of both in every year but 2022. That year nearly every week was stormy, so "always stormy" was right 98.8% of the time.

## The earlier return model

**`lstm_loss.png`**: the same learning chart for the LSTM that predicts the size of tomorrow's move.

**`lstm_lag_check.png`**: predicted next-day price against the actual price. The two lines look very close, but the predicted line is mostly the actual line shifted one day to the right: the model largely repeats today's price. A chart like this looks impressive while showing almost no real skill.

## Charts made after the final test

What the test was expected to show, and what each outcome means, was written down and committed before it ran: see [PREREGISTRATION.md](../PREREGISTRATION.md).

These appear only once the sealed 2024 to 2026 test has been run:

- **`direction_confidence_test.png`**: the confidence chart for the test years.
- **`direction_probability_test.png`**: the probability chart for the test years.
- **`volatility_confidence_test.png`** and **`volatility_probability_test.png`**: the same two charts for the big-move model.
- **`test_week_ahead_results.csv`** and **`week_ahead_confidence_test.csv`**: the week-ahead test, which has its own rules in [PREREGISTRATION_WEEK_AHEAD.md](../PREREGISTRATION_WEEK_AHEAD.md). They are tables, not charts.

## The data files

The CSV files hold the numbers behind the charts. `results.csv`, `direction_results.csv` and `volatility_results.csv` log every experiment, including the bad ones, so nothing can be quietly left out.
