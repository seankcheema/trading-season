"""
Tests for database service layer (repositories)
"""

import pytest
from datetime import datetime, timedelta, UTC
from decimal import Decimal
from db_service import (
    UserRepository, AccountRepository, HoldingRepository,
    OrderRepository, TradeRepository, CashTransactionRepository,
    AuditRepository, MetadataRepository
)
from models import User, Account, Order, Fill


class TestUserRepository:
    """Test UserRepository"""
    
    def test_get_user(self, test_user):
        """Test getting user by ID"""
        user = UserRepository.get_user(test_user.user_id)
        assert user is not None
        assert user.email == 'testuser@example.com'
    
    def test_get_user_not_found(self):
        """Test getting non-existent user"""
        import uuid
        user = UserRepository.get_user(uuid.uuid4())
        assert user is None
    
    def test_get_user_by_email(self, test_user):
        """Test getting user by email"""
        user = UserRepository.get_user_by_email('testuser@example.com')
        assert user is not None
        assert user.user_id == test_user.user_id
    
    def test_get_user_funds(self, test_user):
        """Test getting user available funds"""
        funds = UserRepository.get_user_funds(test_user.user_id)
        assert funds is not None
        assert funds == 50000.00


class TestAccountRepository:
    """Test AccountRepository"""
    
    def test_get_user_accounts(self, test_user, test_account):
        """Test getting all accounts for user"""
        accounts = AccountRepository.get_user_accounts(test_user.user_id)
        assert accounts is not None
        assert len(accounts) >= 1
        assert accounts[0].account_name == 'Test Account'
    
    def test_get_account(self, test_account):
        """Test getting single account"""
        account = AccountRepository.get_account(test_account.account_id)
        assert account is not None
        assert account.account_id == test_account.account_id
    
    def test_get_account_not_found(self):
        """Test getting non-existent account"""
        account = AccountRepository.get_account(9999)
        assert account is None
    
    def test_get_account_summary(self, test_account):
        """Test getting account summary"""
        summary = AccountRepository.get_account_summary(test_account.account_id)
        assert summary is not None
        assert summary['account_id'] == test_account.account_id
        assert summary['account_name'] == 'Test Account'
        assert 'cash_balance' in summary


class TestHoldingRepository:
    """Test HoldingRepository"""
    
    def test_get_account_holdings(self, test_account, test_holding):
        """Test getting holdings for account"""
        holdings = HoldingRepository.get_account_holdings(test_account.account_id)
        assert holdings is not None
        assert len(holdings) >= 1
        assert holdings[0]['symbol'] == 'AAPL'
    
    def test_get_account_holdings_empty(self, test_account):
        """Test getting holdings for account with no holdings"""
        # Create new account with no holdings
        import uuid
        from models import db
        new_account = Account(
            user_id=test_account.user_id,
            account_name='Empty Account',
            account_type='TRADING',
            status='ACTIVE',
            cash_balance=Decimal('5000.00')
        )
        db.session.add(new_account)
        db.session.commit()
        
        holdings = HoldingRepository.get_account_holdings(new_account.account_id)
        assert holdings == []


class TestOrderRepository:
    """Test OrderRepository"""
    
    def test_get_user_orders(self, test_user, test_order):
        """Test getting orders for user"""
        orders = OrderRepository.get_user_orders(test_user.user_id)
        assert orders is not None
        assert len(orders) >= 1
        assert orders[0]['order_type'] == 'BUY'
    
    def test_get_account_orders(self, test_account, test_order):
        """Test getting orders for account"""
        orders = OrderRepository.get_account_orders(test_account.account_id)
        assert orders is not None
        assert len(orders) >= 1
    
    def test_get_order(self, test_order):
        """Test getting single order"""
        order = OrderRepository.get_order(test_order.order_id)
        assert order is not None
        assert order['order_id'] == test_order.order_id
    
    def test_get_order_with_fill(self, test_order, test_fill):
        """Test getting order includes fill data"""
        order = OrderRepository.get_order(test_order.order_id)
        assert order is not None
        assert 'fill' in order
        assert order['fill']['filled_quantity'] == 100.0
    
    def test_get_orders_by_date_range(self, test_user, test_order):
        """Test getting orders by date range"""
        start_date = datetime.now(UTC) - timedelta(days=1)
        end_date = datetime.now(UTC) + timedelta(days=1)
        orders = OrderRepository.get_orders_by_date_range(
            test_user.user_id, start_date, end_date
        )
        assert orders is not None
        assert len(orders) >= 1
    
    def test_get_orders_pagination(self, test_user, test_order):
        """Test order pagination"""
        orders = OrderRepository.get_user_orders(test_user.user_id, limit=10, offset=0)
        assert orders is not None


