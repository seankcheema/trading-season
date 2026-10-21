import unittest

from stock_forecast.walk_forward import run_walk_forward, walk_forward_folds
from tests.helpers import make_dataset


class WalkForwardTests(unittest.TestCase):
    # Every fold must train and tune only on data earlier than its scored year.
    def setUp(self):
        self.dataset = make_dataset()

    def test_each_fold_trains_on_the_past_and_tests_one_year(self):
        for fold in walk_forward_folds(self.dataset, years=[2018, 2019, 2020]):
            self.assertEqual(fold.train.index.max().year, fold.year - 2)
            self.assertEqual(set(fold.val.index.year), {fold.year - 1})
            self.assertEqual(set(fold.test.index.year), {fold.year})
            self.assertLess(fold.train.index.max(), fold.val.index.min())
            self.assertLess(fold.val.index.max(), fold.test.index.min())

    def test_year_without_data_is_an_error(self):
        with self.assertRaises(ValueError):
            walk_forward_folds(self.dataset, years=[2030])

    def test_results_have_one_row_per_year_and_model(self):
        def evaluate(fold):
            return [{"model": "A", "direction_accuracy": 0.5}, {"model": "B", "direction_accuracy": 0.5}]

        table = run_walk_forward(self.dataset, evaluate, years=[2018, 2019])
        self.assertEqual(len(table), 4)
        self.assertEqual(sorted(table["year"].unique()), [2018, 2019])


if __name__ == "__main__":
    unittest.main()
