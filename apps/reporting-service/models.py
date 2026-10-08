"""
SQLAlchemy ORM models for the two trading_season tables the reporting
service reads: users and accounts. Both are owned by Holdings and Trade and
are read only here, to put names on account ids in reports. Columns mirror
apps/market-data/db/migrations/V001__Initialize_database.sql exactly.

Trade data never comes from the database. It arrives on the Kafka topic
trade-events and is kept as files; see event_store.py.
"""

from datetime import datetime, timezone
import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, Text
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
