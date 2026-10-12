"""LSTM tests. Skipped automatically where TensorFlow is not installed."""
import importlib.util
import tempfile
import unittest

import numpy as np

from stock_forecast.data import split_by_date
from stock_forecast.windows import fit_scalers, make_windows
from tests.helpers import make_dataset

HAS_TENSORFLOW = importlib.util.find_spec("tensorflow") is not None


@unittest.skipUnless(HAS_TENSORFLOW, "TensorFlow is not installed")
class LstmTests(unittest.TestCase):
    # These small tests check interfaces and reproducibility, not model accuracy.
    def setUp(self):
        splits = split_by_date(make_dataset())
        self.scalers = fit_scalers(splits.train)
        self.X_train, self.y_train = make_windows(splits.train.iloc[-400:], self.scalers, 10)
        self.X_val, self.y_val = make_windows(splits.val.iloc[:100], self.scalers, 10, history=splits.train)

    def test_trains_and_predicts_real_returns(self):
        from stock_forecast.lstm_model import build_lstm, predict_returns, train_lstm

        model = build_lstm(lookback=10, n_features=1, units=4)
        history = train_lstm(model, self.X_train, self.y_train, self.X_val, self.y_val, epochs=2, batch_size=64)
        self.assertIn("val_loss", history)
        predicted = predict_returns(model, self.X_val, self.scalers)
        self.assertEqual(predicted.shape, (100,))
        self.assertFalse(np.isnan(predicted).any())

    def test_same_seed_gives_the_same_model(self):
        from stock_forecast.lstm_model import build_lstm

        first = build_lstm(lookback=10, n_features=1, units=4, seed=7).get_weights()[0]
        second = build_lstm(lookback=10, n_features=1, units=4, seed=7).get_weights()[0]
        np.testing.assert_allclose(first, second)

    def test_saved_model_and_scalers_load_back(self):
        from stock_forecast.lstm_model import build_lstm, load_artifacts, predict_returns, save_artifacts

        model = build_lstm(lookback=10, n_features=1, units=4)
        with tempfile.TemporaryDirectory() as folder:
            save_artifacts(model, self.scalers, folder)
            loaded, scalers = load_artifacts(folder)
            np.testing.assert_allclose(predict_returns(loaded, self.X_val, scalers),
                                       predict_returns(model, self.X_val, self.scalers), rtol=1e-5)


if __name__ == "__main__":
    unittest.main()
