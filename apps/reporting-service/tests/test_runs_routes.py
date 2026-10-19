"""The endpoints that expose report runs."""

import json
from datetime import datetime, timezone

import pytest

from event_store import EventStore
from tests.messages import filled, order_event

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


@pytest.fixture
def fixed_live_now(mocker):
    """Freeze the live snapshot clock where the range tests expect it."""

    class FrozenDateTime(datetime):

        @classmethod
        def now(cls, tz=None):
            value = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)
            return value if tz is None else value.astimezone(tz)

    mocker.patch('report_run.datetime', FrozenDateTime)


def write_run(files_dir, run_id, generated_at='2026-10-06T12:00:00+00:00'):
    run_dir = files_dir / 'runs' / run_id
    run_dir.mkdir(parents=True)
    (run_dir / 'volume_by_symbol.png').write_bytes(PNG_MAGIC + b'fake')
    report = {
        'runId': run_id, 'generatedAt': generated_at, 'eventCount': 3,
        'statusCounts': {'FILLED': 2, 'REJECTED': 1}, 'files': ['volume_by_symbol.png'],
    }
    (run_dir / 'report.json').write_text(json.dumps(report), encoding='utf-8')
    (files_dir / 'runs' / 'latest').write_text(run_id + '\n', encoding='utf-8')
    return report


class TestAuthentication:

    def test_runs_require_a_token(self, client, files_dir):
        assert client.get('/api/reporting/runs').status_code == 401
        assert client.get('/api/reporting/runs/latest').status_code == 401
        assert client.get('/api/reporting/runs/20261006T120000Z/files/volume_by_symbol.png').status_code == 401

    def test_scheduler_status_is_public(self, client, files_dir):
        response = client.get('/api/reporting/scheduler/status')

        assert response.status_code == 200
        assert response.get_json()['latest_run'] is None
        assert response.get_json()['interval_minutes'] == 15


class TestReportReaderRoles:

    RUN_PATHS = (
        '/api/reporting/runs',
        '/api/reporting/runs/latest',
        '/api/reporting/runs/20261006T120000Z/files/volume_by_symbol.png',
    )

    def test_a_trader_is_refused_every_run_endpoint(self, client, files_dir, authenticated_trader):
        write_run(files_dir, '20261006T120000Z')

        for path in self.RUN_PATHS:
            response = client.get(path, headers=authenticated_trader)
            assert response.status_code == 403, path
            assert response.get_json() == {'error': 'The ANALYST or ADMIN role is required'}

    def test_an_analyst_is_served_every_run_endpoint(self, client, files_dir, authenticated):
        write_run(files_dir, '20261006T120000Z')

        for path in self.RUN_PATHS:
            assert client.get(path, headers=authenticated).status_code == 200, path

    def test_an_admin_is_served_every_run_endpoint(self, client, files_dir, authenticated_admin):
        write_run(files_dir, '20261006T120000Z')

        for path in self.RUN_PATHS:
            assert client.get(path, headers=authenticated_admin).status_code == 200, path

    def test_a_token_without_a_usable_roles_claim_is_refused(self, client, files_dir, mocker, test_user):
        write_run(files_dir, '20261006T120000Z')
        headers = {'Authorization': 'Bearer test-token'}

        # No claim at all, a claim that is not a list, and a role that merely contains the word.
        for claims in ({}, {'roles': 'ANALYST'}, {'roles': None}, {'roles': ['ANALYSTS']}):
            mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id), **claims})
            assert client.get('/api/reporting/runs/latest', headers=headers).status_code == 403, claims

    def test_a_trader_still_reads_their_own_profile(self, client, authenticated_trader, test_user):
        response = client.get('/api/reporting/profile', headers=authenticated_trader)

        assert response.status_code == 200
        assert response.get_json()['user_id'] == str(test_user.user_id)


