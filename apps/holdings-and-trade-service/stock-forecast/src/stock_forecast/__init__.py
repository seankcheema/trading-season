"""Stock forecasting research pipeline for Trading Season.

Offline tooling: it downloads real daily prices, trains and evaluates models
(baselines, a vector autoregression and an LSTM), and writes a small JSON
scorecard that the client UI displays. Nothing here runs inside the platform.
"""
