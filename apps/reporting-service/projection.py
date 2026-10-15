"""
Turns consumed messages into rows of the read model (models.py).

apply_trade_event takes one order status line of the trade-events files and
apply_record one line of the platform-records files. Both are upserts keyed
by the row's own id, so applying a message twice, or applying a replay of
everything, leaves the same rows.

Three values can be reported by more than one message, and a replay or the
other topic may deliver an older one later. Each keeps a mark that decides
which wins:

- an order's status never moves backwards (PENDING, ACCEPTED, then FILLED or
  REJECTED);
- a trader's cash is the balance with the latest as_of (funds_balances);
- a holding is the quantity its highest movement id left.

Everything a message needs is read out of it and checked before the first
statement runs, so a message that cannot be used raises Unusable and changes
nothing.
"""

import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import bindparam, delete, func, select, update
from sqlalchemy.dialects.sqlite import insert

from event_store import parse_occurred_at
from models import (Account, AuditTrail, CashTransaction, Fill, FundsBalance, Holding, HoldingMovement, Instrument,
                    Order, PortfolioValuation, SimulationSession, User, UserAccount)

logger = logging.getLogger(__name__)

# How far along an order is. A status event never replaces one further along.
STATUS_RANK = {'PENDING': 0, 'ACCEPTED': 1, 'FILLED': 2, 'REJECTED': 2}
ORDER_FILL = 'ORDER_FILL'


class Unusable(ValueError):
    """A message that lacks, or garbles, something its row cannot do without."""


def _integer(value, name, required=True):
    if value is None and not required:
        return None
    if isinstance(value, bool):
        raise Unusable(f'{name} is not a whole number')
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise Unusable(f'{name} is not a whole number') from None
    if not number.is_finite() or number != number.to_integral_value():
        raise Unusable(f'{name} is not a whole number')
    return int(number)


def _decimal(value, name, required=True):
    if value is None and not required:
        return None
    if isinstance(value, bool):
        raise Unusable(f'{name} is not a number')
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise Unusable(f'{name} is not a number') from None
    if not number.is_finite():
        raise Unusable(f'{name} is not a number')
    return number


def _text(value, name, required=True):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value:
        raise Unusable(f'{name} is missing')
    return value


def _uuid(value, name, required=True):
    if value is None and not required:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise Unusable(f'{name} is not a UUID') from None


def _time(value, name, required=True):
    if value is None and not required:
        return None
    parsed = parse_occurred_at(value)
    if parsed is None:
        raise Unusable(f'{name} is not a timestamp')
    return parsed


def _date(value, name):
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise Unusable(f'{name} is not a date') from None


# A process rebuilds its read model from every message ever stored, so a
# statement is built and compiled once per shape and run with parameters from
# then on. Building and compiling one costs many times what running it does.
_PREPARED = {}


def _run(session, shape, build, parameters, columns=None):
    """Run the statement of this shape, compiling it the first time the shape is seen."""
    connection = session.connection()
    compiled = _PREPARED.get(shape)
    if compiled is None:
        compiled = _PREPARED[shape] = build().compile(dialect=connection.dialect, column_keys=columns)
    return connection.execute(compiled, parameters)


def _upsert(session, model, keys, values, newer=None, keep=()):
    """
    Insert the row, or overwrite the one with the same keys. newer names a
    column that must not go backwards: the row is left alone when it already
    holds a later value than the message carries. keep names columns an
    existing row holds on to, whatever the message says.
    """
    columns = tuple(values)

    def build():
        table = model.__table__
        statement = insert(table)
        updates = {column: statement.excluded[column] for column in columns
                   if column not in keys and column not in keep}
        where = statement.excluded[newer] >= table.c[newer] if newer else None
        return statement.on_conflict_do_update(index_elements=list(keys), set_=updates, where=where)

    _run(session, (model, tuple(keys), columns, newer, tuple(keep)), build, values, columns=list(columns))