class TestListAndLatest:

    def test_empty_when_no_run_exists(self, client, files_dir, authenticated):
        response = client.get('/api/reporting/runs', headers=authenticated)

        assert response.status_code == 200
        assert response.get_json()['latest'] is None
        assert response.get_json()['runs'] == []
        assert client.get('/api/reporting/runs/latest', headers=authenticated).status_code == 404

    def test_lists_runs_newest_first_and_serves_the_latest_report(self, client, files_dir, authenticated):
        write_run(files_dir, '20261006T114500Z', generated_at='2026-10-06T11:45:00+00:00')
        latest = write_run(files_dir, '20261006T120000Z')

        listing = client.get('/api/reporting/runs', headers=authenticated).get_json()
        assert listing['latest'] == '20261006T120000Z'
        assert [run['runId'] for run in listing['runs']] == ['20261006T120000Z', '20261006T114500Z']
        assert listing['runs'][0]['files'] == ['volume_by_symbol.png']

        response = client.get('/api/reporting/runs/latest', headers=authenticated)
        assert response.status_code == 200
        assert response.get_json() == latest

        status = client.get('/api/reporting/scheduler/status').get_json()
        assert status['latest_run'] == '20261006T120000Z'
        assert status['generated_at'] == '2026-10-06T12:00:00+00:00'

    def test_a_latest_pointer_to_a_missing_run_counts_as_no_run(self, client, files_dir, authenticated):
        (files_dir / 'runs').mkdir()
        (files_dir / 'runs' / 'latest').write_text('20261006T120000Z\n', encoding='utf-8')

        assert client.get('/api/reporting/runs/latest', headers=authenticated).status_code == 404

    def test_directories_that_are_not_runs_are_ignored(self, client, files_dir, authenticated):
        write_run(files_dir, '20261006T120000Z')
        (files_dir / 'runs' / '20261006T120100Z.tmp').mkdir()
        (files_dir / 'runs' / 'scratch').mkdir()

        listing = client.get('/api/reporting/runs', headers=authenticated).get_json()

        assert [run['runId'] for run in listing['runs']] == ['20261006T120000Z']

    def test_serves_a_live_latest_report_even_before_the_first_run_is_written(self, client, files_dir,
                                                                               authenticated, fixed_live_now):
        write_events(files_dir)

        response = client.get('/api/reporting/runs/latest', headers=authenticated)

        assert response.status_code == 200
        report = response.get_json()
        assert report['runId'] == '20261006T130000Z'
        assert report['generatedAt'] == '2026-10-06T12:00:00+00:00'
        assert report['eventCount'] == 4
        assert report['statusCounts'] == {'FILLED': 3, 'REJECTED': 1}


class TestRunFiles:

    def test_serves_a_chart_as_png(self, client, files_dir, authenticated):
        write_run(files_dir, '20261006T120000Z')

        response = client.get('/api/reporting/runs/20261006T120000Z/files/volume_by_symbol.png',
                              headers=authenticated)

        assert response.status_code == 200
        assert response.mimetype == 'image/png'
        assert response.data.startswith(PNG_MAGIC)

    def test_unknown_run_or_file_is_not_found(self, client, files_dir, authenticated):
        write_run(files_dir, '20261006T120000Z')

        assert client.get('/api/reporting/runs/20261006T130000Z/files/volume_by_symbol.png',
                          headers=authenticated).status_code == 404
        assert client.get('/api/reporting/runs/20261006T120000Z/files/daily_trades.png',
                          headers=authenticated).status_code == 404

    def test_only_png_names_and_run_ids_in_the_expected_shape_are_served(self, client, files_dir, authenticated):
        write_run(files_dir, '20261006T120000Z')

        assert client.get('/api/reporting/runs/20261006T120000Z/files/report.json',
                          headers=authenticated).status_code == 404
        assert client.get('/api/reporting/runs/latest/files/volume_by_symbol.png',
                          headers=authenticated).status_code == 404
        assert client.get('/api/reporting/runs/..%2F..%2Fetc/files/passwd.png',
                          headers=authenticated).status_code == 404
        assert client.get('/api/reporting/runs/20261006T120000Z/files/..%2Freport.json',
                          headers=authenticated).status_code == 404


def write_events(files_dir):
    """Four orders around the run of noon UTC on 2026-10-06: one long before, two in its last week, one after it."""
    store = EventStore(files_dir / 'events')
    store.append(0, 0, '1', filled(1, 1, 1, 1, at='2026-09-20T10:00:00Z', symbol='AAPL', quantity=10, price=100.00))
    store.append(0, 1, '1', filled(2, 2, 2, 2, at='2026-10-05T09:30:01Z', symbol='NVDA', quantity=2, price=50.00))
    store.append(0, 2, '1', order_event(3, 'REJECTED', symbol='NVDA', resolved_at='2026-10-06T03:00:00Z',
                                        reason='BR-09: insufficient funds for this order'))
    store.append(0, 3, '1', filled(4, 3, 3, 3, at='2026-10-06T13:00:00Z', symbol='AAPL', quantity=1, price=100.00))


