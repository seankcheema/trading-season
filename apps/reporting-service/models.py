"""
The reporting service's read model: the tables its endpoints query.

None of this is the trading database. The service has no connection to it.
The tables live in an in-memory SQLite database that each process builds
from the files the consumer wrote (read_model.py), by applying every order
status event and platform record in them (projection.py). They are shaped
like the trading tables the messages describe, so the console's queries
read the way they would against the real ones, but they hold only what was
published: no password hash, SSN, address or date of birth has a column
here, so none can be stored or selected.

Rows arrive in whatever order the topics deliver them, so nothing here may
depend on another row existing: SQLite does not enforce the foreign keys,
which are declared only to document how the tables relate.
"""

from datetime import datetime, timezone
import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

db = SQLAlchemy()

# The two keys most tables point at.
ACCOUNT_KEY = 'accounts.account_id'
INSTRUMENT_KEY = 'instruments.instrument_id'


def _now():
    return datetime.now(timezone.utc)


class User(db.Model):
    """A trader's profile, from CUSTOMER_PROFILE records. Cash follows funds_balances."""
    __tablename__ = 'users'

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    trader_level = Column(Text, nullable=False, default='BEGINNER')
    available_funds = Column(Numeric(14, 2), nullable=False, default=0)
    session_timeout_minutes = Column(Integer, nullable=False, default=10)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    def __repr__(self):
        return f'<User {self.user_id}>'


class FundsBalance(db.Model):
    """
    The newest cash balance published for a trader, and when it held.

    A profile, a deposit or withdrawal, and a fill each carry the balance
    they left, on two topics whose relative order is not guaranteed. This
    row keeps the one with the latest as_of, and users.available_funds
    mirrors it, so a profile that arrives after a fill cannot put an older
    balance back.
    """
    __tablename__ = 'funds_balances'

    user_id = Column(UUID(as_uuid=True), primary_key=True)
    available_funds = Column(Numeric(14, 2), nullable=False)
    as_of = Column(DateTime(timezone=True), nullable=False)


class Account(db.Model):
    """A trading account, from TRADING_ACCOUNT records. The key of every order event is its account_id."""
    __tablename__ = 'accounts'

    account_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, index=True)
    name = Column(Text, nullable=False)
    opened_date = Column(Date, nullable=False, default=lambda: _now().date())
    currency = Column(Text, nullable=False, default='USD')

    status = Column(Text, nullable=False, default='ACTIVE')
    archived_at = Column(DateTime(timezone=True))

    user = db.relationship('User', backref='accounts')

    def __repr__(self):
        return f'<Account {self.account_id} {self.name}>'


class UserAccount(db.Model):
    """A sign-in, from the auth service's SIGN_IN records. The password hash is never published."""
    __tablename__ = 'user_accounts'

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, nullable=False)
    user_role = Column(Text, nullable=False, default='TRADER')
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class Instrument(db.Model):
    """An instrument that has been ordered, from the order events that name it."""
    __tablename__ = 'instruments'

    instrument_id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    is_tradable = Column(Boolean, nullable=False, default=True)


class Order(db.Model):
    """An order as of its latest status event. order_type is the side, BUY or SELL."""
    __tablename__ = 'orders'

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey(ACCOUNT_KEY), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey(INSTRUMENT_KEY), nullable=False)
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
    """The execution of a filled order, from its FILLED event."""
    __tablename__ = 'fills'

    fill_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.order_id'), nullable=False, index=True)
    quote_price = Column(Numeric(18, 6), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    filled_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class CashTransaction(db.Model):
    """
    A cash posting. reason is ORDER_FILL, from a FILLED event, or DEPOSIT or
    WITHDRAWAL, from a CASH_TRANSFER record; amount is signed, money out is negative.
    """
    __tablename__ = 'cash_transactions'

    cash_transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey(ACCOUNT_KEY), nullable=False, index=True)
    fill_id = Column(Integer, ForeignKey('fills.fill_id'), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class HoldingMovement(db.Model):
    """What a fill posted to a position, from its FILLED event."""
    __tablename__ = 'holding_movements'

    holding_movement_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey(ACCOUNT_KEY), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey(INSTRUMENT_KEY), nullable=False)
    fill_id = Column(Integer, ForeignKey('fills.fill_id'), nullable=False)
    quantity_delta = Column(Numeric(18, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class Holding(db.Model):
    """
    What an account holds of an instrument: the quantity the newest movement
    left. last_movement_id is that movement, so an older FILLED event that is
    replayed cannot put an earlier quantity back.
    """
    __tablename__ = 'holdings'
    __table_args__ = (UniqueConstraint('account_id', 'instrument_id', name='uq_holdings_account_instrument'),)

    holding_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey(ACCOUNT_KEY), nullable=False, index=True)
    instrument_id = Column(Integer, ForeignKey(INSTRUMENT_KEY), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    last_movement_id = Column(Integer, nullable=False, default=0)


class AuditTrail(db.Model):
    """An entry of an order's audit trail, from ORDER_AUDIT records."""
    __tablename__ = 'audit_trail'

    audit_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.order_id'), nullable=False, index=True)
    event_type = Column(Text, nullable=False)
    detail = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class PortfolioValuation(db.Model):
    """
    The market value of an account's holdings at a moment; cash is not part
    of it. From PORTFOLIO_VALUATION records, of which only the newest per
    account is kept.
    """
    __tablename__ = 'portfolio_valuations'

    valuation_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey(ACCOUNT_KEY), nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    portfolio_value = Column(Numeric(18, 6), nullable=False)


class SimulationSession(db.Model):
    """The session prices are replayed from, from the MARKET_SESSION record. One row."""
    __tablename__ = 'simulation_sessions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
