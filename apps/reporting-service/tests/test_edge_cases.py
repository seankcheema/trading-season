"""Small behaviours of the stores and helpers that the larger suites do not reach."""

import json
from datetime import datetime, timezone

import pytest

import console
import report_run
import run_store
from event_store import EventStore, _account_id, _partition_of


class TestRunStore:
    def test_an_unreadable_latest_pointer_means_no_run(self, tmp_path):
        assert run_store.latest_run_id(tmp_path) is None

    def test_a_pointer_to_an_unsafe_or_missing_run_means_no_run(self, tmp_path):
        runs = tmp_path / 'runs'
        runs.mkdir()
        (runs / 'latest').write_text('../escape', encoding='utf-8')
        assert run_store.latest_run_id(tmp_path) is None

        (runs / 'latest').write_text('20260101T000000Z', encoding='utf-8')
        assert run_store.latest_run_id(tmp_path) is None

    def test_an_unsafe_id_has_no_report(self, tmp_path):
        assert run_store.read_report(tmp_path, '../x') is None
        assert run_store.read_report(tmp_path, '') is None

    def test_a_corrupt_report_is_ignored_when_listing_runs(self, tmp_path):
        good = tmp_path / 'runs' / '20260101T000000Z'
        good.mkdir(parents=True)
        (good / 'report.json').write_text(
            json.dumps({'generatedAt': 'x', 'eventCount': 1, 'files': ['a.png']}), encoding='utf-8'
        )
        bad = tmp_path / 'runs' / '20260102T000000Z'
        bad.mkdir()
        (bad / 'report.json').write_text('{', encoding='utf-8')
        (tmp_path / 'runs' / 'not-a-run').mkdir()
        (tmp_path / 'runs' / 'stray.txt').write_text('x', encoding='utf-8')

        runs = run_store.list_runs(tmp_path)

        assert [run['runId'] for run in runs] == ['20260101T000000Z']

    def test_no_runs_directory_means_no_runs(self, tmp_path):
        assert run_store.list_runs(tmp_path) == []


class TestEventStoreFiles:
    def test_partition_numbers_are_read_from_file_names(self, tmp_path):
        assert _partition_of(tmp_path / 'trade-events-p3.jsonl') == 3
        assert _partition_of(tmp_path / 'trade-events.jsonl') is None
        assert _partition_of(tmp_path / 'trade-events-pX.jsonl') is None

    def test_account_keys_are_numbers_when_they_can_be(self):
        assert _account_id(None) is None
        assert _account_id('12') == 12
        assert _account_id('USER-1') == 'USER-1'

    def test_refresh_skips_unnamed_partitions_and_unreadable_lines(self, tmp_path):
        (tmp_path / 'trade-events-p1.jsonl').write_text(
            '\n'.join(
                [
                    '',
                    'not json',
                    json.dumps(['list']),
                    json.dumps({'offset': 'text'}),
                    json.dumps({'offset': 4, 'key': '1'}),
                ]
            ),
            encoding='utf-8',
        )
        (tmp_path / 'trade-events-pX.jsonl').write_text(
            json.dumps({'offset': 9}) + '\n', encoding='utf-8'
        )
        (tmp_path / 'trade-events-p2.jsonl').write_text('', encoding='utf-8')

        store = EventStore(tmp_path)
        store.refresh()

        assert store.last_offset(1) == 4
        assert store.last_offset(2) is None


class TestConsoleTime:
    def test_naive_times_are_taken_as_utc_and_aware_ones_converted(self):
        assert console._utc(None) is None
        naive = datetime(2026, 1, 1, 12, 0)
        assert console._utc(naive) == naive.replace(tzinfo=timezone.utc)
        aware = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        assert console._utc(aware) == aware


class TestReportHelpers:
    def test_unparseable_amounts_count_as_zero(self):
        assert report_run._decimal('abc') == 0
        assert report_run._decimal(None) == 0
        assert str(report_run._decimal('1.5')) == '1.5'

    def test_a_run_replaces_leftover_staging_and_final_directories(self, tmp_path, db_session):
        now = datetime(2026, 10, 6, 12, 0, 0, tzinfo=timezone.utc)
        base = tmp_path / 'runs'
        (base / '20261006T120000Z.tmp').mkdir(parents=True)
        (base / '20261006T120000Z.tmp' / 'stale.txt').write_text('x', encoding='utf-8')
        (base / '20261006T120000Z').mkdir()
        (base / '20261006T120000Z' / 'stale.txt').write_text('x', encoding='utf-8')

        report_run.run_report(tmp_path, db_session, now=now)

        assert not (base / '20261006T120000Z.tmp').exists()
        assert not (base / '20261006T120000Z' / 'stale.txt').exists()
        assert (base / '20261006T120000Z' / 'report.json').is_file()

    def test_crowded_bar_labels_are_rotated(self):
        import matplotlib

        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        fig, axis = plt.subplots()
        axis.bar(range(12), range(12))
        axis.set_xticks(range(12))
        axis.set_xticklabels([str(n) for n in range(12)])
        report_run._fit_bars(axis, 12)

        assert all(label.get_rotation() == 30 for label in axis.get_xticklabels())
        plt.close(fig)

    def test_a_repeated_order_status_replaces_the_earlier_message(self, tmp_path):
        store = EventStore(tmp_path / 'events')
        body = {'orderId': 5, 'status': 'FILLED', 'symbol': 'T', 'side': 'BUY', 'quantity': 1,
                'price': 1.0, 'rejectionReason': None, 'occurredAt': '2026-10-06T09:30:00Z'}
        store.append(0, 0, '1', body)
        store.append(0, 1, '1', {**body, 'price': 2.0})

        events = report_run.load_events(tmp_path)

        assert len(events) == 1
        assert events[0]['price'] == 2.0