def _mirror_funds(session, user_id):
    """Make the trader's cash the latest balance known, when one is and the profile has arrived."""
    def build():
        balances, users = FundsBalance.__table__, User.__table__
        latest = select(balances.c.available_funds).where(balances.c.user_id == bindparam('balance_of'))
        return (update(users).where(users.c.user_id == bindparam('trader')).where(latest.exists())
                .values(available_funds=latest.scalar_subquery()))

    _run(session, 'mirror funds', build, {'trader': user_id, 'balance_of': user_id})


def _set_funds(session, user_id, amount, as_of):
    """Record a balance and when it held; the trader's cash becomes the latest one known."""
    _upsert(session, FundsBalance, ['user_id'],
            {'user_id': user_id, 'available_funds': amount, 'as_of': as_of}, newer='as_of')
    _mirror_funds(session, user_id)


def _execution(event, order_id, account_id, instrument_id):
    """The rows a FILLED event's execution carries, or None when it carries none."""
    execution = event.get('execution')
    if not isinstance(execution, dict):
        return None
    filled_at = _time(execution.get('filledAt'), 'execution.filledAt')
    fill_id = _integer(execution.get('fillId'), 'execution.fillId')
    rows = {
        'fill': {'fill_id': fill_id, 'order_id': order_id,
                 'quote_price': _decimal(execution.get('price'), 'execution.price'),
                 'quantity': _decimal(execution.get('quantity'), 'execution.quantity'), 'filled_at': filled_at},
        'cash': None, 'movement': None, 'holding': None, 'funds': None,
    }
    cash_id = _integer(execution.get('cashTransactionId'), 'execution.cashTransactionId', required=False)
    if cash_id is not None:
        rows['cash'] = {'cash_transaction_id': cash_id, 'account_id': account_id, 'fill_id': fill_id,
                        'amount': _decimal(execution.get('cashAmount'), 'execution.cashAmount'),
                        'reason': ORDER_FILL, 'created_at': filled_at}
    movement_id = _integer(execution.get('holdingMovementId'), 'execution.holdingMovementId', required=False)
    if movement_id is not None:
        rows['movement'] = {'holding_movement_id': movement_id, 'account_id': account_id,
                            'instrument_id': instrument_id, 'fill_id': fill_id,
                            'quantity_delta': _decimal(execution.get('quantityDelta'), 'execution.quantityDelta'),
                            'created_at': filled_at}
        held = _decimal(execution.get('holdingQuantity'), 'execution.holdingQuantity', required=False)
        if held is not None:
            rows['holding'] = {'account_id': account_id, 'instrument_id': instrument_id, 'quantity': held,
                               'last_movement_id': movement_id}
    user_id = _uuid(execution.get('userId'), 'execution.userId', required=False)
    funds = _decimal(execution.get('availableFunds'), 'execution.availableFunds', required=False)
    if user_id is not None and funds is not None:
        rows['funds'] = (user_id, funds, filled_at)
    return rows


