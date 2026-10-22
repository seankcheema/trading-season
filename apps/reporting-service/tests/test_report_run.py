"""The report run: files in, report.json and charts out."""

import io
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import matplotlib.pyplot as plt
import pytest

from event_store import EventStore
from report_run import (CHARTS, build_insights, build_segment_insights, draw_chart, load_events, parse_occurred_at,
                        live_report, ranged_report, run_report, zone_name)

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
    # no record names account 99
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


class TestRepublishedOrders:
    """The trading services can publish their history again; a run counts each order once."""

    def test_an_order_status_published_twice_is_counted_once(self, events_on_disk):
        before = build_insights(load_events(events_on_disk))
        store = EventStore(events_on_disk / 'events')
        # Orders 1 and 4 again, under new offsets, as a republish delivers them.
        store.append(0, 3, '1', event(1, 'FILLED', 'TEST', 'BUY', 100, 50.0, '2026-10-05T09:30:00.123456789Z'))
        store.append(2, 1, '2', event(4, 'FILLED', 'ACME', 'BUY', 10, 200.0, '2026-10-06T09:00:00Z'))

        events = load_events(events_on_disk)

        assert len(events) == 5
        assert build_insights(events) == before

    def test_the_later_message_of_a_status_is_the_one_kept(self, events_on_disk):
        store = EventStore(events_on_disk / 'events')
        corrected = {**event(4, 'FILLED', 'ACME', 'BUY', 10, 200.0, '2026-10-06T09:00:00Z'),
                     'order': {'instrumentName': 'Acme Corporation'}}
        store.append(2, 1, '2', corrected)

        kept = [row for row in load_events(events_on_disk) if row['orderId'] == 4]

        assert len(kept) == 1
        assert kept[0]['order'] == {'instrumentName': 'Acme Corporation'}

    def test_an_accepted_then_filled_order_keeps_both_statuses(self, tmp_path):
        store = EventStore(tmp_path / 'events')
        store.append(0, 0, '1', event(1, 'ACCEPTED', 'TEST', 'BUY', 100, 50.0, '2026-10-05T09:30:00Z'))
        store.append(0, 1, '1', event(1, 'FILLED', 'TEST', 'BUY', 100, 50.0, '2026-10-05T09:30:01Z'))

        assert [row['status'] for row in load_events(tmp_path)] == ['ACCEPTED', 'FILLED']

    def test_events_without_an_order_id_are_never_merged(self, tmp_path):
        store = EventStore(tmp_path / 'events')
        store.append(0, 0, '1', {'status': 'FILLED'})
        store.append(0, 1, '1', {'status': 'FILLED'})

        assert len(load_events(tmp_path)) == 2


