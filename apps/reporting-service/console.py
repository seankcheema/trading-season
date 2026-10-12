"""
The console's read side: platform activity, orders and customers.

Every function here queries the read model (models.py): tables this
process builds from the two Kafka topics the consumer stores, trade-events
for orders and their fills and platform-records for customers, accounts,
cash transfers, sign-in locks, valuations and the audit trail. None of it
touches the trading database. Every function only reads. Rows are filtered
in SQL and aggregated in Python.

Never returned: password hashes, SSNs, addresses and dates of birth. They
are never published, and the read model has no column to hold them.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from math import ceil

from sqlalchemy import func

from models import (Account, AuditTrail, CashTransaction, Fill, Holding, HoldingMovement, Instrument, Order,
                    PortfolioValuation, SimulationSession, User, UserAccount)

# Days each range covers, counting today.
RANGE_DAYS = {'today': 1, '7d': 7, '30d': 30, '90d': 90}
# The range that starts with the first order or transfer the read model holds.
ALL_TIME = 'all'
# Every range the activity endpoint takes.
RANGES = (*RANGE_DAYS, ALL_TIME)
# The most points all time is charted in; a longer history gets buckets of more days.
ALL_TIME_POINTS = 366
ORDER_STATUSES = ('FILLED', 'PENDING', 'ACCEPTED', 'REJECTED')
# The product has no limit or stop orders: every order executes at the market quote.
ORDER_KIND = 'MARKET'
FEED_LIMIT = 20
MOST_TRADED_LIMIT = 8
SPARKLINE_POINTS = 30
DEFAULT_ORDER_LIMIT = 500
MAX_ORDER_LIMIT = 1000
# Cash a trader moved in or out themselves, as opposed to what an order posted.
TRANSFER_REASONS = ('DEPOSIT', 'WITHDRAWAL')
# Sign-ins that work on the platform instead of trading on it. They are not customers.
STAFF_ROLES = ('ANALYST', 'ADMIN')
# The client segments activity is split by: the trader levels, lowest first.
SEGMENTS = ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')


def _utc(value):
    """An aware UTC datetime. SQLite hands timestamps back naive; they were stored as UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso(value):
    value = _utc(value)
    return value.isoformat() if value is not None else None


def _number(value, places=2):
    """A JSON number for a stored decimal, or None."""
    if value is None:
        return None
    return round(float(value), places)


def _decimal(value):
    return Decimal(str(value)) if value is not None else Decimal(0)


def _percent_change(current, previous):
    """Change against the prior period in percent, or None when there is nothing to compare with."""
    if not previous:
        return None
    return round(float((_decimal(current) - _decimal(previous)) / abs(_decimal(previous)) * 100), 2)


def _full_name(user, fallback):
    if user is None:
        return fallback
    return f'{user.first_name} {user.last_name}'.strip() or fallback


def window(range_key, now, tz_offset_minutes=0, first=None):
    """
    Where a range starts, in UTC, and how its chart is bucketed. Days are the
    viewer's own: tz_offset_minutes is their offset east of UTC. Today is cut
    into hours up to the current one, the longer ranges into days. All time
    starts on the day of first, the earliest activity there is, or today when
    there is none; its buckets are a day wide until that would take more than
    ALL_TIME_POINTS of them, then as many whole days as keep it within that.
    """
    zone = timezone(timedelta(minutes=tz_offset_minutes))
    local = now.astimezone(zone)
    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
    if range_key == 'today':
        start, step, count = midnight, timedelta(hours=1), local.hour + 1
    elif range_key == ALL_TIME:
        opened = min(first or now, now).astimezone(zone).replace(hour=0, minute=0, second=0, microsecond=0)
        days = (midnight - opened).days + 1
        width = ceil(days / ALL_TIME_POINTS)
        start, step, count = opened, timedelta(days=width), ceil(days / width)
    else:
        days = RANGE_DAYS[range_key]
        start, step, count = midnight - timedelta(days=days - 1), timedelta(days=1), days
    return start.astimezone(timezone.utc), step, count


def _session_id(session):
    """The simulation session prices are replayed from, as Holdings and Trade last announced it."""
    return session.query(func.max(SimulationSession.id)).scalar()