class TestTradeRepository:
    """Test TradeRepository"""
    
    def test_get_trade_history(self, test_account, test_order, test_fill):
        """Test getting trade history"""
        trades = TradeRepository.get_trade_history(test_account.account_id)
        assert trades is not None
        assert len(trades) >= 1
    
    def test_get_trade_history_with_date_range(self, test_account, test_order, test_fill):
        """Test getting trade history with date range"""
        start_date = datetime.now(UTC) - timedelta(days=1)
        end_date = datetime.now(UTC) + timedelta(days=1)
        trades = TradeRepository.get_trade_history(
            test_account.account_id, start_date, end_date
        )
        assert trades is not None
    
    def test_get_trade_history_empty(self, test_account):
        """Test getting trade history with no trades"""
        # Set account to future date
        start_date = datetime.now(UTC) + timedelta(days=30)
        end_date = datetime.now(UTC) + timedelta(days=60)
        trades = TradeRepository.get_trade_history(
            test_account.account_id, start_date, end_date
        )
        # May or may not be empty depending on test data
        assert isinstance(trades, list)


class TestCashTransactionRepository:
    """Test CashTransactionRepository"""
    
    def test_get_account_transactions(self, test_account, test_cash_transaction):
        """Test getting cash transactions"""
        transactions = CashTransactionRepository.get_account_transactions(
            test_account.account_id
        )
        assert transactions is not None
        assert len(transactions) >= 1
    
    def test_get_transactions_by_date_range(self, test_account, test_cash_transaction):
        """Test getting transactions by date range"""
        start_date = datetime.now(UTC) - timedelta(days=1)
        end_date = datetime.now(UTC) + timedelta(days=1)
        transactions = CashTransactionRepository.get_transactions_by_date_range(
            test_account.account_id, start_date, end_date
        )
        assert transactions is not None
        assert len(transactions) >= 1


class TestAuditRepository:
    """Test AuditRepository"""
    
    def test_get_account_audit_events(self, test_account):
        """Test getting audit events"""
        from models import db, AuditTrail
        # Create test audit event
        event = AuditTrail(
            account_id=test_account.account_id,
            user_id=test_account.user_id,
            event_type='ORDER_SUBMITTED',
            event_details='Test order submitted',
            timestamp=datetime.now(UTC)
        )
        db.session.add(event)
        db.session.commit()
        
        events = AuditRepository.get_account_audit_events(test_account.account_id)
        assert events is not None
        assert len(events) >= 1


class TestMetadataRepository:
    """Test MetadataRepository"""
    
    def test_set_and_get_metadata(self):
        """Test setting and getting metadata"""
        MetadataRepository.set_metadata('test_key', 'test_value')
        value = MetadataRepository.get_metadata('test_key')
        assert value == 'test_value'
    
    def test_update_last_refresh_time(self):
        """Test updating last refresh time"""
        now = datetime.now(UTC).isoformat()
        MetadataRepository.update_last_refresh_time(now)
        last_refresh = MetadataRepository.get_last_refresh_time()
        assert last_refresh is not None
    
    def test_get_last_refresh_time(self):
        """Test getting last refresh time"""
        last_refresh = MetadataRepository.get_last_refresh_time()
        # May be None if not set yet
        assert last_refresh is None or isinstance(last_refresh, str)


def test_archived_account_remains_in_reporting_with_its_transaction_history(
    db_session, test_user, test_account, test_order, test_fill, test_holding, test_cash_transaction
):
    """A database archive marker must not filter historical reporting queries."""
    from sqlalchemy import text
    db_session.execute(text("ALTER TABLE accounts ADD COLUMN archived_at TIMESTAMP"))
    db_session.execute(
        text("UPDATE accounts SET archived_at = :archived_at WHERE account_id = :account_id"),
        {"archived_at": datetime.now(UTC), "account_id": test_account.account_id},
    )
    test_holding.quantity = Decimal("0")
    db_session.commit()
    assert any(account.account_id == test_account.account_id
               for account in AccountRepository.get_user_accounts(test_user.user_id))
    assert AccountRepository.get_account(test_account.account_id) is not None
    assert len(OrderRepository.get_user_orders(test_user.user_id)) == 1
    assert len(TradeRepository.get_trade_history(test_account.account_id)) == 1
    assert len(HoldingRepository.get_account_holdings(test_account.account_id)) == 1
    assert len(CashTransactionRepository.get_account_transactions(test_account.account_id)) == 1
