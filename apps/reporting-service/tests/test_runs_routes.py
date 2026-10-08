"""The endpoints that expose report runs."""

import json

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


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
