"""
Pytest fixtures and configuration for reporting service tests
"""

import pytest
import os
import sys
from datetime import datetime, timedelta, UTC
import uuid
import jwt
from decimal import Decimal

TEST_HS256_KEY = 'reporting-service-test-secret-key-32b'

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set test environment before importing Flask app
os.environ['FLASK_ENV'] = 'testing'
os.environ['TEST_DATABASE_URL'] = 'sqlite:///:memory:'


@pytest.fixture(scope='session')
def app():
    """Create Flask application for testing"""
    from app import app as flask_app, db
    from app import register_routes
    from config import TestingConfig
    
    flask_app.config.from_object(TestingConfig)
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    flask_app.config['TESTING'] = True
    register_routes()
    
    # Create test database
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
def runner(app):
    """Create Flask CLI runner"""
    return app.test_cli_runner()


@pytest.fixture
def db_session(app):
    """Create a clean database session for each test"""
    from models import db
    
    with app.app_context():
        # Drop all tables to start fresh
        db.drop_all()
        # Create all tables
        db.create_all()
        yield db.session
        # Clean up
        db.session.rollback()
        db.session.remove()
        db.drop_all()
        db.create_all()


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    from models import User

    user = User(
        user_id=uuid.uuid4(),
        email='testuser@example.com',
        first_name='Test',
        last_name='User',
        middle_name='M',
        address='123 Test St, City, State 12345',
        ssn='123-45-6789',
        date_of_birth=datetime(1990, 1, 1),
        trader_level='INTERMEDIATE',
        available_funds=Decimal('50000.00')
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_account(db_session, test_user):
    """Create a test account"""
    from models import Account
    
    account = Account(
        user_id=test_user.user_id,
        account_name='Test Account',
        account_type='TRADING',
        status='ACTIVE',
        cash_balance=Decimal('10000.00')
    )
    db_session.add(account)
    db_session.commit()
    return account


@pytest.fixture
def test_instrument(db_session):
    """Create a test instrument"""
    from models import Instrument

    instrument = Instrument(
        symbol='AAPL',
        name='Apple Inc.',
        asset_class='EQUITY',
        is_tradable=True
    )
    db_session.add(instrument)
    db_session.commit()
    return instrument


@pytest.fixture
def test_order(db_session, test_account, test_instrument):
    """Create a test order"""
    from models import Order
    
    order = Order(
        account_id=test_account.account_id,
        user_id=test_account.user_id,
        instrument_id=test_instrument.instrument_id,
        order_type='BUY',
        quantity=Decimal('100.00'),
        indicative_price=Decimal('150.00'),
        status='FILLED',
        client_reference=uuid.uuid4(),
        submitted_at=datetime.now(UTC),
        resolved_at=datetime.now(UTC)
    )
    db_session.add(order)
    db_session.commit()
    return order


@pytest.fixture
def test_fill(db_session, test_order):
    """Create a test fill"""
    from models import Fill
    
    fill = Fill(
        order_id=test_order.order_id,
        filled_quantity=Decimal('100.00'),
        filled_price=Decimal('150.00'),
        commission=Decimal('10.00'),
        fill_timestamp=datetime.now(UTC)
    )
    db_session.add(fill)
    db_session.commit()
    return fill


@pytest.fixture
def test_holding(db_session, test_account, test_instrument):
    """Create a test holding"""
    from models import Holding
    
    holding = Holding(
        account_id=test_account.account_id,
        instrument_id=test_instrument.instrument_id,
        quantity=Decimal('100.00'),
        average_cost=Decimal('150.00')
    )
    db_session.add(holding)
    db_session.commit()
    return holding


@pytest.fixture
def test_cash_transaction(db_session, test_account, test_user):
    """Create a test cash transaction"""
    from models import CashTransaction
    
    transaction = CashTransaction(
        account_id=test_account.account_id,
        user_id=test_user.user_id,
        amount=Decimal('1000.00'),
        transaction_type='DEPOSIT',
        timestamp=datetime.now(UTC)
    )
    db_session.add(transaction)
    db_session.commit()
    return transaction


@pytest.fixture
def valid_token(test_user):
    """Create a valid JWT token for testing"""
    payload = {
        'sub': str(test_user.user_id),
        'iss': 'http://localhost:3001',
        'aud': 'trading-season-api',
        'exp': datetime.now(UTC) + timedelta(minutes=15),
        'iat': datetime.now(UTC)
    }
    # Create a mock token - note: in real tests, you'd use RS256 with actual keys
    token = jwt.encode(payload, TEST_HS256_KEY, algorithm='HS256')
    return token


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
