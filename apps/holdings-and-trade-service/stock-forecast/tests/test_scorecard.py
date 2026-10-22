import json
import tempfile
import unittest
from pathlib import Path

from stock_forecast import config
from stock_forecast.scorecard import FIELDS, build_scorecard, placeholder_scorecard, validate_scorecard, write_scorecard


def card(**changes):
    values = dict(symbol="AAPL", model="LSTM", test_start="2024-01-02", test_end="2026-09-30",
                  direction_accuracy=0.5234567, always_up_accuracy=0.53, model_return_rmse=0.0171234567,
                  naive_return_rmse=0.0172)
    values.update(changes)
    return build_scorecard(**values)


class ScorecardTests(unittest.TestCase):
    # Treat JSON fields as a UI contract and reject malformed values early.
    def test_has_exactly_the_agreed_fields(self):
        self.assertEqual(tuple(card()), FIELDS)
        self.assertEqual(tuple(placeholder_scorecard()), FIELDS)

    def test_values_are_rounded_for_display(self):
        self.assertEqual(card()["directionAccuracy"], 0.5235)
        self.assertEqual(card()["modelReturnRmse"], 0.017123)
        self.assertEqual(card()["testPeriod"], "2024-01-02 to 2026-09-30")

    def test_placeholder_is_marked(self):
        self.assertEqual(placeholder_scorecard()["status"], "placeholder")

    def test_contract_violations_are_rejected(self):
        with self.assertRaises(ValueError):
            card(direction_accuracy=1.2)
        with self.assertRaises(ValueError):
            card(status="draft")
        with self.assertRaises(ValueError):
            card(naive_return_rmse=-0.1)
        extra = {**card(), "note": "x"}
        with self.assertRaises(ValueError):
            validate_scorecard(extra)

    def test_direction_only_model_has_no_return_rmse(self):
        direction = card(model="LSTM direction", model_return_rmse=None)
        self.assertIsNone(direction["modelReturnRmse"])
        validate_scorecard(direction)
        self.assertIn('"modelReturnRmse": null', json.dumps(direction))
        with self.assertRaises((TypeError, ValueError)):
            card(naive_return_rmse=None)

    def test_written_file_round_trips(self):
        with tempfile.TemporaryDirectory() as folder:
            path = write_scorecard(card(), Path(folder) / "forecast" / "scorecard.json")
            text = path.read_text(encoding="utf-8")
        self.assertTrue(text.endswith("\n"))
        self.assertEqual(json.loads(text), card())

    def test_the_ui_copy_in_the_repo_follows_the_contract(self):
        if not config.SCORECARD_JSON.exists():
            self.skipTest("client-ui scorecard not present (running outside trading-season)")
        validate_scorecard(json.loads(config.SCORECARD_JSON.read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
