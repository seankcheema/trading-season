"""
Tests for SQLAlchemy models
"""

import pytest
from decimal import Decimal
from datetime import datetime
import uuid
from models import (
    User, Account, Instrument, Order, Fill, Holding,
    CashTransaction, HoldingMovement, AuditTrail, ReportingMetadata
)


class TestUserModel:
    """Test User model"""
    
    def test_user_creation(self, test_user):
        """Test user can be created"""
        assert test_user.email == 'testuser@example.com'
        assert test_user.first_name == 'Test'
        assert test_user.trader_level == 'INTERMEDIATE'
    
    def test_user_fields(self, test_user):
        """Test user has all required fields"""
        assert test_user.user_id is not None
        assert test_user.email is not None
        assert test_user.first_name is not None
        assert test_user.last_name is not None
        assert test_user.ssn is not None
        assert test_user.available_funds is not None
    
    def test_user_repr(self, test_user):
        """Test user string representation"""
        assert 'testuser@example.com' in repr(test_user)


class TestAccountModel:
    """Test Account model"""
    
    def test_account_creation(self, test_account):
        """Test account can be created"""
        assert test_account.account_name == 'Test Account'
        assert test_account.account_type == 'TRADING'
        assert test_account.status == 'ACTIVE'
    
    def test_account_fields(self, test_account):
        """Test account has all required fields"""
        assert test_account.account_id is not None
        assert test_account.user_id is not None
        assert test_account.cash_balance is not None
    
    def test_account_relationships(self, test_account, test_user):
        """Test account has correct relationships"""
        assert test_account.user_id == test_user.user_id
    
    def test_account_repr(self, test_account):
        """Test account string representation"""
        assert 'Test Account' in repr(test_account)


class TestInstrumentModel:
    """Test Instrument model"""
    
    def test_instrument_creation(self, test_instrument):
        """Test instrument can be created"""
        assert test_instrument.symbol == 'AAPL'
        assert test_instrument.name == 'Apple Inc.'
        assert test_instrument.asset_class == 'EQUITY'
    
    def test_instrument_fields(self, test_instrument):
        """Test instrument has all required fields"""
        assert test_instrument.instrument_id is not None
        assert test_instrument.is_tradable is True
    
    def test_instrument_repr(self, test_instrument):
        """Test instrument string representation"""
        assert 'AAPL' in repr(test_instrument)


class TestOrderModel:
    """Test Order model"""
    
    def test_order_creation(self, test_order):
        """Test order can be created"""
        assert test_order.order_type == 'BUY'
        assert test_order.quantity == Decimal('100.00')
        assert test_order.status == 'FILLED'
    
    def test_order_fields(self, test_order):
        """Test order has all required fields"""
        assert test_order.order_id is not None
        assert test_order.account_id is not None
        assert test_order.user_id is not None
        assert test_order.instrument_id is not None
    
    def test_order_relationships(self, test_order, test_account):
        """Test order has correct relationships"""
        assert test_order.account_id == test_account.account_id
    
    def test_order_repr(self, test_order):
        """Test order string representation"""
        assert 'BUY' in repr(test_order)


class TestFillModel:
    """Test Fill model"""
    
    def test_fill_creation(self, test_fill):
        """Test fill can be created"""
        assert test_fill.filled_quantity == Decimal('100.00')
        assert test_fill.filled_price == Decimal('150.00')
        assert test_fill.commission == Decimal('10.00')
    
    def test_fill_fields(self, test_fill):
        """Test fill has all required fields"""
        assert test_fill.fill_id is not None
        assert test_fill.order_id is not None
        assert test_fill.fill_timestamp is not None
    
    def test_fill_repr(self, test_fill):
        """Test fill string representation"""
        assert '100.00' in repr(test_fill)


class TestHoldingModel:
    """Test Holding model"""
    
    def test_holding_creation(self, test_holding):
        """Test holding can be created"""
        assert test_holding.quantity == Decimal('100.00')
        assert test_holding.average_cost == Decimal('150.00')
    
    def test_holding_fields(self, test_holding):
        """Test holding has all required fields"""
        assert test_holding.holding_id is not None
        assert test_holding.account_id is not None
        assert test_holding.instrument_id is not None
    
    def test_holding_repr(self, test_holding):
        """Test holding string representation"""
        assert '100.00' in repr(test_holding)


class TestCashTransactionModel:
    """Test CashTransaction model"""
    
    def test_cash_transaction_creation(self, test_cash_transaction):
        """Test cash transaction can be created"""
        assert test_cash_transaction.amount == Decimal('1000.00')
        assert test_cash_transaction.transaction_type == 'DEPOSIT'
    
    def test_cash_transaction_fields(self, test_cash_transaction):
        """Test cash transaction has all required fields"""
        assert test_cash_transaction.transaction_id is not None
        assert test_cash_transaction.account_id is not None
        assert test_cash_transaction.user_id is not None
        assert test_cash_transaction.timestamp is not None
    
    def test_cash_transaction_repr(self, test_cash_transaction):
        """Test cash transaction string representation"""
        assert 'DEPOSIT' in repr(test_cash_transaction)


class TestModelTimestamps:
    """Test model timestamp handling"""
    
    def test_user_timestamps(self, test_user):
        """Test user has created_at and updated_at"""
        assert test_user.created_at is not None
        assert test_user.updated_at is not None
        assert isinstance(test_user.created_at, datetime)
    
    def test_account_timestamps(self, test_account):
        """Test account has created_at and updated_at"""
        assert test_account.created_at is not None
        assert test_account.updated_at is not None
    
    def test_holding_timestamps(self, test_holding):
        """Test holding has created_at and updated_at"""
        assert test_holding.created_at is not None
        assert test_holding.updated_at is not None


class TestModelIndexes:
    """Test model indexes are properly defined"""
    
    def test_user_email_index(self, db_session, test_user):
        """Test user email is indexed"""
        # Email should be unique and indexed
        user = db_session.query(User).filter_by(email=test_user.email).first()
        assert user is not None
    
    def test_account_user_id_index(self, db_session, test_account):
        """Test account user_id is indexed"""
        accounts = db_session.query(Account).filter_by(
            user_id=test_account.user_id
        ).all()
        assert len(accounts) > 0