def apply_trade_event(session, event):
    """
    Apply one order status event. Returns False, changing nothing, for a
    message from before the events carried the order row: there is no order
    to build from it.
    """
    detail = event.get('order')
    if not isinstance(detail, dict):
        return False

    order_id = _integer(event.get('orderId'), 'orderId')
    account_id = _integer(event.get('accountId'), 'accountId')
    instrument_id = _integer(detail.get('instrumentId'), 'order.instrumentId')
    status = _text(event.get('status'), 'status')
    ticker = _text(event.get('symbol'), 'symbol')
    order = {
        'order_id': order_id,
        'account_id': account_id,
        'instrument_id': instrument_id,
        'client_reference': _uuid(detail.get('clientReference'), 'order.clientReference'),
        'order_type': _text(event.get('side'), 'side'),
        'status': status,
        'quantity': _decimal(event.get('quantity'), 'quantity'),
        'indicative_price': _decimal(detail.get('indicativePrice'), 'order.indicativePrice', required=False),
        'buffer_percent': _decimal(detail.get('bufferPercent'), 'order.bufferPercent', required=False),
        'rejection_reason': _text(event.get('rejectionReason'), 'rejectionReason', required=False),
        'submitted_at': _time(detail.get('submittedAt'), 'order.submittedAt'),
        'accepted_at': _time(detail.get('acceptedAt'), 'order.acceptedAt', required=False),
        'resolved_at': _time(detail.get('resolvedAt'), 'order.resolvedAt', required=False),
        'simulated_at': _time(detail.get('simulatedAt'), 'order.simulatedAt', required=False),
    }
    instrument = {'instrument_id': instrument_id, 'ticker': ticker,
                  'name': _text(detail.get('instrumentName'), 'order.instrumentName', required=False) or ticker,
                  'is_tradable': True}
    execution = _execution(event, order_id, account_id, instrument_id)

    _upsert(session, Instrument, ['instrument_id'], instrument)
    orders = Order.__table__
    current = _run(session, 'order status',
                   lambda: select(orders.c.status).where(orders.c.order_id == bindparam('order')),
                   {'order': order_id}).scalar()
    if current is None or STATUS_RANK.get(status, 0) >= STATUS_RANK.get(current, 0):
        _upsert(session, Order, ['order_id'], order)
    if execution is not None:
        _upsert(session, Fill, ['fill_id'], execution['fill'])
        if execution['cash'] is not None:
            _upsert(session, CashTransaction, ['cash_transaction_id'], execution['cash'])
        if execution['movement'] is not None:
            _upsert(session, HoldingMovement, ['holding_movement_id'], execution['movement'])
        if execution['holding'] is not None:
            _upsert(session, Holding, ['account_id', 'instrument_id'], execution['holding'],
                    newer='last_movement_id')
        if execution['funds'] is not None:
            _set_funds(session, *execution['funds'])
    return True


def _sign_in(session, record):
    updated_at = _time(record.get('updatedAt'), 'updatedAt', required=False)
    created_at = _time(record.get('createdAt'), 'createdAt', required=False)
    fallback = updated_at or created_at or datetime.now(timezone.utc)
    _upsert(session, UserAccount, ['user_id'], {
        'user_id': _uuid(record.get('userId'), 'userId'),
        'email': _text(record.get('email'), 'email'),
        'user_role': _text(record.get('role'), 'role'),
        'failed_login_attempts': _integer(record.get('failedLoginAttempts'), 'failedLoginAttempts',
                                          required=False) or 0,
        'locked_until': _time(record.get('lockedUntil'), 'lockedUntil', required=False),
        'created_at': created_at or fallback,
        'updated_at': updated_at or fallback,
    }, newer='updated_at')


def _customer_profile(session, record):
    user_id = _uuid(record.get('userId'), 'userId')
    created_at = _time(record.get('createdAt'), 'createdAt', required=False)
    as_of = _time(record.get('asOf'), 'asOf', required=False) or created_at or datetime.now(timezone.utc)
    funds = _decimal(record.get('availableFunds'), 'availableFunds', required=False)
    profile = {
        'user_id': user_id,
        'first_name': _text(record.get('firstName'), 'firstName'),
        'last_name': _text(record.get('lastName'), 'lastName'),
        'trader_level': _text(record.get('traderLevel'), 'traderLevel'),
        'session_timeout_minutes': _integer(record.get('sessionTimeoutMinutes'), 'sessionTimeoutMinutes',
                                            required=False) or 10,
        'last_activity_at': _time(record.get('lastActivityAt'), 'lastActivityAt', required=False),
        'created_at': created_at or as_of,
    }
    # An existing row keeps its cash: a profile may be older than a fill already applied.
    _upsert(session, User, ['user_id'], {**profile, 'available_funds': funds or Decimal(0)},
            keep=('available_funds',))
    if funds is not None:
        _set_funds(session, user_id, funds, as_of)
    else:
        # A balance may have arrived before the profile it belongs to.
        _mirror_funds(session, user_id)


