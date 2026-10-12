import os


class Config:
    """Base configuration"""

    # Flask
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    ENV = os.getenv('FLASK_ENV', 'production')

    # The read model. Not the trading database, which this service never
    # connects to: an in-memory SQLite database each process fills from the
    # event files the consumer writes (read_model.py). It is not configurable
    # because there is nothing outside the process to point it at.
    READ_MODEL_URL = 'sqlite:///:memory:'

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

    # Where the consumer writes the messages it consumed and the runs it
    # generates. The web service reads this directory and nothing else; in
    # Compose it is the shared reporting_files volume.
    REPORTING_FILES_DIR = os.getenv('REPORTING_FILES_DIR', os.path.join(os.getcwd(), 'data', 'reporting'))

    # Kafka: the service's only source of data. trade-events carries every
    # order status change from Order and Sell; platform-records carries the
    # sign-ins, profiles, accounts, transfers, valuations and audit entries the
    # trading services publish. On the host the broker is localhost:29092;
    # inside Compose it is kafka:9092.
    KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:29092')
    KAFKA_TRADE_EVENTS_TOPIC = os.getenv('KAFKA_TRADE_EVENTS_TOPIC', 'trade-events')
    KAFKA_PLATFORM_RECORDS_TOPIC = os.getenv('KAFKA_PLATFORM_RECORDS_TOPIC', 'platform-records')
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


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
