"""
SQLAlchemy ORM models for trading_season database
Maps to read-only views of main application data
"""

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, String, Numeric, DateTime, Integer, Boolean, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

db = SQLAlchemy()


class User(db.Model):
    """User profile - owned by Holdings and Trade Service"""
    __tablename__ = 'users'
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(100), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    address = Column(Text, nullable=False)
    ssn = Column(String(11), nullable=False)
    date_of_birth = Column(DateTime, nullable=False)
    trader_level = Column(String(50), nullable=False)  # BEGINNER, INTERMEDIATE, ADVANCED
    available_funds = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f'<User {self.email}>'


class Account(db.Model):
    """Account metadata - owned by Holdings and Trade Service"""
    __tablename__ = 'accounts'
    
    account_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, index=True)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False)  # TRADING, INVESTMENT, etc.
    status = Column(String(50), nullable=False)  # ACTIVE, FROZEN, CLOSED
    cash_balance = Column(Numeric(15, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    user = db.relationship('User', backref='accounts')
    
    def __repr__(self):
        return f'<Account {self.account_name}>'


class Instrument(db.Model):
    """Tradable instruments"""
    __tablename__ = 'instruments'
    
    instrument_id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    asset_class = Column(String(50), nullable=False)  # EQUITY, BOND, etc.
    is_tradable = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f'<Instrument {self.symbol}>'


class Order(db.Model):
    """Order history - owned by Holdings and Trade Service"""
    __tablename__ = 'orders'
    
    order_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.instrument_id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, index=True)
    order_type = Column(String(50), nullable=False)  # BUY, SELL
    quantity = Column(Numeric(15, 2), nullable=False)
    indicative_price = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), nullable=False, index=True)  # PENDING, FILLED, REJECTED
    rejection_reason = Column(String(255), nullable=True)
    client_reference = Column(UUID(as_uuid=True), nullable=True)
    submitted_at = Column(DateTime, nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    account = db.relationship('Account', backref='orders')
    instrument = db.relationship('Instrument', backref='orders')
    user = db.relationship('User', backref='orders')
    
    def __repr__(self):
        return f'<Order {self.order_id} {self.order_type} {self.quantity}>'


class Fill(db.Model):
    """Order execution records - owned by Holdings and Trade Service"""
    __tablename__ = 'fills'
    
    fill_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.order_id'), nullable=False, unique=True, index=True)
    filled_quantity = Column(Numeric(15, 2), nullable=False)
    filled_price = Column(Numeric(15, 2), nullable=False)
    fill_timestamp = Column(DateTime, nullable=False, index=True)
    commission = Column(Numeric(15, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    order = db.relationship('Order', backref='fills')
    
    def __repr__(self):
        return f'<Fill {self.fill_id} {self.filled_quantity}@{self.filled_price}>'


class Holding(db.Model):
    """Position tracking - owned by Holdings and Trade Service"""
    __tablename__ = 'holdings'
    
    holding_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.instrument_id'), nullable=False)
    quantity = Column(Numeric(15, 2), nullable=False)
    average_cost = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    account = db.relationship('Account', backref='holdings')
    instrument = db.relationship('Instrument', backref='holdings')
    
    def __repr__(self):
        return f'<Holding {self.quantity} x {self.instrument_id}>'


class CashTransaction(db.Model):
    """Cash ledger - owned by Holdings and Trade Service"""
    __tablename__ = 'cash_transactions'
    
    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # DEPOSIT, WITHDRAWAL, FEE, FILL, etc.
    reference_id = Column(Integer, nullable=True)  # Order ID, Fill ID, etc.
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    account = db.relationship('Account', backref='cash_transactions')
    user = db.relationship('User', backref='cash_transactions')
    
    def __repr__(self):
        return f'<CashTransaction {self.amount} {self.transaction_type}>'


class HoldingMovement(db.Model):
    """Position ledger - owned by Holdings and Trade Service"""
    __tablename__ = 'holding_movements'
    
    movement_id = Column(Integer, primary_key=True, autoincrement=True)
    holding_id = Column(Integer, ForeignKey('holdings.holding_id'), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.instrument_id'), nullable=False)
    movement_type = Column(String(50), nullable=False)  # BUY, SELL, etc.
    quantity = Column(Numeric(15, 2), nullable=False)
    price = Column(Numeric(15, 2), nullable=False)
    reference_id = Column(Integer, nullable=True)  # Fill ID, etc.
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    holding = db.relationship('Holding', backref='movements')
    account = db.relationship('Account', backref='holding_movements')
    instrument = db.relationship('Instrument', backref='holding_movements')
    
    def __repr__(self):
        return f'<HoldingMovement {self.quantity} {self.movement_type}>'


class AuditTrail(db.Model):
    """Event history - owned by Holdings and Trade Service"""
    __tablename__ = 'audit_trail'
    
    event_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)  # ORDER_SUBMITTED, ORDER_FILLED, etc.
    event_details = Column(Text, nullable=True)  # JSON or descriptive text
    reference_id = Column(Integer, nullable=True)  # Order ID, Fill ID, etc.
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    account = db.relationship('Account', backref='audit_events')
    user = db.relationship('User', backref='audit_events')
    
    def __repr__(self):
        return f'<AuditTrail {self.event_type}>'


class ReportingMetadata(db.Model):
    """Reporting service metadata (last refresh, etc.)"""
    __tablename__ = 'reporting_metadata'
    
    metadata_id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f'<ReportingMetadata {self.key}>'