def _order_query(session):
    return (session.query(Order, Account, User, Instrument, Fill)
            .join(Account, Account.account_id == Order.account_id)
            .join(User, User.user_id == Account.user_id)
            .join(Instrument, Instrument.instrument_id == Order.instrument_id)
            .outerjoin(Fill, Fill.order_id == Order.order_id))


def _notional(fill):
    return _decimal(fill.quantity) * _decimal(fill.quote_price) if fill is not None else Decimal(0)


def _order_row(order, account, user, instrument, fill):
    return {
        'orderId': order.order_id,
        'clientReference': str(order.client_reference),
        'submittedAt': _iso(order.submitted_at),
        'userId': str(user.user_id),
        'userName': _full_name(user, str(user.user_id)),
        'accountId': account.account_id,
        'accountName': account.name,
        'symbol': instrument.ticker,
        'instrumentName': instrument.name,
        'side': order.order_type,
        'type': ORDER_KIND,
        'quantity': _number(order.quantity, 4),
        'price': _number(fill.quote_price, 6) if fill is not None else None,
        'indicativePrice': _number(order.indicative_price, 6),
        'status': order.status,
        'rejectionReason': order.rejection_reason,
    }


def _fill_rate(rows):
    """Filled as a percentage of resolved orders, or None when none has resolved."""
    filled = sum(1 for row in rows if row[0].status == 'FILLED')
    rejected = sum(1 for row in rows if row[0].status == 'REJECTED')
    resolved = filled + rejected
    return (round(filled / resolved * 100, 2) if resolved else None), filled, rejected


def _most_traded(rows):
    by_symbol = defaultdict(lambda: {'orders': 0, 'notional': Decimal(0), 'prices': []})
    for order, _account, _user, instrument, fill in sorted(
            rows, key=lambda row: (_utc(row[0].submitted_at), row[0].order_id)):
        entry = by_symbol[instrument.ticker]
        entry['orders'] += 1
        if fill is not None:
            entry['notional'] += _notional(fill)
            entry['prices'].append(_number(fill.quote_price, 6))
    ranked = sorted(by_symbol.items(), key=lambda item: (item[1]['notional'], item[1]['orders']), reverse=True)
    return [
        {'symbol': symbol, 'orders': entry['orders'], 'notional': _number(entry['notional']),
         'prices': entry['prices'][-SPARKLINE_POINTS:]}
        for symbol, entry in ranked[:MOST_TRADED_LIMIT]
    ]


def _segments(rows):
    """
    What each client segment did: the traders who placed an order, their
    orders and the notional filled. A trader counts under the level they hold
    now, whatever it was when the order was placed.
    """
    by_segment = {segment: {'traders': set(), 'orders': 0, 'notional': Decimal(0)} for segment in SEGMENTS}
    for _order, _account, user, _instrument, fill in rows:
        entry = by_segment[user.trader_level]
        entry['traders'].add(user.user_id)
        entry['orders'] += 1
        entry['notional'] += _notional(fill)
    return [
        {'segment': segment, 'traders': len(entry['traders']), 'orders': entry['orders'],
         'notional': _number(entry['notional'])}
        for segment, entry in by_segment.items()
    ]


def _feed(session, now):
    """The newest things that happened on the platform, whatever the selected range."""
    items = []
    resolved = (_order_query(session)
                .filter(Order.status.in_(('FILLED', 'REJECTED')))
                .order_by(func.coalesce(Order.resolved_at, Order.submitted_at).desc(), Order.order_id.desc())
                .limit(FEED_LIMIT).all())
    for order, _account, user, instrument, fill in resolved:
        at = _utc(order.resolved_at or order.submitted_at)
        if order.status == 'FILLED' and fill is not None:
            items.append({'kind': 'fill', 'at': at, 'userName': _full_name(user, str(user.user_id)),
                          'side': order.order_type, 'quantity': _number(fill.quantity, 4),
                          'symbol': instrument.ticker, 'amount': _number(_notional(fill))})
        elif order.status == 'REJECTED':
            items.append({'kind': 'reject', 'at': at, 'orderId': order.order_id,
                          'reason': order.rejection_reason, 'symbol': instrument.ticker})

    cash = (session.query(CashTransaction, User)
            .join(Account, Account.account_id == CashTransaction.account_id)
            .join(User, User.user_id == Account.user_id)
            .filter(CashTransaction.reason.in_(TRANSFER_REASONS))
            .order_by(CashTransaction.created_at.desc(), CashTransaction.cash_transaction_id.desc())
            .limit(FEED_LIMIT).all())
    for transaction, user in cash:
        items.append({'kind': 'cash', 'at': _utc(transaction.created_at),
                      'userName': _full_name(user, str(user.user_id)),
                      'reason': transaction.reason, 'amount': _number(transaction.amount)})

    locked = (session.query(UserAccount, User)
              .outerjoin(User, User.user_id == UserAccount.user_id)
              .filter(UserAccount.locked_until.isnot(None)).all())
    for sign_in, user in locked:
        if _utc(sign_in.locked_until) > now:
            items.append({'kind': 'lock', 'at': _utc(sign_in.updated_at),
                          'userName': _full_name(user, sign_in.email),
                          'failedAttempts': sign_in.failed_login_attempts})

    items.sort(key=lambda item: item['at'], reverse=True)
    return [{**item, 'at': item['at'].isoformat()} for item in items[:FEED_LIMIT]]


