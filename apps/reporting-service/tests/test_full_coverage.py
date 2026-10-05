"""
Targeted tests that drive full request/response cycles (real auth mocking +
real database fixtures) and direct unit calls to close the remaining
coverage gaps in routes.py, app.py, scheduled_tasks.py, and wsgi.py.
"""

import uuid
from datetime import datetime, timedelta, UTC
from decimal import Decimal

import jwt
import pytest

from models import User, Order, Fill

TEST_HS256_KEY = 'reporting-service-test-secret-key-32b'


# ============================================================================
# Shared fixtures
# ============================================================================

@pytest.fixture
def other_user(db_session):
    """A second user with no accounts, used for empty-state branches."""
    user = User(
        user_id=uuid.uuid4(),
        email=f'other-{uuid.uuid4()}@example.com',
        first_name='Other',
        last_name='User',
        address='1 Other St, City, State 12345',
        ssn='222-22-2222',
        date_of_birth=datetime(1985, 5, 5),
        trader_level='ADVANCED',
        available_funds=Decimal('0.00')
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def sell_order_profit(db_session, test_account, test_instrument):
    """A profitable SELL trade for test_account."""
    order = Order(
        account_id=test_account.account_id,
        user_id=test_account.user_id,
        instrument_id=test_instrument.instrument_id,
        order_type='SELL',
        quantity=Decimal('10.00'),
        indicative_price=Decimal('160.00'),
        status='FILLED',
        submitted_at=datetime.now(UTC) - timedelta(days=2),
        resolved_at=datetime.now(UTC) - timedelta(days=2)
    )
    db_session.add(order)
    db_session.commit()
    fill = Fill(
        order_id=order.order_id,
        filled_quantity=Decimal('10.00'),
        filled_price=Decimal('160.00'),
        commission=Decimal('5.00'),
        fill_timestamp=datetime.now(UTC) - timedelta(days=2)
    )
    db_session.add(fill)
    db_session.commit()
    return order


@pytest.fixture
def sell_order_loss(db_session, test_account, test_instrument):
    """A losing SELL trade for test_account."""
    order = Order(
        account_id=test_account.account_id,
        user_id=test_account.user_id,
        instrument_id=test_instrument.instrument_id,
        order_type='SELL',
        quantity=Decimal('5.00'),
        indicative_price=Decimal('100.00'),
        status='FILLED',
        submitted_at=datetime.now(UTC) - timedelta(days=1),
        resolved_at=datetime.now(UTC) - timedelta(days=1)
    )
    db_session.add(order)
    db_session.commit()
    fill = Fill(
        order_id=order.order_id,
        filled_quantity=Decimal('5.00'),
        filled_price=Decimal('1.00'),
        commission=Decimal('50.00'),
        fill_timestamp=datetime.now(UTC) - timedelta(days=1)
    )
    db_session.add(fill)
    db_session.commit()
    return order


AUTH_HEADER = {'Authorization': 'Bearer test-token'}


# ============================================================================
# /api/reporting/portfolio
# ============================================================================

class TestPortfolioSummaryFull:

    def test_portfolio_summary_with_data(self, client, test_user, test_account, test_holding, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/portfolio', headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.get_json()
        assert data['summary']['total_accounts'] == 1
        assert data['summary']['total_holdings_value'] > 0
        assert data['accounts'][0]['holdings_value'] > 0

    def test_portfolio_summary_no_accounts(self, client, other_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(other_user.user_id)})
        response = client.get('/api/reporting/portfolio', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json() == {'accounts': [], 'summary': {}}

    def test_portfolio_summary_error(self, client, test_user, test_account, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.AccountRepository.get_account_summary', side_effect=Exception('boom'))
        response = client.get('/api/reporting/portfolio', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestAccountPortfolioFull:

    def test_account_portfolio_success(self, client, test_user, test_account, test_holding, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(f'/api/reporting/portfolio/{test_account.account_id}', headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.get_json()
        assert data['account']['account_id'] == test_account.account_id
        assert len(data['holdings']) == 1

    def test_account_portfolio_error(self, client, test_user, test_account, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.AccountRepository.get_account_summary', side_effect=Exception('boom'))
        response = client.get(f'/api/reporting/portfolio/{test_account.account_id}', headers=AUTH_HEADER)
        assert response.status_code == 500


# ============================================================================
# /api/reporting/trades
# ============================================================================

class TestTradesFull:

    def test_trades_all_accounts_default(self, client, test_user, test_account, test_order, test_fill,
                                          sell_order_profit, sell_order_loss, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades', headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.get_json()
        assert data['pagination']['total'] == 3
        assert data['statistics']['total_trades'] == 3

    def test_trades_by_account_id(self, client, test_user, test_account, test_order, test_fill, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(f'/api/reporting/trades?account_id={test_account.account_id}', headers=AUTH_HEADER)
        assert response.status_code == 200

    def test_trades_account_not_found(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?account_id=999999', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_trades_no_accounts(self, client, other_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(other_user.user_id)})
        response = client.get('/api/reporting/trades', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['pagination']['total'] == 0

    def test_trades_invalid_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?start_date=not-a-date', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_trades_filters(self, client, test_user, test_account, test_order, test_fill,
                             sell_order_profit, sell_order_loss, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        # min_profit excludes the loss trade, max_profit excludes the big
        # winner, and the break-even BUY trade survives both checks -
        # exercising every branch of the profit-range filter in one request.
        response = client.get(
            '/api/reporting/trades?symbol=aapl&min_profit=-10&max_profit=1000',
            headers=AUTH_HEADER
        )
        assert response.status_code == 200
        assert response.get_json()['pagination']['total'] == 1

    def test_trades_invalid_end_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?end_date=not-a-date', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_trades_status_filter(self, client, test_user, test_account, test_order, test_fill, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?status=filled', headers=AUTH_HEADER)
        assert response.status_code == 200

    def test_trades_order_type_filter(self, client, test_user, test_account, test_order, test_fill,
                                       sell_order_profit, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?order_type=sell', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['pagination']['total'] == 1

    def test_trades_limit_clamping(self, client, test_user, test_account, test_order, test_fill, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?limit=1000', headers=AUTH_HEADER)
        assert response.get_json()['pagination']['limit'] == 500

        response = client.get('/api/reporting/trades?limit=-5', headers=AUTH_HEADER)
        assert response.get_json()['pagination']['limit'] == 1

    def test_trades_offset(self, client, test_user, test_account, test_order, test_fill,
                            sell_order_profit, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades?offset=1', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['pagination']['offset'] == 1

    def test_trades_error(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.AccountRepository.get_user_accounts', side_effect=Exception('boom'))
        response = client.get('/api/reporting/trades', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestTradeDetailFull:

    def test_trade_detail_success(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.OrderRepository.get_order',
                      return_value={'order_id': 1, 'user_id': str(test_user.user_id), 'symbol': 'AAPL'})
        response = client.get('/api/reporting/trades/1', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['trade']['order_id'] == 1

    def test_trade_detail_not_found(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.OrderRepository.get_order', return_value=None)
        response = client.get('/api/reporting/trades/999', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_trade_detail_access_denied(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.OrderRepository.get_order',
                      return_value={'order_id': 1, 'user_id': str(uuid.uuid4())})
        response = client.get('/api/reporting/trades/1', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_trade_detail_error(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.OrderRepository.get_order', side_effect=Exception('boom'))
        response = client.get('/api/reporting/trades/1', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestTradeStatisticsFull:

    def test_statistics_all_accounts(self, client, test_user, test_account, test_order, test_fill,
                                      sell_order_profit, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/statistics', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['statistics']['total_trades'] == 2

    def test_statistics_by_account(self, client, test_user, test_account, test_order, test_fill, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(
            f'/api/reporting/trades/statistics?account_id={test_account.account_id}', headers=AUTH_HEADER
        )
        assert response.status_code == 200

    def test_statistics_account_not_found(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/statistics?account_id=999999', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_statistics_invalid_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/statistics?start_date=bad', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_statistics_invalid_end_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/statistics?end_date=not-a-date', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_statistics_error(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.AccountRepository.get_user_accounts', side_effect=Exception('boom'))
        response = client.get('/api/reporting/trades/statistics', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestTradeDrilldownFull:

    def test_drilldown_all_accounts(self, client, test_user, test_account, test_order, test_fill,
                                     sell_order_profit, sell_order_loss, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/drill-down', headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.get_json()
        assert 'by_symbol' in data
        assert 'by_order_type' in data
        assert len(data['best_trades']) > 0

    def test_drilldown_by_account(self, client, test_user, test_account, test_order, test_fill, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(
            f'/api/reporting/trades/drill-down?account_id={test_account.account_id}', headers=AUTH_HEADER
        )
        assert response.status_code == 200

    def test_drilldown_account_not_found(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/drill-down?account_id=999999', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_drilldown_invalid_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/drill-down?start_date=bad', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_drilldown_invalid_end_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/trades/drill-down?end_date=not-a-date', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_drilldown_error(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.AccountRepository.get_user_accounts', side_effect=Exception('boom'))
        response = client.get('/api/reporting/trades/drill-down', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestAccountPerformanceFull:

    def test_account_performance_success(self, client, test_user, test_account, test_order, test_fill,
                                          sell_order_profit, test_holding, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(
            f'/api/reporting/portfolio/{test_account.account_id}/performance', headers=AUTH_HEADER
        )
        assert response.status_code == 200
        data = response.get_json()
        assert 'performance' in data
        assert 'current_position' in data

    def test_account_performance_not_found(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/portfolio/999999/performance', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_account_performance_invalid_date(self, client, test_user, test_account, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(
            f'/api/reporting/portfolio/{test_account.account_id}/performance?start_date=bad', headers=AUTH_HEADER
        )
        assert response.status_code == 400

    def test_account_performance_invalid_end_date(self, client, test_user, test_account, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get(
            f'/api/reporting/portfolio/{test_account.account_id}/performance?end_date=not-a-date',
            headers=AUTH_HEADER
        )
        assert response.status_code == 400

    def test_account_performance_error(self, client, test_user, test_account, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.TradeRepository.get_trade_history', side_effect=Exception('boom'))
        response = client.get(
            f'/api/reporting/portfolio/{test_account.account_id}/performance', headers=AUTH_HEADER
        )
        assert response.status_code == 500


class TestPortfolioPerformanceFull:

    def test_portfolio_performance_success(self, client, test_user, test_account, test_order, test_fill,
                                            sell_order_profit, test_holding, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/portfolio/performance', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['accounts_count'] == 1

    def test_portfolio_performance_no_accounts(self, client, other_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(other_user.user_id)})
        response = client.get('/api/reporting/portfolio/performance', headers=AUTH_HEADER)
        assert response.status_code == 404

    def test_portfolio_performance_invalid_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/portfolio/performance?start_date=bad', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_portfolio_performance_invalid_end_date(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/portfolio/performance?end_date=not-a-date', headers=AUTH_HEADER)
        assert response.status_code == 400

    def test_portfolio_performance_error(self, client, test_user, test_account, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.AccountRepository.get_user_accounts', side_effect=Exception('boom'))
        response = client.get('/api/reporting/portfolio/performance', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestUserProfileFull:

    def test_profile_success(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        response = client.get('/api/reporting/profile', headers=AUTH_HEADER)
        assert response.status_code == 200
        assert response.get_json()['email'] == test_user.email

    def test_profile_error(self, client, test_user, mocker):
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
        mocker.patch('routes.UserRepository.get_user', side_effect=Exception('boom'))
        response = client.get('/api/reporting/profile', headers=AUTH_HEADER)
        assert response.status_code == 500


class TestSchedulerStatusFull:

    def test_scheduler_status_error(self, client, mocker):
        mocker.patch('scheduled_tasks.get_refresh_status', side_effect=Exception('boom'))
        response = client.get('/api/reporting/scheduler/status')
        assert response.status_code == 500
        assert 'error' in response.get_json()


# ============================================================================
# Helper function branch coverage
# ============================================================================

class TestPerformanceMetricsHelpersFull:

    def test_calculate_performance_metrics_with_trades(self):
        from routes import _calculate_performance_metrics
        trades = [
            {'realized_pl': 500.0, 'executed_at': (datetime.now(UTC) - timedelta(days=2)).isoformat()},
            {'realized_pl': -100.0, 'executed_at': (datetime.now(UTC) - timedelta(days=1)).isoformat()},
            {'realized_pl': 300.0, 'executed_at': datetime.now(UTC).isoformat()},
        ]
        metrics = _calculate_performance_metrics(trades)
        assert metrics['trade_count'] == 3
        assert metrics['total_return'] == 700.0
        assert 'sharpe_ratio' in metrics
        assert 'sortino_ratio' in metrics

    def test_calculate_daily_returns_mixed_formats(self):
        from routes import _calculate_daily_returns
        trades = [
            {'executed_at': None, 'realized_pl': 10.0},
            {'executed_at': 'not-a-valid-date', 'realized_pl': 20.0},
            {'executed_at': datetime.now(UTC), 'realized_pl': 30.0},
            {'executed_at': (datetime.now(UTC) - timedelta(days=1)).isoformat(), 'realized_pl': 40.0},
        ]
        returns = _calculate_daily_returns(trades)
        assert len(returns) >= 1

    def test_calculate_daily_returns_all_skipped(self):
        from routes import _calculate_daily_returns
        trades = [{'executed_at': None, 'realized_pl': 10.0}, {'executed_at': '', 'realized_pl': 5.0}]
        returns = _calculate_daily_returns(trades)
        assert returns == [0.0]

    def test_calculate_downside_deviation_no_downside(self):
        from routes import _calculate_downside_deviation
        returns = [0.05, 0.06, 0.07]
        assert _calculate_downside_deviation(returns) == 0.0


# ============================================================================
# app.py: JWKSCache / verify_token / error handlers / health / init_app
# ============================================================================

class TestJWKSCacheSuccess:

    def test_get_keys_fetches_and_caches(self, mocker):
        from app import JWKSCache
        mock_get = mocker.patch('requests.get')
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = {'keys': [{'kid': 'k1'}]}

        cache = JWKSCache()
        keys = cache.get_keys()
        assert keys == [{'kid': 'k1'}]
        assert cache.cached_at is not None

        # Still within TTL: should reuse the cache rather than fetch again.
        keys_again = cache.get_keys()
        assert keys_again == keys
        assert mock_get.call_count == 1


class TestVerifyTokenBranches:

    @staticmethod
    def _make_token(kid='test-kid'):
        return jwt.encode({'sub': 'abc'}, TEST_HS256_KEY, algorithm='HS256', headers={'kid': kid})

    @staticmethod
    def _patch_rsa_algorithm(mocker):
        # RSAAlgorithm is only registered on jwt.algorithms when the optional
        # `cryptography` package is installed, which it is not in this
        # environment, so the attribute must be created rather than replaced.
        mock_rsa = mocker.patch('jwt.algorithms.RSAAlgorithm', create=True)
        mock_rsa.from_jwk.return_value = 'fake-key'
        return mock_rsa

    def test_verify_token_success(self, mocker):
        import app as app_module
        mocker.patch.object(app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'test-kid'}])
        self._patch_rsa_algorithm(mocker)
        mocker.patch('jwt.decode', return_value={'sub': 'user-123'})

        decoded = app_module.verify_token(self._make_token())
        assert decoded == {'sub': 'user-123'}

    def test_verify_token_expired(self, mocker):
        import app as app_module
        mocker.patch.object(app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'test-kid'}])
        self._patch_rsa_algorithm(mocker)
        mocker.patch('jwt.decode', side_effect=jwt.ExpiredSignatureError())

        token = self._make_token()
        with pytest.raises(ValueError, match='expired'):
            app_module.verify_token(token)

    def test_verify_token_invalid(self, mocker):
        import app as app_module
        mocker.patch.object(app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'test-kid'}])
        self._patch_rsa_algorithm(mocker)
        mocker.patch('jwt.decode', side_effect=jwt.InvalidTokenError('bad token'))

        token = self._make_token()
        with pytest.raises(ValueError, match='Invalid token'):
            app_module.verify_token(token)

    def test_verify_token_key_not_found(self, mocker):
        import app as app_module
        mocker.patch.object(app_module.jwks_cache, 'get_keys', return_value=[{'kid': 'other-kid'}])

        token = self._make_token(kid='test-kid')
        with pytest.raises(ValueError, match='not found'):
            app_module.verify_token(token)


class TestErrorHandlersDirect:

    def test_bad_request_handler(self, app):
        from app import bad_request
        with app.app_context():
            response, status = bad_request(Exception('bad'))
        assert status == 400

    def test_unauthorized_handler(self, app):
        from app import unauthorized
        with app.app_context():
            response, status = unauthorized(Exception('x'))
        assert status == 401

    def test_forbidden_handler(self, app):
        from app import forbidden
        with app.app_context():
            response, status = forbidden(Exception('x'))
        assert status == 403

    def test_internal_error_handler(self, app):
        from app import internal_error
        with app.app_context():
            response, status = internal_error(Exception('x'))
        assert status == 500


class TestHealthEndpointError:

    def test_health_db_failure(self, client, mocker):
        mocker.patch('sqlalchemy.orm.session.Session.execute', side_effect=Exception('db down'))
        response = client.get('/health')
        assert response.status_code == 503
        assert response.get_json()['status'] == 'unhealthy'


class TestInitAppFull:

    def test_init_app_runs(self, app, mocker):
        from app import init_app
        mock_init_sched = mocker.patch('app.init_scheduler')
        mock_atexit = mocker.patch('atexit.register')

        init_app()

        mock_init_sched.assert_called_once()
        mock_atexit.assert_called_once()

    def test_init_app_reraises_on_failure(self, app, mocker):
        from app import init_app
        mocker.patch('sqlalchemy.orm.session.Session.execute', side_effect=Exception('db down'))

        with pytest.raises(Exception, match='db down'):
            init_app()


# ============================================================================
# wsgi.py
# ============================================================================

class TestWsgiModule:

    def test_wsgi_imports_app(self):
        import wsgi
        assert wsgi.app is not None
        assert callable(wsgi.init_app)
        assert wsgi.models_db is not None


# ============================================================================
# scheduled_tasks.py branch coverage
# ============================================================================

class TestSchedulerBranchesFull:

    def test_scheduler_disabled_when_global_none(self, app, monkeypatch):
        import scheduled_tasks
        monkeypatch.setattr(scheduled_tasks, 'scheduler', None)
        app.config['SCHEDULER_ENABLED'] = False
        result = scheduled_tasks.init_scheduler(app)
        assert result is not None

    def test_scheduler_add_job_exception(self, app, monkeypatch, mocker):
        import scheduled_tasks
        monkeypatch.setattr(scheduled_tasks, 'scheduler', None)
        app.config['SCHEDULER_ENABLED'] = True
        app.config['SCHEDULER_INTERVAL_MINUTES'] = 15
        mocker.patch(
            'apscheduler.schedulers.background.BackgroundScheduler.add_job',
            side_effect=Exception('boom')
        )
        result = scheduled_tasks.init_scheduler(app)
        assert result is not None

    def test_scheduler_start_exception(self, app, monkeypatch, mocker):
        import scheduled_tasks
        monkeypatch.setattr(scheduled_tasks, 'scheduler', None)
        app.config['SCHEDULER_ENABLED'] = True
        mocker.patch(
            'apscheduler.schedulers.background.BackgroundScheduler.start',
            side_effect=Exception('boom')
        )
        result = scheduled_tasks.init_scheduler(app)
        assert result is not None

    def test_shutdown_when_scheduler_none(self, monkeypatch):
        import scheduled_tasks
        monkeypatch.setattr(scheduled_tasks, 'scheduler', None)
        scheduled_tasks.shutdown_scheduler()


class TestRefreshAndStatusErrorPaths:

    def test_refresh_error_handling_fails_too(self, mocker):
        from scheduled_tasks import refresh_reporting_data
        import db_service
        mocker.patch.object(db_service.MetadataRepository, 'update_last_refresh_time',
                             side_effect=Exception('boom'))
        mocker.patch.object(db_service.MetadataRepository, 'set_metadata',
                             side_effect=Exception('also boom'))
        refresh_reporting_data()

    def test_get_refresh_status_error(self, mocker):
        from scheduled_tasks import get_refresh_status
        import db_service
        mocker.patch.object(db_service.MetadataRepository, 'get_last_refresh_time',
                             side_effect=Exception('boom'))
        status = get_refresh_status()
        assert 'error' in status
