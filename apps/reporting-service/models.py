"""
SQLAlchemy ORM models for the trading_season tables the reporting service
reads. All of them are owned by other services and are read only here.

Two groups. users and accounts put names on account ids in the report runs,
whose trade data comes from the Kafka topic trade-events and is kept as files
(event_store.py). The rest back the console (console.py), which shows
orders, fills, cash, sign-in locks and the audit trail as the database records
them. Columns mirror db/migrations; only the columns the service uses are
mapped, so a secret such as a password hash can never be selected.
"""

from datetime import datetime, timezone
import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID

db = SQLAlchemy()


def _now():
    return datetime.now(timezone.utc)


class User(db.Model):
    """Trader profile. Credentials live in user_accounts, which this service never reads."""
    __tablename__ = 'users'

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(Text, nullable=False)
    middle_name = Column(Text, nullable=True)
    last_name = Column(Text, nullable=False)
    ssn = Column(Text, nullable=False)
    address = Column(Text, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    trader_level = Column(Text, nullable=False, default='BEGINNER')
    available_funds = Column(Numeric(14, 2), nullable=False, default=0)
    session_timeout_minutes = Column(Integer, nullable=False, default=10)
    execution_buffer_percent = Column(Numeric(5, 2), nullable=False, default=0)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    def __repr__(self):
        return f'<User {self.user_id}>'


class Account(db.Model):
    """Trading account. The Kafka message key is this table's account_id."""
    __tablename__ = 'accounts'

    account_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, index=True)
    name = Column(Text, nullable=False)
    cash_balance = Column(Numeric(14, 2), nullable=False, default=0)
    opened_date = Column(Date, nullable=False, default=lambda: _now().date())
    currency = Column(Text, nullable=False, default='USD')

    user = db.relationship('User', backref='accounts')

    def __repr__(self):
        return f'<Account {self.account_id} {self.name}>'


class UserAccount(db.Model):
    """
    Sign-in record, owned by the auth service. The password hash column is
    deliberately not mapped.
    """
    __tablename__ = 'user_accounts'

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, nullable=False)
    user_role = Column(Text, nullable=False, default='TRADER')
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class Instrument(db.Model):
    __tablename__ = 'instruments'

    instrument_id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    is_tradable = Column(Boolean, nullable=False, default=True)


class Order(db.Model):
    """order_type is the side, BUY or SELL; every order executes at the market quote."""
    __tablename__ = 'orders'

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.instrument_id'), nullable=False)
    client_reference = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)
    order_type = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    indicative_price = Column(Numeric(18, 6), nullable=True)
    buffer_percent = Column(Numeric(5, 2), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    simulated_at = Column(DateTime(timezone=True), nullable=True)


class Fill(db.Model):
    __tablename__ = 'fills'

    fill_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.order_id'), nullable=False, index=True)
    quote_price = Column(Numeric(18, 6), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    filled_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class CashTransaction(db.Model):
    """reason is ORDER_FILL, DEPOSIT or WITHDRAWAL; amount is signed, money out is negative."""
    __tablename__ = 'cash_transactions'

    cash_transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    fill_id = Column(Integer, ForeignKey('fills.fill_id'), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class HoldingMovement(db.Model):
    __tablename__ = 'holding_movements'

    holding_movement_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.instrument_id'), nullable=False)
    fill_id = Column(Integer, ForeignKey('fills.fill_id'), nullable=False)
    quantity_delta = Column(Numeric(18, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class Holding(db.Model):
    __tablename__ = 'holdings'

    holding_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.instrument_id'), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)


class AuditTrail(db.Model):
    __tablename__ = 'audit_trail'

    audit_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.order_id'), nullable=False, index=True)
    event_type = Column(Text, nullable=False)
    detail = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class PortfolioValuation(db.Model):
    """The market value of an account's holdings at a moment; cash is not part of it."""
    __tablename__ = 'portfolio_valuations'

    valuation_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('accounts.account_id'), nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    portfolio_value = Column(Numeric(18, 6), nullable=False)


class SimulationSession(db.Model):
    __tablename__ = 'simulation_sessions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
