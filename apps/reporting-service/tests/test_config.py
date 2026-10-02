"""
Tests for Flask application configuration and initialization
"""

import os

import pytest
from sqlalchemy import text
from config import (
    Config,
    DevelopmentConfig,
    ProductionConfig,
    TestingConfig,
    normalize_database_url,
)


class TestConfig:
    """Test configuration classes"""
    
    def test_base_config_defaults(self):
        """Test base Config class defaults"""
        config = Config()
        assert config.JWT_ALGORITHM == 'RS256'
        assert config.JWT_EXPIRATION_SECONDS == 900
        assert any('4200' in origin for origin in config.CORS_ORIGINS)
    
    def test_development_config(self):
        """Test development configuration"""
        config = DevelopmentConfig()
        assert config.DEBUG is True
        assert config.ENV == 'development'
    
    def test_production_config(self):
        """Test production configuration"""
        config = ProductionConfig()
        assert config.DEBUG is False
        assert config.ENV == 'production'
    
    def test_testing_config(self):
        """Test testing configuration"""
        config = TestingConfig()
        assert config.TESTING is True
        assert config.DEBUG is True
    
    def test_auth_jwks_url_construction(self):
        """Test JWKS URL is constructed correctly"""
        config = Config()
        assert '/.well-known/jwks.json' in config.AUTH_JWKS_URL
    
    def test_cors_origins_parsing(self):
        """Test CORS origins are parsed correctly"""
        config = Config()
        assert isinstance(config.CORS_ORIGINS, list)
        assert len(config.CORS_ORIGINS) > 0

    def test_normalize_database_url_postgresql_scheme(self):
        """Test PostgreSQL URLs use the psycopg driver."""
        database_url = 'postgresql://user:pass@localhost:5432/reporting'

        assert normalize_database_url(database_url) == (
            'postgresql+psycopg://user:pass@localhost:5432/reporting'
        )

    def test_normalize_database_url_postgres_alias(self):
        """Test postgres:// aliases are normalized."""
        database_url = 'postgres://user:pass@localhost:5432/reporting'

        assert normalize_database_url(database_url) == (
            'postgresql+psycopg://user:pass@localhost:5432/reporting'
        )

    def test_testing_config_normalizes_environment_url(self, monkeypatch):
        """Test TEST_DATABASE_URL is normalized when loaded from the environment."""
        monkeypatch.setenv(
            'TEST_DATABASE_URL',
            'postgresql://trading_season:password@localhost:5432/trading_season_test'
        )

        class RuntimeTestingConfig(Config):
            DATABASE_URL = normalize_database_url(os.getenv('TEST_DATABASE_URL', ''))

        assert RuntimeTestingConfig.DATABASE_URL == (
            'postgresql+psycopg://trading_season:password@localhost:5432/trading_season_test'
        )


class TestAppInitialization:
    """Test Flask application initialization"""
    
    def test_app_created(self, app):
        """Test Flask app is created"""
        assert app is not None
        assert app.name == 'app'
    
    def test_app_config_loaded(self, app):
        """Test app configuration is loaded"""
        assert app.config['TESTING'] is True
        assert app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] is False
    
    def test_database_initialized(self, app):
        """Test database is initialized"""
        with app.app_context():
            # Verify we can execute a simple query
            result = app.extensions['sqlalchemy'].session.execute(text('SELECT 1'))
            assert result is not None
    
    def test_cors_enabled(self, client):
        """Test CORS is enabled on responses."""
        response = client.get('/', headers={'Origin': 'http://localhost:4200'})
        assert response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:4200'


class TestHealthCheckEndpoint:
    """Test health check endpoint"""
    
    def test_health_endpoint_success(self, client):
        """Test health endpoint returns 200"""
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
        assert data['service'] == 'reporting-service'
    
    def test_health_endpoint_has_version(self, client):
        """Test health endpoint includes version"""
        response = client.get('/health')
        data = response.get_json()
        assert 'version' in data
        assert data['version'] == '0.1.0'


class TestRootEndpoint:
    """Test root endpoint"""
    
    def test_root_endpoint_success(self, client):
        """Test root endpoint returns service info"""
        response = client.get('/')
        assert response.status_code == 200
        data = response.get_json()
        assert 'service' in data
        assert data['service'] == 'Trading Season Reporting Service'
    
    def test_root_endpoint_lists_endpoints(self, client):
        """Test root endpoint lists available endpoints"""
        response = client.get('/')
        data = response.get_json()
        assert 'api_endpoints' in data
        assert 'portfolio' in data['api_endpoints']


class TestErrorHandlers:
    """Test error handlers"""
    
    def test_404_error_handler(self, client):
        """Test 404 error handler"""
        response = client.get('/nonexistent-endpoint')
        assert response.status_code == 404
        data = response.get_json()
        assert 'error' in data
    
    def test_401_missing_auth(self, client):
        """Test 401 for missing authorization"""
        response = client.get('/api/reporting/portfolio')
        assert response.status_code == 401
        data = response.get_json()
        assert 'error' in data
        assert 'authorization' in data['error'].lower()
