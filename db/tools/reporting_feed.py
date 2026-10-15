"""
Builds, from rows already in the trading database, the messages the trading
services would have published for the reporting service had it been
listening when the rows were written.

The reporting service has no database connection. Everything it shows
arrives on two Kafka topics, published by the services as they commit:
trade-events (one message per order status change) and platform-records
(the current state of sign-ins, profiles, accounts, transfers, valuations
and audit entries). History that predates those publishers, or that was
written by SQL instead of by a service, never reached the topics. This
module reads that history once and shapes it exactly as the services do,
so the reporting consumer cannot tell the difference:

- the message bodies mirror OrderStatusEvent and the PlatformRecord types of
  the Java services, and the auth service's SignInRecord;
- an order's message is keyed by its account id and a record's by its type
  and id, the keys the services use, so a row's history and its future land
  on the same partition.

Two values are not stored per row and are worked back from today's: the
cash a posting left, by removing every later posting of the same trader
from their balance, and the units a fill left, by removing every later
movement of the same account and instrument from the holding.

Nothing here writes to the database.
"""

import json
from collections import defaultdict, namedtuple
from datetime import date, datetime, timezone
from decimal import Decimal

TRADE_EVENTS = 'trade-events'
PLATFORM_RECORDS = 'platform-records'
# Set on every republished order event. The services' own consumers of
# trade-events, which react to a status change as it happens, skip a message
# that carries it; the reporting consumer stores it like any other.
REPLAY_HEADER = 'replay'
TRANSFER_REASONS = ('DEPOSIT', 'WITHDRAWAL')

Message = namedtuple('Message', 'topic key body')

QUERIES = {
    'as_of': 'SELECT now() AS as_of',
    'sign_ins': '''SELECT user_id, email, user_role, failed_login_attempts, locked_until, created_at, updated_at
                   FROM user_accounts ORDER BY created_at, user_id''',
    'profiles': '''SELECT user_id, first_name, last_name, trader_level, available_funds, session_timeout_minutes,
                          last_activity_at, created_at
                   FROM users ORDER BY created_at, user_id''',
    'accounts': 'SELECT account_id, user_id, name, opened_date, currency, status, archived_at FROM accounts ORDER BY account_id',
    'session': '''SELECT id FROM simulation_sessions WHERE status = 'COMPLETED'
                  ORDER BY created_at DESC, id DESC LIMIT 1''',
    'cash': '''SELECT cash_transaction_id, account_id, fill_id, amount, reason, created_at
               FROM cash_transactions ORDER BY cash_transaction_id''',
    'movements': '''SELECT holding_movement_id, account_id, instrument_id, fill_id, quantity_delta
                    FROM holding_movements ORDER BY holding_movement_id''',
    'holdings': 'SELECT account_id, instrument_id, quantity FROM holdings',
    'valuations': '''SELECT DISTINCT ON (account_id) valuation_id, account_id, observed_at, portfolio_value
                     FROM portfolio_valuations ORDER BY account_id, valuation_id DESC''',
    'audit': 'SELECT audit_id, order_id, event_type, detail, recorded_at FROM audit_trail ORDER BY audit_id',
    'orders': '''SELECT o.order_id, o.account_id, o.instrument_id, o.client_reference, o.order_type, o.status,
                        o.quantity, o.indicative_price, o.buffer_percent, o.rejection_reason, o.submitted_at,
                        o.accepted_at, o.resolved_at, o.simulated_at, i.ticker, i.name AS instrument_name,
                        f.fill_id, f.quote_price, f.quantity AS fill_quantity, f.filled_at
                 FROM orders o
                 JOIN instruments i ON i.instrument_id = o.instrument_id
                 LEFT JOIN fills f ON f.order_id = o.order_id
                 ORDER BY o.order_id''',
}


