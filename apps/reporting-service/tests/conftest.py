"""
Pytest fixtures for the reporting service.

Tests run on the same in-memory read model the service uses, created from
the ORM models, and on a temporary reporting files directory. No broker, no
database server, no Docker.
"""

import os
import sys
import tempfile
import uuid
from datetime import date
from decimal import Decimal

import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set test environment before importing the Flask app
os.environ['FLASK_ENV'] = 'testing'
os.environ['REPORTING_FILES_DIR'] = tempfile.mkdtemp(prefix='reporting-files-')


@pytest.fixture(scope='session')
def app():
    """Create the Flask application for testing"""
    from app import app as flask_app, db
    from app import register_routes
    from config import TestingConfig

    flask_app.config.from_object(TestingConfig)
    flask_app.config['TESTING'] = True
    register_routes()

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create Flask test client"""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """An empty read model for each test"""
    from models import db

    with app.app_context():
        db.drop_all()
        db.create_all()
        yield db.session
        db.session.rollback()
        db.session.remove()
        db.drop_all()
        db.create_all()


@pytest.fixture
def files_dir(app, tmp_path):
    """Point the app at a fresh reporting files directory for this test."""
    previous = app.config['REPORTING_FILES_DIR']
    app.config['REPORTING_FILES_DIR'] = str(tmp_path)
    yield tmp_path
    app.config['REPORTING_FILES_DIR'] = previous


@pytest.fixture
def test_user(db_session):
    """A trader, as a CUSTOMER_PROFILE record leaves one in the read model."""
    from models import User

    user = User(
        user_id=uuid.uuid4(),
        first_name='Joanna',
        last_name='Trader',
        trader_level='INTERMEDIATE',
        available_funds=Decimal('50000.00'),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_account(db_session, test_user):
    """The trader's account, as a TRADING_ACCOUNT record leaves one in the read model."""
    from models import Account

    account = Account(
        user_id=test_user.user_id,
        name='Growth Portfolio',
        opened_date=date(2026, 1, 15),
        currency='USD',
    )
    db_session.add(account)
    db_session.commit()
    return account


@pytest.fixture
def authenticated(mocker, test_user):
    """Make every request look like it carries test_user's token, as an analyst."""
    mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id), 'roles': ['ANALYST']})
    return {'Authorization': 'Bearer test-token'}


@pytest.fixture
def authenticated_admin(mocker, test_user):
    """Make every request look like it carries test_user's token, as an admin."""
    mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id), 'roles': ['ADMIN']})
    return {'Authorization': 'Bearer test-token'}


@pytest.fixture
def authenticated_trader(mocker, test_user):
    """Make every request look like it carries test_user's token, as a trader."""
    mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id), 'roles': ['TRADER']})
    return {'Authorization': 'Bearer test-token'}


@pytest.fixture
def mock_jwks(mocker):
    """Mock JWKS response from Auth Service"""
    mock_response = {
        'keys': [
            {
                'kid': 'test-key-1',
                'kty': 'RSA',
                'use': 'sig',
                'alg': 'RS256',
                'n': 'test-n-value',
                'e': 'AQAB'
            }
        ]
    }
    mock_get = mocker.patch('requests.get')
    mock_get.return_value.json.return_value = mock_response
    mock_get.return_value.raise_for_status.return_value = None
    return mock_get


@pytest.fixture
def app_context(app):
    """Application context for tests"""
    with app.app_context():
        yield app
