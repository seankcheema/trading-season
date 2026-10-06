"""The report run: files in, report.json and charts out."""

import json
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from event_store import EventStore
from report_run import build_insights, load_events, parse_occurred_at, run_report

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


def event(order_id, status, symbol, side, quantity, price, occurred_at, reason=None):
    return {
        'orderId': order_id, 'status': status, 'symbol': symbol, 'side': side,
        'quantity': quantity, 'price': price, 'rejectionReason': reason, 'occurredAt': occurred_at,
    }


@pytest.fixture
def events_on_disk(tmp_path):
    """
    Three partitions, two symbols, two accounts, two UTC days, one duplicate
    offset written twice, and the timestamp shapes Jackson produces.
    """
    store = EventStore(tmp_path / 'events')
    # account 1 on partition 0
    store.append(0, 0, '1', event(1, 'FILLED', 'TEST', 'BUY', 100, 50.0, '2026-10-05T09:30:00.123456789Z'))
    store.append(0, 1, '1', event(2, 'REJECTED', 'TEST', 'SELL', 500, 50.0, '2026-10-05T10:00:00+00:00',
                                  reason='Insufficient holdings'))
    store.append(0, 2, '1', event(3, 'FILLED', 'TEST', 'SELL', 40, 55.0, '2026-10-06T08:00:00Z'))
    # account 2 on partition 2
    store.append(2, 0, '2', event(4, 'FILLED', 'ACME', 'BUY', 10, 200.0, '2026-10-06T09:00:00Z'))
    # account 99 does not exist in the database
    store.append(1, 0, '99', event(5, 'FILLED', 'ACME', 'BUY', 1, 100.0, '2026-10-06T23:59:59Z'))
    # the same line again, as if the consumer crashed between append and commit
    with open(tmp_path / 'events' / 'trade-events-p2.jsonl', 'a', encoding='utf-8') as handle:
        handle.write(json.dumps({'partition': 2, 'offset': 0, 'accountId': 2,
                                 **event(4, 'FILLED', 'ACME', 'BUY', 10, 200.0, '2026-10-06T09:00:00Z')}) + '\n')
    return tmp_path


class TestParseOccurredAt:

    def test_accepts_z_suffix_offset_and_long_fractions(self):
        assert parse_occurred_at('2026-10-05T09:30:00Z') == datetime(2026, 10, 5, 9, 30, tzinfo=timezone.utc)
        assert parse_occurred_at('2026-10-05T09:30:00+00:00') == datetime(2026, 10, 5, 9, 30, tzinfo=timezone.utc)
        parsed = parse_occurred_at('2026-10-05T09:30:00.123456789Z')
        assert parsed.microsecond == 123456

    def test_converts_other_offsets_to_utc_and_assumes_utc_when_naive(self):
        assert parse_occurred_at('2026-10-05T11:30:00+02:00').hour == 9
        assert parse_occurred_at('2026-10-05T09:30:00').tzinfo == timezone.utc

    def test_returns_none_for_garbage(self):
        assert parse_occurred_at('yesterday') is None
        assert parse_occurred_at(None) is None
        assert parse_occurred_at('') is None