def iso(value):
    """A timestamp as ISO-8601 in UTC, a date as its ISO day, or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def number(value):
    """A database numeric as a JSON number, or None."""
    return float(value) if value is not None else None


def text(value):
    return str(value) if value is not None else None


def balances_after(current, postings):
    """
    The balance each posting left, worked back from the current one.

    postings is an iterable of (posting_id, amount) in any order; ids rise
    with time. The newest posting left the current balance, and each earlier
    one left that less everything posted after it.
    """
    after = {}
    balance = Decimal(current)
    for posting_id, amount in sorted(postings, reverse=True):
        after[posting_id] = balance
        balance -= Decimal(amount)
    return after


def load_snapshot(connection):
    """Every row the messages are built from, read in one consistent, read-only snapshot."""
    import psycopg
    from psycopg.rows import dict_row

    connection.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    connection.read_only = True
    snapshot = {}
    with connection.cursor(row_factory=dict_row) as cursor:
        for name, query in QUERIES.items():
            cursor.execute(query)
            snapshot[name] = cursor.fetchall()
    connection.rollback()
    return snapshot


def _record(record_type, record_id, fields):
    return Message(PLATFORM_RECORDS, f'{record_type}:{record_id}', {'type': record_type, **fields})


def build_messages(snapshot):
    """
    Every message the snapshot amounts to, in the order they are published:
    who exists first, then what they did.
    """
    as_of = snapshot['as_of'][0]['as_of']
    owner = {row['account_id']: row['user_id'] for row in snapshot['accounts']}
    funds = {row['user_id']: row['available_funds'] for row in snapshot['profiles']}

    # Cash is one balance per trader, shared by their accounts.
    postings = defaultdict(list)
    for row in snapshot['cash']:
        postings[owner.get(row['account_id'])].append((row['cash_transaction_id'], row['amount']))
    cash_after = {}
    for user_id, rows in postings.items():
        if user_id in funds:
            cash_after.update(balances_after(funds[user_id], rows))

    held = {(row['account_id'], row['instrument_id']): row['quantity'] for row in snapshot['holdings']}
    moved = defaultdict(list)
    for row in snapshot['movements']:
        moved[(row['account_id'], row['instrument_id'])].append((row['holding_movement_id'], row['quantity_delta']))
    holding_after = {}
    for position, rows in moved.items():
        holding_after.update(balances_after(held.get(position, 0), rows))

    messages = []
    for row in snapshot['sign_ins']:
        messages.append(_record('SIGN_IN', row['user_id'], {
            'userId': text(row['user_id']), 'email': row['email'], 'role': row['user_role'],
            'failedLoginAttempts': row['failed_login_attempts'], 'lockedUntil': iso(row['locked_until']),
            'createdAt': iso(row['created_at']), 'updatedAt': iso(row['updated_at']),
        }))
    for row in snapshot['profiles']:
        messages.append(_record('CUSTOMER_PROFILE', row['user_id'], {
            'userId': text(row['user_id']), 'firstName': row['first_name'], 'lastName': row['last_name'],
            'traderLevel': row['trader_level'], 'availableFunds': number(row['available_funds']),
            'sessionTimeoutMinutes': row['session_timeout_minutes'], 'lastActivityAt': iso(row['last_activity_at']),
            'createdAt': iso(row['created_at']), 'asOf': iso(as_of),
        }))
    for row in snapshot['accounts']:
        messages.append(_record('TRADING_ACCOUNT', row['account_id'], {
            'accountId': row['account_id'], 'userId': text(row['user_id']), 'name': row['name'],
            'openedDate': iso(row['opened_date']), 'currency': row['currency'],
            'status': row.get('status', 'ACTIVE'), 'archivedAt': iso(row.get('archived_at')),
        }))
    for row in snapshot['session']:
        messages.append(_record('MARKET_SESSION', 'current', {'sessionId': row['id']}))
    for row in snapshot['cash']:
        if row['reason'] not in TRANSFER_REASONS:
            continue
        messages.append(_record('CASH_TRANSFER', row['cash_transaction_id'], {
            'cashTransactionId': row['cash_transaction_id'], 'accountId': row['account_id'],
            'userId': text(owner.get(row['account_id'])), 'amount': number(row['amount']),
            'reason': row['reason'], 'createdAt': iso(row['created_at']),
            'availableFunds': number(cash_after.get(row['cash_transaction_id'])),
        }))
    for row in snapshot['valuations']:
        # Keyed by account, as the service keys it: only an account's newest value matters.
        messages.append(_record('PORTFOLIO_VALUATION', row['account_id'], {
            'valuationId': row['valuation_id'], 'accountId': row['account_id'],
            'observedAt': iso(row['observed_at']), 'portfolioValue': number(row['portfolio_value']),
        }))
    for row in snapshot['audit']:
        messages.append(_record('ORDER_AUDIT', row['audit_id'], {
            'auditId': row['audit_id'], 'orderId': row['order_id'], 'eventType': row['event_type'],
            'detail': row['detail'], 'recordedAt': iso(row['recorded_at']),
        }))

    cash_of_fill = {row['fill_id']: row for row in snapshot['cash'] if row['fill_id'] is not None}
    movement_of_fill = {row['fill_id']: row for row in snapshot['movements']}
    for row in snapshot['orders']:
        messages.append(_order_event(row, owner, cash_of_fill, movement_of_fill, cash_after, holding_after))
    return messages


def _order_event(row, owner, cash_of_fill, movement_of_fill, cash_after, holding_after):
    """One order at its current status, shaped like the Order and Sell Service's OrderStatusEvent."""
    execution = None
    if row['fill_id'] is not None:
        cash = cash_of_fill.get(row['fill_id'])
        movement = movement_of_fill.get(row['fill_id'])
        execution = {
            'userId': text(owner.get(row['account_id'])),
            'fillId': row['fill_id'],
            'price': number(row['quote_price']),
            'quantity': number(row['fill_quantity']),
            'filledAt': iso(row['filled_at']),
            'cashTransactionId': cash['cash_transaction_id'] if cash else None,
            'cashAmount': number(cash['amount']) if cash else None,
            'availableFunds': number(cash_after.get(cash['cash_transaction_id'])) if cash else None,
            'holdingMovementId': movement['holding_movement_id'] if movement else None,
            'quantityDelta': number(movement['quantity_delta']) if movement else None,
            'holdingQuantity': number(holding_after.get(movement['holding_movement_id'])) if movement else None,
        }
    occurred_at = row['resolved_at'] or row['accepted_at'] or row['submitted_at']
    return Message(TRADE_EVENTS, str(row['account_id']), {
        'orderId': row['order_id'],
        'status': row['status'],
        'symbol': row['ticker'],
        'side': row['order_type'],
        'quantity': number(row['quantity']),
        'price': number(row['indicative_price']),
        'rejectionReason': row['rejection_reason'],
        'occurredAt': iso(occurred_at),
        'order': {
            'clientReference': text(row['client_reference']),
            'instrumentId': row['instrument_id'],
            'instrumentName': row['instrument_name'],
            'indicativePrice': number(row['indicative_price']),
            'bufferPercent': number(row['buffer_percent']),
            'submittedAt': iso(row['submitted_at']),
            'acceptedAt': iso(row['accepted_at']),
            'resolvedAt': iso(row['resolved_at']),
            'simulatedAt': iso(row['simulated_at']),
        },
        'execution': execution,
    })