def _first_activity(session):
    """When the first order was placed or the first cash was moved, or None when neither has happened."""
    moments = (
        session.query(func.min(Order.submitted_at)).scalar(),
        session.query(func.min(CashTransaction.created_at))
        .filter(CashTransaction.reason.in_(TRANSFER_REASONS)).scalar(),
    )
    return min((_utc(moment) for moment in moments if moment is not None), default=None)


def activity(session, range_key, now, tz_offset_minutes=0):
    """
    Headline figures, the notional chart, the status split, the split by
    client segment, the feed and the most traded symbols. Nothing comes
    before all time, so there every change against the prior period is None.
    """
    first = _first_activity(session) if range_key == ALL_TIME else None
    start, step, count = window(range_key, now, tz_offset_minutes, first)
    prior_start = start - (now - start)

    current, previous = [], []
    for row in _order_query(session).filter(Order.submitted_at >= prior_start).all():
        (current if _utc(row[0].submitted_at) >= start else previous).append(row)

    rate, filled, rejected = _fill_rate(current)
    prior_rate, _prior_filled, _prior_rejected = _fill_rate(previous)
    reasons = Counter(row[0].rejection_reason for row in current
                      if row[0].status == 'REJECTED' and row[0].rejection_reason)
    top_reason, top_reason_count = reasons.most_common(1)[0] if reasons else (None, 0)

    flow, prior_flow = Decimal(0), Decimal(0)
    transfers = (session.query(CashTransaction)
                 .filter(CashTransaction.reason.in_(TRANSFER_REASONS))
                 .filter(CashTransaction.created_at >= prior_start).all())
    for transaction in transfers:
        if _utc(transaction.created_at) >= start:
            flow += _decimal(transaction.amount)
        else:
            prior_flow += _decimal(transaction.amount)

    traders = {row[2].user_id for row in current}
    prior_traders = {row[2].user_id for row in previous}

    points = [Decimal(0)] * count
    for order, _account, _user, _instrument, fill in current:
        index = min(count - 1, int((_utc(order.submitted_at) - start) / step))
        points[index] += _notional(fill)
    total = sum(points, Decimal(0))
    prior_total = sum((_notional(row[4]) for row in previous), Decimal(0))

    statuses = Counter(row[0].status for row in current)

    return {
        'range': range_key,
        'from': start.isoformat(),
        'to': now.isoformat(),
        'generatedAt': now.isoformat(),
        'sessionId': _session_id(session),
        'kpis': {
            'orders': {'value': len(current), 'change': _percent_change(len(current), len(previous))},
            'fillRate': {
                'value': rate,
                # In percentage points, not percent of a percentage.
                'change': round(rate - prior_rate, 2) if rate is not None and prior_rate is not None else None,
                'filled': filled,
            },
            'rejected': {'value': rejected, 'topReason': top_reason, 'topReasonCount': top_reason_count},
            'netCashFlow': {'value': _number(flow), 'change': _percent_change(flow, prior_flow)},
            'activeTraders': {'value': len(traders), 'change': _percent_change(len(traders), len(prior_traders))},
        },
        'notional': {
            'total': _number(total),
            'change': _percent_change(total, prior_total),
            'points': [{'at': (start + step * index).isoformat(), 'value': _number(value)}
                       for index, value in enumerate(points)],
        },
        'statuses': [{'status': status, 'count': statuses.get(status, 0)} for status in ORDER_STATUSES],
        'segments': _segments(current),
        'feed': _feed(session, now),
        'mostTraded': _most_traded(current),
    }


