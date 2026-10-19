"""Token verification, the JWKS cache, error handlers and start-up of the Flask app."""

import runpy
import uuid
from datetime import datetime, timedelta, UTC
from pathlib import Path

import jwt
import pytest
from werkzeug.exceptions import BadRequest, Forbidden, InternalServerError, Unauthorized

import app as app_module
from app import JWKSCache, candidate_keys, init_app, verify_token


class TestJwksCache:
    def test_fetches_once_and_serves_the_cache_until_it_expires(self, app, mocker):
        get = mocker.patch('app.requests.get')
        get.return_value.json.return_value = {'keys': [{'kid': 'a'}]}
        cache = JWKSCache()

        assert cache.get_keys() == [{'kid': 'a'}]
        assert cache.get_keys() == [{'kid': 'a'}]
        assert get.call_count == 1

        cache.cached_at = datetime.now() - timedelta(seconds=cache.cache_ttl + 1)
        cache.get_keys()
        assert get.call_count == 2

    def test_a_failed_fetch_is_raised_and_not_cached(self, app, mocker):
        mocker.patch('app.requests.get', side_effect=RuntimeError('auth down'))
        cache = JWKSCache()

        with pytest.raises(RuntimeError):
            cache.get_keys()
        assert cache.keys is None


class TestCandidateKeys:
    KEYS = [{'kid': 'a'}, {'kid': 'b'}]

    def test_a_token_naming_a_key_gets_only_that_key(self):
        assert candidate_keys(self.KEYS, 'b') == [{'kid': 'b'}]
        assert candidate_keys(self.KEYS, 'zzz') == []

    def test_a_token_without_a_key_id_is_checked_against_every_key(self):
        assert candidate_keys(self.KEYS, None) == self.KEYS


class TestVerifyToken:
    def test_an_unknown_key_id_is_rejected(self, mocker):
        mocker.patch.object(app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'a'}])
        token = jwt.encode({'sub': 'x'}, 'k' * 32, algorithm='HS256', headers={'kid': 'other'})

        with pytest.raises(ValueError, match='not found in JWKS'):
            verify_token(token)

    def test_an_expired_token_is_reported_as_expired(self, mocker):
        mocker.patch.object(app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'a'}])
        mocker.patch('jwt.algorithms.RSAAlgorithm.from_jwk', return_value='key')
        mocker.patch('app.jwt.decode', side_effect=jwt.ExpiredSignatureError())
        token = jwt.encode({'sub': 'x'}, 'k' * 32, algorithm='HS256')

        with pytest.raises(ValueError, match='Token has expired'):
            verify_token(token)

    def test_a_token_no_published_key_signed_is_rejected(self, mocker):
        mocker.patch.object(
            app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'a'}, {'kid': 'b'}]
        )
        mocker.patch('jwt.algorithms.RSAAlgorithm.from_jwk', return_value='key')
        mocker.patch('app.jwt.decode', side_effect=jwt.InvalidSignatureError('bad'))
        token = jwt.encode({'sub': 'x'}, 'k' * 32, algorithm='HS256')

        with pytest.raises(ValueError, match='Invalid token'):
            verify_token(token)

    def test_a_later_key_may_match_after_an_earlier_one_fails(self, mocker):
        mocker.patch.object(
            app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'a'}, {'kid': 'b'}]
        )
        mocker.patch('jwt.algorithms.RSAAlgorithm.from_jwk', return_value='key')
        mocker.patch(
            'app.jwt.decode', side_effect=[jwt.InvalidSignatureError('bad'), {'sub': 'x'}]
        )
        token = jwt.encode({'sub': 'x'}, 'k' * 32, algorithm='HS256')

        assert verify_token(token) == {'sub': 'x'}

    def test_an_unexpected_failure_is_reported_as_a_verification_failure(self, mocker):
        mocker.patch.object(app_module.jwks_cache, 'get_keys', side_effect=RuntimeError('boom'))
        token = jwt.encode({'sub': 'x'}, 'k' * 32, algorithm='HS256')

        with pytest.raises(ValueError, match='Token verification failed: boom'):
            verify_token(token)


class TestRequireAuth:
    @staticmethod
    def _probe_client():
        """A throwaway Flask app, because the service's own app has already handled requests."""
        from flask import Flask, g

        probe = Flask('probe')
        seen = {}

        @probe.route('/me')
        @app_module.require_auth
        def me():
            seen['user_id'] = g.user_id
            return 'ok'

        return probe.test_client(), seen

    def test_a_numeric_subject_is_passed_through_unconverted(self, mocker):
        client, seen = self._probe_client()
        mocker.patch('app.verify_token', return_value={'sub': 42})

        response = client.get('/me', headers={'Authorization': 'Bearer t'})

        assert response.status_code == 200
        assert seen['user_id'] == 42

    def test_a_string_subject_becomes_a_uuid(self, mocker):
        client, seen = self._probe_client()
        subject = uuid.uuid4()
        mocker.patch('app.verify_token', return_value={'sub': str(subject)})

        client.get('/me', headers={'Authorization': 'Bearer t'})

        assert seen['user_id'] == subject


class TestErrorHandlers:
    @pytest.mark.parametrize(
        'handler, error, status, body',
        [
            ('bad_request', BadRequest(), 400, 'Bad request'),
            ('unauthorized', Unauthorized(), 401, 'Unauthorized'),
            ('forbidden', Forbidden(), 403, 'Forbidden'),
            ('not_found', None, 404, 'Not found'),
            ('internal_error', InternalServerError(), 500, 'Internal server error'),
        ],
    )
    def test_each_handler_answers_json(self, app, handler, error, status, body):
        with app.test_request_context():
            response, code = getattr(app_module, handler)(error)

        assert code == status
        assert response.get_json()['error'] == body

    def test_unknown_paths_answer_json_404(self, client):
        response = client.get('/no/such/path')

        assert response.status_code == 404
        assert response.get_json() == {'error': 'Not found'}


class TestInitApp:
    def test_initialising_registers_the_routes(self, app):
        init_app()

        assert 'api' in app.blueprints

    def test_a_failure_while_initialising_is_raised(self, app, mocker):
        mocker.patch('app.register_routes', side_effect=RuntimeError('no routes'))

        with pytest.raises(RuntimeError):
            init_app()

    def test_running_the_module_starts_the_development_server(self, app, mocker):
        run = mocker.patch('flask.Flask.run')
        mocker.patch('app.init_app')
        source = Path(app_module.__file__)

        runpy.run_path(str(source), run_name='__main__')

        run.assert_called_once()
