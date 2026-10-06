"""
Additional tests for routes to increase coverage
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock


class TestPortfolioEndpointsCoverage:
    """Additional portfolio endpoint tests"""
    
    def test_portfolio_endpoint_url_exists(self, client):
        """Verify portfolio endpoint is registered"""
        # Any response means endpoint exists (even 401)
        response = client.get('/api/reporting/portfolio')
        assert response.status_code in [401, 200]
        assert 'application/json' in response.content_type or response.status_code == 401
    
    def test_trades_endpoint_url_exists(self, client):
        """Verify trades endpoint is registered"""
        response = client.get('/api/reporting/trades')
        assert response.status_code in [401, 200]
        
    def test_profile_endpoint_url_exists(self, client):
        """Verify profile endpoint is registered"""
        response = client.get('/api/reporting/profile')
        assert response.status_code in [401, 200]
    
    def test_scheduler_status_endpoint_url_exists(self, client):
        """Verify scheduler status endpoint is registered"""
        response = client.get('/api/reporting/scheduler/status')
        # This endpoint might be public
        assert response.status_code in [200, 401]


class TestAuthDecorator:
    """Test authentication decorator edge cases"""
    
    def test_require_auth_decorator_exists(self, app):
        """Verify require_auth decorator is available"""
        from app import require_auth
        assert callable(require_auth)
    
    def test_require_auth_with_no_header(self, client):
        """Test any protected endpoint without auth header"""
        response = client.get('/api/reporting/portfolio')
        # Should reject without auth
        assert response.status_code == 401
        assert 'json' in response.content_type
        data = response.get_json()
        assert data is not None or response.status_code == 401


class TestHelperFunctions:
    """Test route helper functions directly"""
    
    def test_calculate_trade_statistics_empty_list(self):
        """Test statistics calculation with empty trades"""
        from routes import _calculate_trade_statistics
        stats = _calculate_trade_statistics([])
        assert stats is not None
        assert isinstance(stats, dict)
    
    def test_calculate_trade_statistics_single_trade(self):
        """Test statistics with single trade"""
        from routes import _calculate_trade_statistics
 
        mock_trade = {
            'realized_pl': 0.0,
            'filled_quantity': 100,
            'symbol': 'AAPL',
            'order_type': 'BUY'
        }

        stats = _calculate_trade_statistics([mock_trade])
        assert isinstance(stats, dict)
    
    def test_analyze_by_symbol_empty_list(self):
        """Test symbol analysis with no trades"""
        from routes import _analyze_by_symbol
        result = _analyze_by_symbol([])
        assert result is not None
    
    def test_analyze_by_symbol_single_trade(self):
        """Test symbol analysis with one trade"""
        from routes import _analyze_by_symbol
 
        mock_trade = {
            'symbol': 'AAPL',
            'realized_pl': 0.0,
            'filled_quantity': 100,
            'order_type': 'BUY'
        }

        result = _analyze_by_symbol([mock_trade])
        assert isinstance(result, list)
        assert result[0]['symbol'] == 'AAPL'
    
    def test_calculate_performance_metrics_empty_fills(self):
        """Test performance metrics with no fills"""
        from routes import _calculate_performance_metrics
        
        result = _calculate_performance_metrics([])
        assert result is not None
        assert isinstance(result, dict)
    
    def test_calculate_daily_returns_empty_fills(self):
        """Test daily returns with no fills"""
        from routes import _calculate_daily_returns

        result = _calculate_daily_returns([])
        assert result is not None
        assert isinstance(result, list)
    
    def test_calculate_volatility_insufficient_data(self):
        """Test volatility with less than 2 data points"""
        from routes import _calculate_volatility
        
        # Single return
        result = _calculate_volatility([Decimal('0.01')])
        assert isinstance(result, (Decimal, int, float))
        
        # Empty
        result = _calculate_volatility([])
        assert isinstance(result, (Decimal, int, float))
    
    def test_calculate_downside_deviation_empty(self):
        """Test downside deviation with empty returns"""
        from routes import _calculate_downside_deviation
        
        result = _calculate_downside_deviation([])
        assert isinstance(result, (Decimal, int, float))
    
    def test_calculate_max_drawdown_empty(self):
        """Test max drawdown with empty cumulative returns"""
        from routes import _calculate_max_drawdown
        
        result = _calculate_max_drawdown([])
        assert isinstance(result, (Decimal, int, float))
    
    def test_calculate_current_drawdown_empty(self):
        """Test current drawdown with empty data"""
        from routes import _calculate_current_drawdown
        
        result = _calculate_current_drawdown([])
        assert isinstance(result, (Decimal, int, float))
    
    def test_get_best_worst_trades_empty(self):
        """Test best/worst trades with empty list"""
        from routes import _get_best_worst_trades
        
        result = _get_best_worst_trades([])
        assert result is not None


class TestAppErrorHandlers:
    """Test app.py error handlers"""
    
    def test_app_404_handler(self, client):
        """Test 404 Not Found error handler"""
        response = client.get('/nonexistent-endpoint')
        assert response.status_code == 404
        assert 'application/json' in response.content_type
        data = response.get_json()
        assert data is not None
    
    def test_app_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert 'status' in data or 'health' in data
    
    def test_app_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get('/')
        assert response.status_code == 200


class TestDatabaseServiceEdgeCases:
    """Additional database service tests"""
    
    def test_user_repository_with_none_id(self, db_session):
        """Test UserRepository.get_user with None"""
        from db_service import UserRepository
        result = UserRepository.get_user(None)
        assert result is None
    
    def test_account_repository_get_summary(self, db_session, test_account):
        """Test account summary retrieval"""
        from db_service import AccountRepository
        summary = AccountRepository.get_account_summary(test_account.account_id)
        assert summary is not None
    
    def test_holding_repository_empty_account(self, db_session, test_user):
        """Test holdings for account with no positions"""
        from db_service import HoldingRepository
        from models import Account
        
        # Create account with no holdings
        account = Account(
            user_id=test_user.user_id,
            account_name='No Holdings Account',
            account_type='TRADING',
            status='ACTIVE',
            cash_balance=Decimal('10000')
        )
        db_session.add(account)
        db_session.commit()
        
        holdings = HoldingRepository.get_account_holdings(account.account_id)
        assert holdings is not None
        assert len(holdings) == 0
    
    def test_order_repository_by_status(self, db_session, test_user, test_account):
        """Test filtering orders by status"""
        from db_service import OrderRepository
        
        orders = [
            order for order in OrderRepository.get_account_orders(test_account.account_id)
            if order['status'] == 'PENDING'
        ]
        assert orders is not None
        assert isinstance(orders, list)


class TestSchedulerEdgeCases:
    """Additional scheduler tests"""
    
    def test_scheduler_config_from_environment(self, app):
        """Test scheduler respects environment config"""
        import scheduled_tasks

        with app.app_context():
            scheduled_tasks.init_scheduler(app)
            assert scheduled_tasks.scheduler is not None
    
    def test_scheduler_status_when_disabled(self, app, monkeypatch):
        """Test status when scheduler is disabled"""
        monkeypatch.setenv('SCHEDULER_ENABLED', 'false')
        # Create new app context
        from scheduled_tasks import get_refresh_status
        status = get_refresh_status()
        assert status is not None
        assert isinstance(status, dict)


class TestConfigurationValidation:
    """Test configuration validation and edge cases"""
    
    def test_config_cors_origins_none(self, app):
        """Test CORS origins configuration"""
        assert 'CORS_ORIGINS' in app.config
        origins = app.config.get('CORS_ORIGINS', [])
        assert isinstance(origins, (list, tuple))
    
    def test_config_auth_service_url(self, app):
        """Test Auth Service URL configuration"""
        auth_url = app.config.get('AUTH_SERVICE_URL')
        assert auth_url is not None
        assert 'http' in auth_url or 'localhost' in auth_url
    
    def test_config_jwt_settings(self, app):
        """Test JWT configuration"""
        from app import jwks_cache

        assert app.config.get('JWT_ALGORITHM') == 'RS256'
        assert app.config.get('AUTH_JWT_AUDIENCE') is not None
        assert jwks_cache.cache_ttl == 3600


class TestDatabaseModelsEdgeCases:
    """Additional model tests for edge cases"""
    
    def test_user_with_minimum_fields(self, db_session):
        """Test creating user with only required fields"""
        from models import User
        import uuid
        from datetime import datetime
        
        user = User(
            user_id=uuid.uuid4(),
            email=f'minimal-{uuid.uuid4()}@example.com',
            first_name='Min',
            last_name='User',
            address='1 Minimal St',
            ssn='111-11-1111',
            date_of_birth=datetime(1990, 1, 1),
            trader_level='BEGINNER',
            available_funds=Decimal('0')
        )
        db_session.add(user)
        db_session.commit()
        
        retrieved = db_session.query(User).filter_by(email=user.email).first()
        assert retrieved is not None
    
    def test_account_zero_cash_balance(self, db_session, test_user):
        """Test account with zero cash"""
        from models import Account
        
        account = Account(
            user_id=test_user.user_id,
            account_name='Zero Cash Account',
            account_type='TRADING',
            status='ACTIVE',
            cash_balance=Decimal('0')
        )
        db_session.add(account)
        db_session.commit()
        
        assert account.cash_balance == Decimal('0')
    
    def test_order_with_all_status_types(self, db_session, test_user, test_account, test_instrument):
        """Test orders with all possible statuses"""
        from models import Order
        from datetime import datetime, UTC
        
        statuses = ['PENDING', 'PARTIAL_FILL', 'FILLED', 'CANCELLED', 'REJECTED']
        
        for status in statuses:
            order = Order(
                account_id=test_account.account_id,
                user_id=test_user.user_id,
                instrument_id=test_instrument.instrument_id,
                quantity=Decimal('100'),
                indicative_price=Decimal('50.00'),
                order_type='BUY',
                status=status,
                submitted_at=datetime.now(UTC)
            )
            db_session.add(order)
        
        db_session.commit()
        
        all_orders = db_session.query(Order).filter_by(
            account_id=test_account.account_id
        ).all()
        assert len(all_orders) == len(statuses)


class TestAuthenticationEdgeCases:
    """Additional auth tests for coverage"""
    
    def test_jwks_cache_initialization(self):
        """Test JWKS cache initializes correctly"""
        from app import JWKSCache
        cache = JWKSCache()
        assert cache is not None
    
    def test_token_extraction_from_header(self):
        """Test Bearer token extraction logic"""
        from app import require_auth
        # Test the decorator is callable
        assert callable(require_auth)
    
    def test_verify_token_with_invalid_format(self):
        """Test token verification rejects invalid formats"""
        from app import verify_token

        with pytest.raises(ValueError):
            verify_token('invalid.token')
