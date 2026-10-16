"""The LSTM: build, train with early stopping, predict, save.

TensorFlow is imported inside each function, so the rest of the package and
its tests run on machines without it.
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

from . import config
from .windows import Scalers


def _keras():
    try:
        from tensorflow import keras
    except ImportError as error:
        raise ImportError("The LSTM needs TensorFlow: pip install -r requirements.txt") from error
    return keras


def build_lstm(
    lookback: int = config.LOOKBACK,
    n_features: int = 1,
    units: int = config.LSTM_UNITS,
    dropout: float = config.LSTM_DROPOUT,
    seed: int = config.SEED,
):
    """One LSTM layer, dropout, one output: the scaled next-day return."""
    keras = _keras()
    # Reset randomness before building weights so repeated experiments are comparable.
    keras.utils.set_random_seed(seed)
    model = keras.Sequential([
        keras.Input(shape=(lookback, n_features)),
        keras.layers.LSTM(units),
        keras.layers.Dropout(dropout),
        keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse")
    return model


def build_direction_lstm(
    lookback: int = config.DIRECTION_LOOKBACK,
    n_features: int = 1,
    units: int = config.DIRECTION_UNITS,
    dropout: float = config.LSTM_DROPOUT,
    base_rate: float = 0.5,
    seed: int = config.SEED,
):
    """One LSTM layer, dropout, one sigmoid output: the probability tomorrow is up.

    The output bias starts at the training up-rate's log-odds, so an untrained
    model already quotes the base rate and training only moves away from it
    when the inputs carry information.
    """
    if not 0.0 < base_rate < 1.0:
        raise ValueError(f"base_rate must be strictly between 0 and 1, got {base_rate}")
    keras = _keras()
    keras.utils.set_random_seed(seed)
    log_odds = float(np.log(base_rate / (1 - base_rate)))
    model = keras.Sequential([
        keras.Input(shape=(lookback, n_features)),
        keras.layers.LSTM(units),
        keras.layers.Dropout(dropout),
        keras.layers.Dense(1, activation="sigmoid", bias_initializer=keras.initializers.Constant(log_odds)),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def train_lstm(
    model,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = config.LSTM_EPOCHS,
    batch_size: int = config.LSTM_BATCH_SIZE,
    patience: int = config.LSTM_PATIENCE,
    verbose: int = 0,
) -> dict:
    """Train with early stopping on validation loss; return the loss history."""
    keras = _keras()
    # Validation chooses when to stop; test data never controls training.
    stop = keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience, restore_best_weights=True)
    history = model.fit(
        X_train, y_train, validation_data=(X_val, y_val),
        epochs=epochs, batch_size=batch_size, callbacks=[stop], verbose=verbose,
    )
    return history.history


def predict_returns(model, X: np.ndarray, scalers: Scalers) -> np.ndarray:
    """Predict, then undo the target scaling to get real returns."""
    scaled = model.predict(X, verbose=0).reshape(-1, 1)
    # Metrics and scorecard values use ordinary returns, not standardized units.
    return scalers.target.inverse_transform(scaled)[:, 0]


def predict_up_probability(model, X: np.ndarray) -> np.ndarray:
    """The direction model's probability that each next day is up."""
    return model.predict(X, verbose=0).reshape(-1)


def save_artifacts(model, scalers: Scalers, directory: Path = config.MODELS_DIR) -> None:
    """Save the model and the training scalers together. A forecast service must reuse both."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    # Save the exact training scalers with the model; predictions must reuse them.
    model.save(directory / "lstm.keras")
    joblib.dump(scalers, directory / "scalers.joblib")


def load_artifacts(directory: Path = config.MODELS_DIR):
    """Load the saved model and its scalers."""
    keras = _keras()
    directory = Path(directory)
    return keras.models.load_model(directory / "lstm.keras"), joblib.load(directory / "scalers.joblib")
