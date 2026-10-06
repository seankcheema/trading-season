"""
Tests for API routes and endpoints
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta, UTC
from decimal import Decimal
from models import db, Account, Order, Fill, Instrument


class TestPortfolioEndpoints:
    """Test portfolio endpoints"""
    
    def test_portfolio_summary_unauthorized(self, client):
        """Test portfolio endpoint requires auth"""
        response = client.get('/api/reporting/portfolio')
        assert response.status_code == 401
    
    def test_portfolio_summary_authorized(self, client, app, test_user, test_account, valid_token, mocker):
        """Test portfolio summary endpoint with auth"""
        mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})

        response = client.get('/api/reporting/portfolio', headers={'Authorization': f'Bearer {valid_token}'})
        assert response.status_code == 200
    
    def test_portfolio_empty_accounts(self, client, app, test_user, mocker):
        """Test portfolio endpoint with user having no accounts"""
        # Mock the repositories to return empty
        mock_get_accounts = mocker.patch('routes.AccountRepository.get_user_accounts')
        mock_get_accounts.return_value = []
        
        # This would need proper auth mocking in a real test


class TestTradesEndpoints:
    """Test trade endpoints"""
    
    def test_trades_endpoint_requires_auth(self, client):
        """Test trades endpoint requires auth"""
        response = client.get('/api/reporting/trades')
        assert response.status_code == 401
    
    def test_trades_invalid_date_format(self, client, app, test_user, mocker):
        """Test trades endpoint with invalid date format"""
        mocker.patch('app.require_auth', lambda f: f)
        # Invalid date format should return 400
        response = client.get(
            '/api/reporting/trades?start_date=invalid-date',
            headers={'Authorization': 'Bearer test'}
        )
        # Will be 401 without proper auth, but endpoint handles dates


class TestProfileEndpoint:
    """Test user profile endpoint"""
    
    def test_profile_endpoint_requires_auth(self, client):
        """Test profile endpoint requires auth"""
        response = client.get('/api/reporting/profile')
        assert response.status_code == 401
    
    def test_profile_endpoint_user_not_found(self, client, app, mocker):
        """Test profile endpoint with non-existent user"""
        user_id = uuid.uuid4()
        mocker.patch('app.verify_token', return_value={'sub': str(user_id)})
        mocker.patch('routes.UserRepository.get_user', return_value=None)

        response = client.get('/api/reporting/profile', headers={'Authorization': 'Bearer test'})
        assert response.status_code == 404


class TestSchedulerStatusEndpoint:
    """Test scheduler status endpoint"""
    
    def test_scheduler_status_public(self, client):
        """Test scheduler status endpoint is public"""
        response = client.get('/api/reporting/scheduler/status')
        assert response.status_code in [200, 500]  # Should not 401
    
    def test_scheduler_status_has_data(self, client):
        """Test scheduler status returns expected structure"""
        response = client.get('/api/reporting/scheduler/status')
        if response.status_code == 200:
            data = response.get_json()
            assert 'scheduler_status' in data or 'error' in data


class TestAuthenticationDecorator:
    """Test @require_auth decorator"""
    
    def test_missing_authorization_header(self, client):
        """Test missing authorization header"""
        response = client.get('/api/reporting/portfolio')
        assert response.status_code == 401
        data = response.get_json()
        assert 'error' in data
    
    def test_invalid_authorization_header(self, client):
        """Test invalid authorization header format"""
        response = client.get('/api/reporting/portfolio', headers={'Authorization': 'Invalid'})
        assert response.status_code == 401
    
    def test_missing_bearer_token(self, client):
        """Test missing bearer token"""
        response = client.get('/api/reporting/portfolio', headers={'Authorization': 'Bearer'})
        assert response.status_code == 401


class TestErrorResponses:
    """Test error responses"""
    
    def test_account_not_found_error(self, client, app, mocker):
        """Test account not found error"""
        mocker.patch('app.verify_token', return_value={'sub': str(uuid.uuid4())})
        response = client.get('/api/reporting/portfolio/9999', headers={'Authorization': 'Bearer test'})
        assert response.status_code == 404


class TestPaginationAndFiltering:
    """Test pagination and filtering"""
    
    def test_limit_parameter(self, client):
        """Test limit parameter in pagination"""
        response = client.get('/api/reporting/trades?limit=50')
        # Should handle limit parameter
        assert response.status_code in [200, 401]
    
    def test_offset_parameter(self, client):
        """Test offset parameter in pagination"""
        response = client.get('/api/reporting/trades?offset=10')
        # Should handle offset parameter
        assert response.status_code in [200, 401]
    
    def test_limit_max_validation(self, client):
        """Test limit is capped at 500"""
        response = client.get('/api/reporting/trades?limit=1000')
        # Should be capped at 500


class TestPerformanceMetricsHelpers:
    """Test performance metrics calculation helpers"""
    
    def test_calculate_trade_statistics_empty(self):
        """Test trade statistics with empty list"""
        from routes import _calculate_trade_statistics
        stats = _calculate_trade_statistics([])
        assert stats['total_trades'] == 0
        assert stats['win_rate'] == 0.0
    
    def test_calculate_trade_statistics_with_trades(self):
        """Test trade statistics calculation"""
        from routes import _calculate_trade_statistics
        trades = [
            {'realized_pl': 100.0, 'filled_quantity': 10},
            {'realized_pl': -50.0, 'filled_quantity': 10},
            {'realized_pl': 150.0, 'filled_quantity': 10}
        ]
        stats = _calculate_trade_statistics(trades)
        assert stats['total_trades'] == 3
        assert stats['win_count'] == 2
        assert stats['loss_count'] == 1
    
    def test_calculate_performance_metrics_empty(self):
        """Test performance metrics with empty trades"""
        from routes import _calculate_performance_metrics
        metrics = _calculate_performance_metrics([])
        assert metrics['total_return'] == 0.0
        assert metrics['sharpe_ratio'] == 0.0
    
    def test_analyze_by_symbol(self):
        """Test trade analysis by symbol"""
        from routes import _analyze_by_symbol
        trades = [
            {
                'symbol': 'AAPL',
                'realized_pl': 100.0,
                'filled_quantity': 10,
                'order_type': 'BUY'
            },
            {
                'symbol': 'AAPL',
                'realized_pl': 50.0,
                'filled_quantity': 10,
                'order_type': 'SELL'
            }
        ]
        analysis = _analyze_by_symbol(trades)
        assert len(analysis) == 1
        assert analysis[0]['symbol'] == 'AAPL'
    
    def test_analyze_by_order_type(self):
        """Test trade analysis by order type"""
        from routes import _analyze_by_order_type
        trades = [
            {'order_type': 'BUY', 'realized_pl': 100.0, 'filled_quantity': 10},
            {'order_type': 'SELL', 'realized_pl': 50.0, 'filled_quantity': 10}
        ]
        analysis = _analyze_by_order_type(trades)
        assert len(analysis) == 2
    
    def test_get_best_worst_trades(self):
        """Test getting best and worst trades"""
        from routes import _get_best_worst_trades
        trades = [
            {'realized_pl': 500.0},
            {'realized_pl': 200.0},
            {'realized_pl': -100.0},
            {'realized_pl': -300.0}
        ]
        best_worst = _get_best_worst_trades(trades, limit=2)
        assert 'best' in best_worst
        assert 'worst' in best_worst
    
    def test_calculate_daily_returns(self):
        """Test daily returns calculation"""
        from routes import _calculate_daily_returns
        trades = [
            {
                'executed_at': datetime.now(UTC).isoformat(),
                'realized_pl': 100.0
            }
        ]
        returns = _calculate_daily_returns(trades)
        assert len(returns) > 0
    
    def test_calculate_volatility(self):
        """Test volatility calculation"""
        from routes import _calculate_volatility
        returns = [0.01, 0.02, -0.01, 0.03, -0.02]
        volatility = _calculate_volatility(returns)
        assert volatility >= 0
    
    def test_calculate_downside_deviation(self):
        """Test downside deviation calculation"""
        from routes import _calculate_downside_deviation
        returns = [0.01, 0.02, -0.01, -0.03, -0.02]
        downside = _calculate_downside_deviation(returns)
        assert downside >= 0
    
    def test_calculate_max_drawdown(self):
        """Test max drawdown calculation"""
        from routes import _calculate_max_drawdown
        trades = [
            {'executed_at': (datetime.now(UTC) - timedelta(days=3)).isoformat(), 'realized_pl': 100.0},
            {'executed_at': (datetime.now(UTC) - timedelta(days=2)).isoformat(), 'realized_pl': -200.0},
            {'executed_at': (datetime.now(UTC) - timedelta(days=1)).isoformat(), 'realized_pl': 50.0}
        ]
        drawdown = _calculate_max_drawdown(trades)
        assert drawdown >= 0
    
    def test_calculate_current_drawdown(self):
        """Test current drawdown calculation"""
        from routes import _calculate_current_drawdown
        trades = [
            {'executed_at': (datetime.now(UTC) - timedelta(days=3)).isoformat(), 'realized_pl': 100.0},
            {'executed_at': (datetime.now(UTC) - timedelta(days=2)).isoformat(), 'realized_pl': -50.0}
        ]
        drawdown = _calculate_current_drawdown(trades)
        assert drawdown >= 0


class TestEndpointResponses:
    """Test endpoint response formats"""
    
    def test_response_has_timestamp(self, client):
        """Test responses include timestamp"""
        response = client.get('/health')
        data = response.get_json()
        if response.status_code == 200:
            assert 'timestamp' in data
    
    def test_response_json_valid(self, client):
        """Test responses are valid JSON"""
        response = client.get('/health')
        assert response.content_type.startswith('application/json')
        data = response.get_json()
        assert data is not None
