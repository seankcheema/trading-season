"""Optional: check this package's VAR against statsmodels, the library the textbook uses.

Needs `pip install statsmodels` and the data from 0001. Prints the order each
picks by AIC and the largest coefficient difference, which should be tiny
(about 1e-10). statsmodels also tries order 0, so on data with no pattern it
may pick 0 where this package picks 1.
"""
import _bootstrap  # noqa: F401
import numpy as np
# statsmodels is an optional independent check, not part of the main pipeline.
from statsmodels.tsa.api import VAR

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.pipeline import load_dataset
from stock_forecast.var_model import fit_var, select_order

train = split_by_date(load_dataset()).train[config.VAR_COLUMNS]
ours = select_order(train)
theirs = VAR(train.to_numpy()).select_order(maxlags=config.VAR_MAX_LAGS).selected_orders["aic"]
print(f"Order by AIC: this package {ours}, statsmodels {theirs}")

ours_fit = fit_var(train, ours)
theirs_fit = VAR(train.to_numpy()).fit(ours)
print("Largest coefficient difference:", float(np.abs(ours_fit.coefs - theirs_fit.coefs).max()))
print("Largest intercept difference:", float(np.abs(ours_fit.intercept - np.asarray(theirs_fit.params)[0]).max()))