class TestBuildInsights:

    def test_counts_fills_and_rejections_and_sums_filled_volume_per_symbol(self, events_on_disk):
        insights = build_insights(load_events(events_on_disk))

        assert insights['statusCounts'] == {'FILLED': 4, 'REJECTED': 1}
        by_symbol = {row['symbol']: row for row in insights['volumeBySymbol']}
        # TEST: 100 * 50 + 40 * 55 = 7200; the rejected sell is not volume
        assert by_symbol['TEST']['fills'] == 2
        assert Decimal(by_symbol['TEST']['shares']) == Decimal('140')
        assert Decimal(by_symbol['TEST']['notional']) == Decimal('7200.00')
        # ACME: 10 * 200 + 1 * 100; the duplicate line is counted once
        assert Decimal(by_symbol['ACME']['notional']) == Decimal('2100.00')
        assert insights['volumeBySymbol'][0]['symbol'] == 'TEST', 'largest notional first'

    def test_counts_per_account_and_per_utc_day(self, events_on_disk):
        insights = build_insights(load_events(events_on_disk))

        by_account = {row['accountId']: row for row in insights['tradesPerAccount']}
        assert by_account[1] == {'accountId': 1, 'total': 3, 'filled': 2, 'rejected': 1}
        assert by_account[2]['total'] == 1
        assert by_account[99]['total'] == 1

        assert insights['dailyCounts'] == [
            {'date': '2026-10-05', 'filled': 1, 'rejected': 1},
            {'date': '2026-10-06', 'filled': 3, 'rejected': 0},
        ]

    def test_ignores_events_with_an_unknown_status(self):
        insights = build_insights([event(1, 'PENDING', 'TEST', 'BUY', 1, 1, '2026-10-06T00:00:00Z')])

        assert insights['statusCounts'] == {'FILLED': 0, 'REJECTED': 0}
        assert insights['tradesPerAccount'] == []

    def test_load_events_drops_exact_duplicates(self, events_on_disk):
        events = load_events(events_on_disk)

        assert len(events) == 5
        assert len({(e['partition'], e['offset']) for e in events}) == 5


class TestRunReport:

    def test_writes_report_and_charts_and_points_latest_at_the_run(self, events_on_disk, db_session,
                                                                     test_user, test_account):
        # Make the fixture account the one the events call account 1.
        test_account.account_id = 1
        db_session.commit()
        now = datetime(2026, 10, 6, 12, 0, 0, tzinfo=timezone.utc)

        report = run_report(events_on_disk, db_session, now=now)

        run_dir = events_on_disk / 'runs' / '20261006T120000Z'
        assert report['runId'] == '20261006T120000Z'
        assert (events_on_disk / 'runs' / 'latest').read_text(encoding='utf-8').strip() == '20261006T120000Z'
        on_disk = json.loads((run_dir / 'report.json').read_text(encoding='utf-8'))
        assert on_disk['eventCount'] == 5
        assert on_disk['statusCounts'] == {'FILLED': 4, 'REJECTED': 1}
        assert on_disk['timezone'] == 'UTC'
        assert on_disk['files'] == ['volume_by_symbol.png', 'daily_trades.png', 'trades_per_account.png']
        for name in on_disk['files']:
            assert (run_dir / name).read_bytes().startswith(PNG_MAGIC), name

        by_account = {row['accountId']: row for row in on_disk['tradesPerAccount']}
        assert by_account[1]['accountName'] == 'Growth Portfolio'
        assert by_account[1]['userName'] == 'Joanna Trader'
        assert by_account[99]['accountName'] is None, 'an account the database does not know gets no name'
        assert by_account[99]['userName'] is None
        assert not (events_on_disk / 'runs' / '20261006T120000Z.tmp').exists()

    def test_a_new_run_replaces_the_previous_one(self, events_on_disk, db_session):
        first = run_report(events_on_disk, db_session, now=datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc))
        second = run_report(events_on_disk, db_session, now=datetime(2026, 10, 6, 12, 15, tzinfo=timezone.utc))

        runs = sorted(child.name for child in (events_on_disk / 'runs').iterdir() if child.is_dir())
        assert runs == [second['runId']]
        assert first['runId'] not in runs
        assert (events_on_disk / 'runs' / 'latest').read_text(encoding='utf-8').strip() == second['runId']

    def test_runs_with_no_events_at_all(self, tmp_path, db_session):
        report = run_report(tmp_path, db_session, now=datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc))

        assert report['eventCount'] == 0
        assert report['statusCounts'] == {'FILLED': 0, 'REJECTED': 0}
        for name in report['files']:
            assert (tmp_path / 'runs' / report['runId'] / name).read_bytes().startswith(PNG_MAGIC)