class TestRunsOverARange:

    LATEST = '/api/reporting/runs/latest'
    CHART = '/api/reporting/runs/20261006T120000Z/files/volume_by_symbol.png'

    def test_the_latest_run_is_cut_to_the_range_asked_for(self, client, files_dir, authenticated, fixed_live_now):
        write_events(files_dir)
        run = write_run(files_dir, '20261006T120000Z')

        report = client.get(f'{self.LATEST}?range=7d', headers=authenticated).get_json()

        assert report['runId'] == run['runId'] and report['generatedAt'] == run['generatedAt']
        assert report['files'] == ['volume_by_symbol.png', 'daily_trades.png', 'volume_by_segment.png',
                                   'trades_per_account.png']
        assert report['range'] == '7d'
        # Seven days counting the day the run was generated, and nothing after it was.
        assert report['from'] == '2026-09-30T00:00:00+00:00'
        assert report['to'] == '2026-10-06T12:00:00+00:00'
        assert report['eventCount'] == 2
        assert report['statusCounts'] == {'FILLED': 1, 'REJECTED': 1}
        assert [(row['symbol'], row['notional']) for row in report['volumeBySymbol']] == [('NVDA', '100.00')]
        assert report['tradesPerAccount'] == [{'accountId': 1, 'total': 2, 'filled': 1, 'rejected': 1,
                                               'accountName': None, 'userName': None, 'label': '1'}]
        assert report['dailyCounts'] == [{'date': '2026-10-05', 'filled': 1, 'rejected': 0},
                                         {'date': '2026-10-06', 'filled': 0, 'rejected': 1}]
        assert report['timezone'] == 'UTC'

    def test_a_range_is_cut_in_the_viewers_days(self, client, files_dir, authenticated, fixed_live_now):
        write_events(files_dir)
        write_run(files_dir, '20261006T120000Z')

        report = client.get(f'{self.LATEST}?range=today&tzOffset=-300', headers=authenticated).get_json()

        # The viewer's day began at 05:00 UTC, two hours after the rejection.
        assert report['from'] == '2026-10-06T05:00:00+00:00'
        assert report['statusCounts'] == {'FILLED': 0, 'REJECTED': 0}
        assert report['timezone'] == 'UTC-05:00'

        week = client.get(f'{self.LATEST}?range=7d&tzOffset=-300', headers=authenticated).get_json()
        assert week['from'] == '2026-09-30T05:00:00+00:00'
        # 03:00 UTC on the 6th is the evening of the 5th there.
        assert week['dailyCounts'] == [{'date': '2026-10-05', 'filled': 1, 'rejected': 1}]

    def test_all_time_is_the_live_snapshot_of_events_on_disk(self, client, files_dir, authenticated, fixed_live_now):
        write_events(files_dir)
        write_run(files_dir, '20261006T120000Z')

        report = client.get(f'{self.LATEST}?range=all&tzOffset=-300', headers=authenticated).get_json()

        assert report['runId'] == '20261006T120000Z'
        assert report['generatedAt'] == '2026-10-06T12:00:00+00:00'
        assert report['eventCount'] == 4
        assert report['statusCounts'] == {'FILLED': 3, 'REJECTED': 1}
        assert report['timezone'] == 'UTC'
        assert [(row['symbol'], row['notional']) for row in report['volumeBySymbol']] == [
            ('AAPL', '1100.00'),
            ('NVDA', '100.00'),
        ]

    def test_a_chart_is_drawn_for_the_latest_live_snapshot(self, client, files_dir, authenticated, fixed_live_now):
        write_events(files_dir)
        write_run(files_dir, '20261006T120000Z')

        whole = client.get(self.CHART, headers=authenticated)
        ranged = client.get(f'{self.CHART}?range=7d&tzOffset=-300', headers=authenticated)

        assert whole.status_code == 200
        assert whole.mimetype == 'image/png'
        assert whole.data.startswith(PNG_MAGIC)
        assert ranged.status_code == 200
        assert ranged.mimetype == 'image/png'
        assert ranged.data.startswith(PNG_MAGIC) and ranged.data != whole.data
        assert 'no-cache' in whole.headers['Cache-Control']
        assert 'no-cache' in ranged.headers['Cache-Control']

    def test_only_a_chart_the_run_has_and_the_service_can_draw_is_cut_to_a_range(self, client, files_dir,
                                                                                 authenticated, fixed_live_now):
        write_run(files_dir, '20261006T120000Z')
        (files_dir / 'runs' / '20261006T120000Z' / 'extra.png').write_bytes(PNG_MAGIC + b'extra')
        base = '/api/reporting/runs/20261006T120000Z/files'

        assert client.get(f'{base}/extra.png', headers=authenticated).status_code == 200
        assert client.get(f'{base}/extra.png?range=7d', headers=authenticated).status_code == 404
        # daily_trades.png can be drawn, but this run never had it.
        assert client.get(f'{base}/daily_trades.png?range=7d', headers=authenticated).status_code == 404
        assert client.get('/api/reporting/runs/20261006T130000Z/files/volume_by_symbol.png?range=7d',
                          headers=authenticated).status_code == 404

    def test_a_range_or_offset_the_service_does_not_know_is_refused(self, client, files_dir, authenticated,
                                                                    fixed_live_now):
        write_run(files_dir, '20261006T120000Z')

        for path in (self.LATEST, self.CHART):
            unknown = client.get(f'{path}?range=1y', headers=authenticated)
            assert unknown.status_code == 400, path
            assert unknown.get_json() == {'error': 'range must be one of today, 7d, 30d, 90d, all'}
            assert client.get(f'{path}?range=7d&tzOffset=east', headers=authenticated).status_code == 400, path
            assert client.get(f'{path}?range=7d&tzOffset=900', headers=authenticated).status_code == 400, path

    def test_a_range_is_refused_before_it_is_said_that_no_run_exists(self, client, files_dir, authenticated,
                                                                     fixed_live_now):
        assert client.get(f'{self.LATEST}?range=1y', headers=authenticated).status_code == 400
        assert client.get(f'{self.LATEST}?range=7d', headers=authenticated).status_code == 404

    def test_a_trader_is_refused_a_range_too(self, client, files_dir, authenticated_trader):
        write_run(files_dir, '20261006T120000Z')

        assert client.get(f'{self.LATEST}?range=7d', headers=authenticated_trader).status_code == 403
        assert client.get(f'{self.CHART}?range=7d', headers=authenticated_trader).status_code == 403