def _trading_account(session, record):
    opened = record.get('openedDate')
    status = record.get('status', 'ACTIVE')
    if status not in ('ACTIVE', 'ARCHIVED'):
        raise Unusable('Unknown account lifecycle status')
    archived_at = _time(record.get('archivedAt'), 'archivedAt') if record.get('archivedAt') else None
    if (status == 'ARCHIVED') != (archived_at is not None):
        raise Unusable('Archive timestamp must match account status')
    values = {
        'account_id': _integer(record.get('accountId'), 'accountId'),
        'user_id': _uuid(record.get('userId'), 'userId'),
        'name': _text(record.get('name'), 'name'),
        'opened_date': _date(opened, 'openedDate') if opened is not None else datetime.now(timezone.utc).date(),
        'currency': _text(record.get('currency'), 'currency', required=False) or 'USD',
        'status': status, 'archived_at': archived_at,
    }
    # Restoration is not supported; replaying an older account cannot undo archiving.
    existing = session.get(Account, values['account_id'])
    if existing and existing.status == 'ARCHIVED' and status == 'ACTIVE':
        return
    _upsert(session, Account, ['account_id'], values)


def _cash_transfer(session, record):
    created_at = _time(record.get('createdAt'), 'createdAt')
    transfer = {
        'cash_transaction_id': _integer(record.get('cashTransactionId'), 'cashTransactionId'),
        'account_id': _integer(record.get('accountId'), 'accountId'),
        'fill_id': None,
        'amount': _decimal(record.get('amount'), 'amount'),
        'reason': _text(record.get('reason'), 'reason'),
        'created_at': created_at,
    }
    user_id = _uuid(record.get('userId'), 'userId', required=False)
    funds = _decimal(record.get('availableFunds'), 'availableFunds', required=False)
    _upsert(session, CashTransaction, ['cash_transaction_id'], transfer)
    if user_id is not None and funds is not None:
        _set_funds(session, user_id, funds, created_at)


def _portfolio_valuation(session, record):
    valuation = {
        'valuation_id': _integer(record.get('valuationId'), 'valuationId'),
        'account_id': _integer(record.get('accountId'), 'accountId'),
        'observed_at': _time(record.get('observedAt'), 'observedAt'),
        'portfolio_value': _decimal(record.get('portfolioValue'), 'portfolioValue'),
    }
    table = PortfolioValuation.__table__
    account = {'account': valuation['account_id']}
    newest = _run(session, 'newest valuation',
                  lambda: select(func.max(table.c.valuation_id)).where(table.c.account_id == bindparam('account')),
                  account).scalar()
    if newest is not None and newest > valuation['valuation_id']:
        return
    # Only the newest value of an account is ever read.
    _run(session, 'older valuations',
         lambda: delete(table).where(table.c.account_id == bindparam('account'))
         .where(table.c.valuation_id != bindparam('valuation')),
         {**account, 'valuation': valuation['valuation_id']})
    _upsert(session, PortfolioValuation, ['valuation_id'], valuation)


def _order_audit(session, record):
    _upsert(session, AuditTrail, ['audit_id'], {
        'audit_id': _integer(record.get('auditId'), 'auditId'),
        'order_id': _integer(record.get('orderId'), 'orderId'),
        'event_type': _text(record.get('eventType'), 'eventType'),
        'detail': _text(record.get('detail'), 'detail', required=False),
        'recorded_at': _time(record.get('recordedAt'), 'recordedAt'),
    })


def _market_session(session, record):
    session_id = _integer(record.get('sessionId'), 'sessionId')
    # There is one current session; whatever was announced before is replaced.
    table = SimulationSession.__table__
    _run(session, 'other sessions', lambda: delete(table).where(table.c.id != bindparam('current')),
         {'current': session_id})
    _upsert(session, SimulationSession, ['id'], {'id': session_id, 'status': 'COMPLETED'})


RECORD_HANDLERS = {
    'SIGN_IN': _sign_in,
    'CUSTOMER_PROFILE': _customer_profile,
    'TRADING_ACCOUNT': _trading_account,
    'CASH_TRANSFER': _cash_transfer,
    'PORTFOLIO_VALUATION': _portfolio_valuation,
    'ORDER_AUDIT': _order_audit,
    'MARKET_SESSION': _market_session,
}


def apply_record(session, record):
    """Apply one platform record. Returns False, changing nothing, for a type this service does not show."""
    handler = RECORD_HANDLERS.get(record.get('type'))
    if handler is None:
        return False
    handler(session, record)
    return True
