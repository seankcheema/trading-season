import os
from datetime import timedelta


def normalize_database_url(database_url: str) -> str:
    """Normalize PostgreSQL URLs to the Python 3.14-compatible psycopg driver."""
    if database_url.startswith('postgres://'):
        return database_url.replace('postgres://', 'postgresql+psycopg://', 1)
    if database_url.startswith('postgresql://'):
        return database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    return database_url

class Config:
    """Base configuration"""
    
    # Flask
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    ENV = os.getenv('FLASK_ENV', 'production')
    
    # Database
    DATABASE_URL = normalize_database_url(os.getenv(
        'DATABASE_URL',
        'postgresql+psycopg://trading_season:password@localhost:5432/trading_season'
    ))
    
    # Auth Service
    AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://localhost:3001')
    AUTH_JWKS_URL = f"{AUTH_SERVICE_URL}/.well-known/jwks.json"
    AUTH_JWT_ISSUER = os.getenv('AUTH_JWT_ISSUER', 'http://localhost:3001')
    AUTH_JWT_AUDIENCE = os.getenv('AUTH_JWT_AUDIENCE', 'trading-season-api')
    
    # Reporting Service
    REPORTING_SERVICE_PORT = int(os.getenv('REPORTING_SERVICE_PORT', 8083))
    REPORTING_SERVICE_HOST = os.getenv('REPORTING_SERVICE_HOST', '0.0.0.0')
    
    # Report runs. The scheduler runs in the consumer process only (consumer.py);
    # the web service leaves SCHEDULER_ENABLED false.
    SCHEDULER_ENABLED = os.getenv('SCHEDULER_ENABLED', 'True').lower() == 'true'
    SCHEDULER_INTERVAL_MINUTES = int(os.getenv('SCHEDULER_INTERVAL_MINUTES', 15))

    # Where the consumer writes trade events and the runs it generates. The web
    # service reads this directory; in Compose it is the shared reporting_files volume.
    REPORTING_FILES_DIR = os.getenv('REPORTING_FILES_DIR', os.path.join(os.getcwd(), 'data', 'reporting'))

    # Kafka: the trade-events topic Order and Sell publishes to. On the host the
    # broker is localhost:29092; inside Compose it is kafka:9092.
    KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:29092')
    KAFKA_TRADE_EVENTS_TOPIC = os.getenv('KAFKA_TRADE_EVENTS_TOPIC', 'trade-events')
    REPORTING_CONSUMER_GROUP = os.getenv('REPORTING_CONSUMER_GROUP', 'reporting-ingester')
    
    # JWT
    JWT_EXPIRATION_SECONDS = 900  # 15 minutes
    JWT_ALGORITHM = 'RS256'
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:4200').split(',')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    ENV = 'development'


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    ENV = 'production'


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    DATABASE_URL = normalize_database_url(os.getenv(
        'TEST_DATABASE_URL',
        'postgresql+psycopg://trading_season:password@localhost:5432/trading_season_test'
    ))


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