def _transfer_row(transaction, account, user):
    return {
        'transferId': transaction.cash_transaction_id,
        'at': _iso(transaction.created_at),
        'userId': str(user.user_id),
        'userName': _full_name(user, str(user.user_id)),
        'accountId': account.account_id,
        'accountName': account.name,
        'kind': transaction.reason,
        'amount': _number(transaction.amount),
    }


def _transfers(session, limit, user_id=None):
    """The newest deposits and withdrawals across every account, or one customer's."""
    query = (session.query(CashTransaction, Account, User)
             .join(Account, Account.account_id == CashTransaction.account_id)
             .join(User, User.user_id == Account.user_id)
             .filter(CashTransaction.reason.in_(TRANSFER_REASONS)))
    if user_id is not None:
        query = query.filter(User.user_id == user_id)
    rows = (query.order_by(CashTransaction.created_at.desc(), CashTransaction.cash_transaction_id.desc())
            .limit(limit).all())
    return [_transfer_row(*row) for row in rows]


def orders(session, limit=DEFAULT_ORDER_LIMIT, user_id=None):
    """
    The newest orders across every account, or one customer's, and beside
    them the newest deposits and withdrawals, under the same limit.
    """
    query = _order_query(session)
    if user_id is not None:
        query = query.filter(User.user_id == user_id)
    total = query.count()
    # Newest by when it was submitted, not by id: history loaded late has high ids and old dates.
    rows = query.order_by(Order.submitted_at.desc(), Order.order_id.desc()).limit(limit).all()
    return {
        'orders': [_order_row(*row) for row in rows],
        'transfers': _transfers(session, limit, user_id),
        'total': total,
        'sessionId': _session_id(session),
    }


def _sum(query, column):
    return _decimal(query.with_entities(func.sum(column)).scalar())


def _ledger(session, order, account, user, fill):
    """
    The cash and holding the order found and left. Both are worked back
    from today's balance by removing every posting made after this order's
    own, which also covers an order that posted nothing.
    """
    account_ids = [row.account_id for row in session.query(Account.account_id).filter(Account.user_id == user.user_id)]
    cash_later = session.query(CashTransaction).filter(CashTransaction.account_id.in_(account_ids))
    holding_later = (session.query(HoldingMovement)
                     .filter(HoldingMovement.account_id == account.account_id)
                     .filter(HoldingMovement.instrument_id == order.instrument_id))
    held = (session.query(Holding.quantity)
            .filter(Holding.account_id == account.account_id)
            .filter(Holding.instrument_id == order.instrument_id).scalar())

    transaction = movement = None
    if fill is not None:
        transaction = session.query(CashTransaction).filter(CashTransaction.fill_id == fill.fill_id).first()
        movement = session.query(HoldingMovement).filter(HoldingMovement.fill_id == fill.fill_id).first()

    resolved = order.resolved_at or order.submitted_at
    if transaction is not None:
        cash_later = cash_later.filter(CashTransaction.cash_transaction_id > transaction.cash_transaction_id)
    else:
        cash_later = cash_later.filter(CashTransaction.created_at > resolved)
    if movement is not None:
        holding_later = holding_later.filter(HoldingMovement.holding_movement_id > movement.holding_movement_id)
    else:
        holding_later = holding_later.filter(HoldingMovement.created_at > resolved)

    cash_after = _decimal(user.available_funds) - _sum(cash_later, CashTransaction.amount)
    cash_change = _decimal(transaction.amount) if transaction is not None else None
    holding_after = _decimal(held) - _sum(holding_later, HoldingMovement.quantity_delta)
    holding_change = _decimal(movement.quantity_delta) if movement is not None else None
    return {
        'cashBefore': _number(cash_after - (cash_change or 0)),
        'cashChange': _number(cash_change),
        'cashAfter': _number(cash_after),
        'holdingBefore': _number(holding_after - (holding_change or 0), 4),
        'holdingChange': _number(holding_change, 4),
        'holdingAfter': _number(holding_after, 4),
        'cashTransactionId': transaction.cash_transaction_id if transaction is not None else None,
        'holdingMovementId': movement.holding_movement_id if movement is not None else None,
    }