class TestBuildSegmentInsights:

    def test_rolls_resolved_orders_up_by_trader_level(self, events_on_disk):
        segments = build_segment_insights(load_events(events_on_disk), {1: 'BEGINNER', 2: 'ADVANCED'})

        assert segments == [
            # Account 1: two fills worth 5000 and 2200, and a rejection that is not volume.
            {'segment': 'BEGINNER', 'accounts': 1, 'total': 3, 'filled': 2, 'rejected': 1, 'notional': '7200.00'},
            {'segment': 'INTERMEDIATE', 'accounts': 0, 'total': 0, 'filled': 0, 'rejected': 0, 'notional': '0.00'},
            {'segment': 'ADVANCED', 'accounts': 1, 'total': 1, 'filled': 1, 'rejected': 0, 'notional': '2000.00'},
            # No record names account 99.
            {'segment': 'UNKNOWN', 'accounts': 1, 'total': 1, 'filled': 1, 'rejected': 0, 'notional': '100.00'},
        ]

    def test_lists_every_level_and_no_unknown_when_nothing_resolved(self):
        segments = build_segment_insights([event(1, 'ACCEPTED', 'TEST', 'BUY', 1, 1, '2026-10-06T00:00:00Z')], {})

        assert [row['segment'] for row in segments] == ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
        assert all(row['total'] == 0 for row in segments)


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
        assert on_disk['files'] == ['volume_by_symbol.png', 'daily_trades.png', 'volume_by_segment.png',
                                    'trades_per_account.png']
        for name in on_disk['files']:
            assert (run_dir / name).read_bytes().startswith(PNG_MAGIC), name

        # The fixture trader is intermediate; no record names accounts 2 and 99.
        by_segment = {row['segment']: row for row in on_disk['activityBySegment']}
        assert by_segment['INTERMEDIATE'] == {'segment': 'INTERMEDIATE', 'accounts': 1, 'total': 3, 'filled': 2,
                                              'rejected': 1, 'notional': '7200.00'}
        assert by_segment['UNKNOWN']['accounts'] == 2 and by_segment['UNKNOWN']['notional'] == '2100.00'
        assert 'segment' not in on_disk['tradesPerAccount'][0]

        by_account = {row['accountId']: row for row in on_disk['tradesPerAccount']}
        assert by_account[1]['accountName'] == 'Growth Portfolio'
        assert by_account[1]['userName'] == 'Joanna Trader'
        assert by_account[99]['accountName'] is None, 'an account no record names gets no name'
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
        assert [row['total'] for row in report['activityBySegment']] == [0, 0, 0]
        for name in report['files']:
            assert (tmp_path / 'runs' / report['runId'] / name).read_bytes().startswith(PNG_MAGIC)


class TestLiveReport:

    def test_returns_none_when_there_are_no_trade_events(self, tmp_path, db_session):
        assert live_report(tmp_path, db_session) is None

    def test_builds_a_snapshot_without_writing_run_files(self, events_on_disk, db_session, test_account):
        # Make the fixture account the one the events call account 1.
        test_account.account_id = 1
        db_session.commit()

        snapshot = live_report(events_on_disk, db_session, now=datetime(2026, 10, 7, 0, 0, tzinfo=timezone.utc))

        assert snapshot['runId'] == '20261007T000000Z'
        assert snapshot['generatedAt'] == '2026-10-07T00:00:00+00:00'
        assert snapshot['eventCount'] == 5
        assert snapshot['statusCounts'] == {'FILLED': 4, 'REJECTED': 1}
        assert snapshot['files'] == ['volume_by_symbol.png', 'daily_trades.png', 'volume_by_segment.png',
                                     'trades_per_account.png']
        assert not (events_on_disk / 'runs').exists()


class TestZones:

    def test_names_an_offset_the_way_a_report_does(self):
        assert zone_name(timezone.utc) == 'UTC'
        assert zone_name(timezone(timedelta(minutes=-300))) == 'UTC-05:00'
        assert zone_name(timezone(timedelta(minutes=330))) == 'UTC+05:30'

    def test_days_are_utc_days_unless_another_zone_is_asked_for(self):
        events = [event(1, 'FILLED', 'TEST', 'BUY', 1, 1.0, '2026-10-06T02:00:00Z'),
                  event(2, 'REJECTED', 'TEST', 'BUY', 1, 1.0, '2026-10-06T06:00:00Z')]

        assert build_insights(events)['dailyCounts'] == [{'date': '2026-10-06', 'filled': 1, 'rejected': 1}]
        # Five hours west, the first of them happened the evening before.
        assert build_insights(events, timezone(timedelta(hours=-5)))['dailyCounts'] == [
            {'date': '2026-10-05', 'filled': 1, 'rejected': 0},
            {'date': '2026-10-06', 'filled': 0, 'rejected': 1},
        ]


