"""
Database service layer for reporting queries
Provides repository methods for accessing trading data
"""

from models import (
    db, User, Account, Order, Fill, Holding, CashTransaction, 
    HoldingMovement, AuditTrail, Instrument, ReportingMetadata
)
from sqlalchemy import desc, and_, func
from datetime import datetime, timedelta
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class UserRepository:
    """Repository for user data access"""
    
    @staticmethod
    def get_user(user_id):
        """Get a user by ID"""
        return User.query.filter_by(user_id=user_id).first()
    
    @staticmethod
    def get_user_by_email(email):
        """Get a user by email"""
        return User.query.filter_by(email=email).first()
    
    @staticmethod
    def get_user_funds(user_id):
        """Get available funds for a user"""
        user = User.query.filter_by(user_id=user_id).first()
        return float(user.available_funds) if user else None


class AccountRepository:
    """Repository for account data access"""
    
    @staticmethod
    def get_user_accounts(user_id):
        """Get all accounts for a user"""
        return Account.query.filter_by(user_id=user_id).all()
    
    @staticmethod
    def get_account(account_id):
        """Get a single account"""
        return Account.query.filter_by(account_id=account_id).first()
    
    @staticmethod
    def get_account_summary(account_id):
        """Get account summary with holdings and cash"""
        account = Account.query.filter_by(account_id=account_id).first()
        if not account:
            return None
        
        holdings = Holding.query.filter_by(account_id=account_id).all()
        
        return {
            'account_id': account.account_id,
            'account_name': account.account_name,
            'account_type': account.account_type,
            'status': account.status,
            'cash_balance': float(account.cash_balance),
            'holdings_count': len(holdings),
            'created_at': account.created_at.isoformat(),
            'updated_at': account.updated_at.isoformat()
        }


class HoldingRepository:
    """Repository for position data access"""
    
    @staticmethod
    def get_account_holdings(account_id):
        """Get all holdings for an account"""
        holdings = db.session.query(
            Holding,
            Instrument.symbol,
            Instrument.name
        ).join(
            Instrument, Holding.instrument_id == Instrument.instrument_id
        ).filter(
            Holding.account_id == account_id
        ).all()
        
        result = []
        for holding, symbol, name in holdings:
            result.append({
                'holding_id': holding.holding_id,
                'instrument_id': holding.instrument_id,
                'symbol': symbol,
                'name': name,
                'quantity': float(holding.quantity),
                'average_cost': float(holding.average_cost),
                'total_value': float(holding.quantity * holding.average_cost),
                'created_at': holding.created_at.isoformat(),
                'updated_at': holding.updated_at.isoformat()
            })
        
        return result


class OrderRepository:
    """Repository for order data access"""
    
    @staticmethod
    def get_user_orders(user_id, limit=100, offset=0):
        """Get orders for a user (newest first)"""
        orders = Order.query.filter_by(user_id=user_id).order_by(
            desc(Order.submitted_at),
            desc(Order.order_id)
        ).offset(offset).limit(limit).all()
        
        return [OrderRepository._serialize_order(o) for o in orders]
    
    @staticmethod
    def get_account_orders(account_id, limit=100, offset=0):
        """Get orders for an account"""
        orders = Order.query.filter_by(account_id=account_id).order_by(
            desc(Order.submitted_at)
        ).offset(offset).limit(limit).all()
        
        return [OrderRepository._serialize_order(o) for o in orders]
    
    @staticmethod
    def get_orders_by_date_range(user_id, start_date, end_date):
        """Get orders within a date range"""
        orders = Order.query.filter(
            and_(
                Order.user_id == user_id,
                Order.submitted_at >= start_date,
                Order.submitted_at <= end_date
            )
        ).order_by(desc(Order.submitted_at)).all()
        
        return [OrderRepository._serialize_order(o) for o in orders]
    
    @staticmethod
    def get_order(order_id):
        """Get a single order with fill"""
        order = Order.query.filter_by(order_id=order_id).first()
        if not order:
            return None
        
        result = OrderRepository._serialize_order(order)
        
        # Add fill information if exists
        fill = Fill.query.filter_by(order_id=order_id).first()
        if fill:
            result['fill'] = {
                'fill_id': fill.fill_id,
                'filled_quantity': float(fill.filled_quantity),
                'filled_price': float(fill.filled_price),
                'commission': float(fill.commission or 0),
                'fill_timestamp': fill.fill_timestamp.isoformat()
            }
        
        return result
    
    @staticmethod
    def _serialize_order(order):
        """Serialize order to dict"""
        return {
            'order_id': order.order_id,
            'account_id': order.account_id,
            'instrument_id': order.instrument_id,
            'symbol': order.instrument.symbol if order.instrument else None,
            'order_type': order.order_type,
            'quantity': float(order.quantity),
            'indicative_price': float(order.indicative_price),
            'status': order.status,
            'rejection_reason': order.rejection_reason,
            'submitted_at': order.submitted_at.isoformat(),
            'resolved_at': order.resolved_at.isoformat() if order.resolved_at else None
        }