def summarize(messages):
    """How many messages of each kind, for the operator: {'trade-events': n, 'SIGN_IN': n, ...}."""
    counts = defaultdict(int)
    for message in messages:
        counts[message.body.get('type', TRADE_EVENTS)] += 1
    return dict(counts)


def publish(messages, bootstrap_servers, producer=None, timeout=60, topics=None):
    """
    Send every message and wait for the broker to acknowledge them all.
    Returns the number acknowledged; raises RuntimeError if any was not.
    topics maps TRADE_EVENTS and PLATFORM_RECORDS to the names the broker
    knows them by, for a deployment that has configured other names.
    """
    topics = topics or {}
    if producer is None:
        from confluent_kafka import Producer

        producer = Producer({
            'bootstrap.servers': bootstrap_servers,
            # The Java client's partitioner, so a key lands on the partition the services put it on.
            'partitioner': 'murmur2_random',
            'enable.idempotence': True,
            'linger.ms': 20,
        })

    failures = []
    acknowledged = [0]

    def delivered(error, message):
        if error is not None:
            failures.append(f'{message.topic()} key={message.key()}: {error}')
        else:
            acknowledged[0] += 1

    for message in messages:
        headers = [(REPLAY_HEADER, b'true')] if message.topic == TRADE_EVENTS else None
        value = json.dumps(message.body, separators=(',', ':'))
        while True:
            try:
                producer.produce(topics.get(message.topic, message.topic), key=message.key, value=value,
                                 headers=headers, on_delivery=delivered)
                break
            except BufferError:
                # The local queue is full; let deliveries drain and try again.
                producer.poll(1)
        producer.poll(0)

    unsent = producer.flush(timeout)
    if failures or unsent:
        detail = '; '.join(failures[:5]) or f'{unsent} message(s) still unsent after {timeout}s'
        raise RuntimeError(f'Not every message was acknowledged: {detail}')
    return acknowledged[0]