def order_detail(session, order_id):
    """One order with its customer, execution, ledger impact and audit trail, or None."""
    row = _order_query(session).filter(Order.order_id == order_id).first()
    if row is None:
        return None
    order, account, user, _instrument, fill = row
    email = session.query(UserAccount.email).filter(UserAccount.user_id == user.user_id).scalar()
    trail = session.query(AuditTrail).filter(AuditTrail.order_id == order_id).order_by(AuditTrail.audit_id).all()
    return {
        **_order_row(*row),
        'userEmail': email,
        'bufferPercent': _number(order.buffer_percent),
        'acceptedAt': _iso(order.accepted_at),
        'resolvedAt': _iso(order.resolved_at),
        'simulatedAt': _iso(order.simulated_at),
        'fill': {
            'fillId': fill.fill_id,
            'price': _number(fill.quote_price, 6),
            'quantity': _number(fill.quantity, 4),
            'filledAt': _iso(fill.filled_at),
        } if fill is not None else None,
        'ledger': _ledger(session, order, account, user, fill),
        'audit': [{'eventType': event.event_type, 'detail': event.detail, 'recordedAt': _iso(event.recorded_at)}
                  for event in trail],
    }


def _latest_valuations(session):
    """account_id -> the newest recorded value of its holdings."""
    newest = (session.query(func.max(PortfolioValuation.valuation_id).label('valuation_id'))
              .group_by(PortfolioValuation.account_id).subquery())
    rows = (session.query(PortfolioValuation)
            .join(newest, PortfolioValuation.valuation_id == newest.c.valuation_id).all())
    return {row.account_id: _decimal(row.portfolio_value) for row in rows}


def _customer_row(sign_in, user, accounts, valuations, now):
    locked = sign_in.locked_until is not None and _utc(sign_in.locked_until) > now
    return {
        'userId': str(sign_in.user_id),
        'name': _full_name(user, sign_in.email),
        'email': sign_in.email,
        'role': sign_in.user_role,
        'status': 'LOCKED' if locked else 'ACTIVE',
        'traderLevel': user.trader_level if user is not None else None,
        'accounts': len(accounts),
        # Cash is one balance per trader, shared by their accounts.
        'cash': _number(user.available_funds) if user is not None else 0.0,
        'portfolio': _number(sum((valuations.get(account.account_id, Decimal(0)) for account in accounts),
                                 Decimal(0))),
        'failedAttempts': sign_in.failed_login_attempts,
        'lockedUntil': _iso(sign_in.locked_until) if locked else None,
        'lastActiveAt': _iso(user.last_activity_at) if user is not None else None,
        'memberSince': _iso(sign_in.created_at),
    }


def customers(session, now):
    """Every trader's sign-in with its trading profile, when it has one. Analysts and admins are left out."""
    by_user = defaultdict(list)
    for account in session.query(Account).order_by(Account.account_id).all():
        by_user[account.user_id].append(account)
    valuations = _latest_valuations(session)
    rows = (session.query(UserAccount, User)
            .outerjoin(User, User.user_id == UserAccount.user_id)
            .filter(UserAccount.user_role.notin_(STAFF_ROLES))
            .order_by(UserAccount.email).all())
    return {'customers': [_customer_row(sign_in, user, by_user.get(sign_in.user_id, []), valuations, now)
                          for sign_in, user in rows]}


def customer(session, user_id, now):
    """One customer with their accounts, orders and transfers, or None. An analyst or admin is not one."""
    row = (session.query(UserAccount, User)
           .outerjoin(User, User.user_id == UserAccount.user_id)
           .filter(UserAccount.user_id == user_id)
           .filter(UserAccount.user_role.notin_(STAFF_ROLES)).first())
    if row is None:
        return None
    sign_in, user = row
    accounts = session.query(Account).filter(Account.user_id == user_id).order_by(Account.account_id).all()
    valuations = _latest_valuations(session)
    return {
        **_customer_row(sign_in, user, accounts, valuations, now),
        'sessionTimeoutMinutes': user.session_timeout_minutes if user is not None else None,
        'accountBalances': [{'accountId': account.account_id, 'name': account.name,
                             'value': _number(valuations.get(account.account_id, Decimal(0)))}
                            for account in accounts],
        **orders(session, limit=MAX_ORDER_LIMIT, user_id=user_id),
    }