class TestRangedReport:

    NOON = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)

    def test_cuts_a_run_to_what_occurred_between_the_start_and_its_generation(self, events_on_disk, db_session,
                                                                              test_user, test_account):
        test_account.account_id = 1
        db_session.commit()
        report = run_report(events_on_disk, db_session, now=self.NOON)

        cut = ranged_report(events_on_disk, db_session, report, datetime(2026, 10, 6, tzinfo=timezone.utc))

        # It is still the same run, with the same files.
        assert cut['runId'] == report['runId']
        assert cut['generatedAt'] == report['generatedAt']
        assert cut['files'] == report['files']
        # Orders 3 and 4 resolved that morning. Order 5 did so after the run was generated.
        assert cut['eventCount'] == 2
        assert cut['statusCounts'] == {'FILLED': 2, 'REJECTED': 0}
        assert [(row['symbol'], row['notional']) for row in cut['volumeBySymbol']] == [('TEST', '2200.00'),
                                                                                       ('ACME', '2000.00')]
        assert cut['dailyCounts'] == [{'date': '2026-10-06', 'filled': 2, 'rejected': 0}]
        assert cut['timezone'] == 'UTC'
        by_account = {row['accountId']: row for row in cut['tradesPerAccount']}
        assert by_account[1]['label'] == 'Growth Portfolio (Joanna Trader)'
        assert by_account[2]['label'] == '2'
        by_segment = {row['segment']: row for row in cut['activityBySegment']}
        assert by_segment['INTERMEDIATE']['notional'] == '2200.00'
        # The run it was cut from is not changed.
        assert report['statusCounts'] == {'FILLED': 4, 'REJECTED': 1}
        assert report['eventCount'] == 5

    def test_cuts_its_days_in_the_viewers_zone_and_says_so(self, events_on_disk, db_session):
        report = run_report(events_on_disk, db_session, now=self.NOON)
        west = timezone(timedelta(hours=-10))

        cut = ranged_report(events_on_disk, db_session, report, datetime(2026, 10, 5, tzinfo=timezone.utc), west)

        assert cut['timezone'] == 'UTC-10:00'
        # 09:30 UTC on the 5th is still the 4th there. 10:00 is midnight, and so the 5th, as are
        # 08:00 and 09:00 UTC on the 6th.
        assert cut['dailyCounts'] == [{'date': '2026-10-04', 'filled': 1, 'rejected': 0},
                                      {'date': '2026-10-05', 'filled': 2, 'rejected': 1}]

    def test_a_range_nothing_occurred_in_is_a_report_of_nothing(self, events_on_disk, db_session):
        report = run_report(events_on_disk, db_session, now=self.NOON)

        cut = ranged_report(events_on_disk, db_session, report, self.NOON - timedelta(minutes=1))

        assert cut['eventCount'] == 0
        assert cut['statusCounts'] == {'FILLED': 0, 'REJECTED': 0}
        assert cut['volumeBySymbol'] == [] and cut['tradesPerAccount'] == [] and cut['dailyCounts'] == []
        assert [row['total'] for row in cut['activityBySegment']] == [0, 0, 0]


class TestDrawChart:

    def test_draws_every_chart_of_a_run_as_png_bytes(self, events_on_disk, db_session):
        report = run_report(events_on_disk, db_session, now=datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc))

        assert list(CHARTS) == report['files']
        for name in CHARTS:
            assert draw_chart(report, name).startswith(PNG_MAGIC), name

    def test_draws_every_chart_light_for_download(self, events_on_disk, db_session):
        report = run_report(events_on_disk, db_session, now=datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc))

        for name in CHARTS:
            pixels = plt.imread(io.BytesIO(draw_chart(report, name)))
            # The corners are the figure's surface: white, whatever the theme on screen.
            for corner in (pixels[0, 0], pixels[0, -1], pixels[-1, 0], pixels[-1, -1]):
                assert tuple(corner[:3]) == (1.0, 1.0, 1.0), name

    def test_draws_a_range_nothing_occurred_in(self, tmp_path, db_session):
        report = run_report(tmp_path, db_session, now=datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc))

        for name in CHARTS:
            assert draw_chart(report, name).startswith(PNG_MAGIC), name