class TradeRepository:
    """Repository for trade analysis"""
    
    @staticmethod
    def get_trade_history(account_id, start_date=None, end_date=None):
        """Get executed trades (filled orders) for an account"""
        query = db.session.query(Order, Fill, Instrument).join(
            Fill, Order.order_id == Fill.order_id
        ).join(
            Instrument, Order.instrument_id == Instrument.instrument_id
        ).filter(Order.account_id == account_id)
        
        if start_date:
            query = query.filter(Order.submitted_at >= start_date)
        if end_date:
            query = query.filter(Order.submitted_at <= end_date)
        
        query = query.order_by(desc(Order.submitted_at))
        
        trades = []
        for order, fill, instrument in query.all():
            realized_pl = TradeRepository._calculate_realized_pl(order, fill)
            trades.append({
                'order_id': order.order_id,
                'symbol': instrument.symbol,
                'order_type': order.order_type,
                'quantity': float(order.quantity),
                'entry_price': float(order.indicative_price),
                'filled_quantity': float(fill.filled_quantity),
                'filled_price': float(fill.filled_price),
                'commission': float(fill.commission or 0),
                'realized_pl': realized_pl,
                'executed_at': fill.fill_timestamp.isoformat(),
                'submitted_at': order.submitted_at.isoformat()
            })
        
        return trades
    
    @staticmethod
    def _calculate_realized_pl(order, fill):
        """Calculate realized P&L for a trade"""
        if order.order_type == 'BUY':
            return 0  # No P&L on purchase
        else:  # SELL
            proceeds = float(fill.filled_price * fill.filled_quantity)
            commission = float(fill.commission or 0)
            return proceeds - commission


class CashTransactionRepository:
    """Repository for cash flow data"""
    
    @staticmethod
    def get_account_transactions(account_id, limit=100, offset=0):
        """Get cash transactions for an account"""
        transactions = CashTransaction.query.filter_by(
            account_id=account_id
        ).order_by(
            desc(CashTransaction.timestamp)
        ).offset(offset).limit(limit).all()
        
        return [{
            'transaction_id': t.transaction_id,
            'amount': float(t.amount),
            'transaction_type': t.transaction_type,
            'reference_id': t.reference_id,
            'timestamp': t.timestamp.isoformat()
        } for t in transactions]
    
    @staticmethod
    def get_transactions_by_date_range(account_id, start_date, end_date):
        """Get transactions within date range"""
        transactions = CashTransaction.query.filter(
            and_(
                CashTransaction.account_id == account_id,
                CashTransaction.timestamp >= start_date,
                CashTransaction.timestamp <= end_date
            )
        ).order_by(desc(CashTransaction.timestamp)).all()
        
        return [{
            'transaction_id': t.transaction_id,
            'amount': float(t.amount),
            'transaction_type': t.transaction_type,
            'timestamp': t.timestamp.isoformat()
        } for t in transactions]


class AuditRepository:
    """Repository for audit trail"""
    
    @staticmethod
    def get_account_audit_events(account_id, limit=50, offset=0):
        """Get audit events for an account"""
        events = AuditTrail.query.filter_by(account_id=account_id).order_by(
            desc(AuditTrail.timestamp)
        ).offset(offset).limit(limit).all()
        
        return [{
            'event_id': e.event_id,
            'event_type': e.event_type,
            'event_details': e.event_details,
            'reference_id': e.reference_id,
            'timestamp': e.timestamp.isoformat()
        } for e in events]


class MetadataRepository:
    """Repository for reporting metadata"""
    
    @staticmethod
    def get_metadata(key):
        """Get metadata value"""
        metadata = ReportingMetadata.query.filter_by(key=key).first()
        return metadata.value if metadata else None
    
    @staticmethod
    def set_metadata(key, value):
        """Set metadata value"""
        metadata = ReportingMetadata.query.filter_by(key=key).first()
        if not metadata:
            metadata = ReportingMetadata(key=key, value=value)
            db.session.add(metadata)
        else:
            metadata.value = value
            metadata.updated_at = datetime.utcnow()
        
        db.session.commit()
        logger.info(f"Set metadata: {key} = {value}")
    
    @staticmethod
    def get_last_refresh_time():
        """Get last data refresh timestamp"""
        return MetadataRepository.get_metadata('last_refresh_time')
    
    @staticmethod
    def update_last_refresh_time(refresh_time=None):
        """Update last refresh timestamp"""
        if refresh_time is None:
            refresh_time = datetime.utcnow().isoformat()
        MetadataRepository.set_metadata('last_refresh_time', refresh_time)
