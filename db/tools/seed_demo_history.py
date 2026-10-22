"""
Give a development database a few months of trading history.

    python db/tools/seed_demo_history.py \
        --database-url postgresql://trading_season:password@localhost:5432/trading_season

Development only, and additive: it creates eight demo traders and a
sign-up that never completed a profile, then writes what they would have
done over the last six months up to this moment: orders that filled, orders
the trading rules rejected, deposits and withdrawals, with the fills, cash
and holding ledgers, holdings, audit trail and portfolio valuations that go
with them. Nothing that already exists is changed or removed.

Every demo sign-in ends in @demo.tradingseason.example and has the password
DemoTrader1!, so any of them can be used in the Client UI. One of them is
locked out for a week, so the reporting console has a lock to show.

Run it again later and it only adds the days since it last ran, so the
history stays recent. The same trader on the same day always does the same
things, whenever the tool is run.

The rows are written by SQL, not by the services, so nothing is published
to Kafka. Run republish_history.py afterwards for the reporting service to
see them.

It needs tradable instruments, which the market data import creates.
--dry-run writes everything, prints the summary and rolls it all back.
"""

import argparse
import os
import random
import sys
import uuid
from collections import namedtuple
from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

EMAIL_DOMAIN = 'demo.tradingseason.example'
NAMESPACE = uuid.UUID('6f1c2f0e-8f3a-4c1b-9b54-3d1f5a7c2e10')
# bcrypt of DemoTrader1!, cost 10: what the auth service would have stored.
PASSWORD_HASH = '$2b$10$piQpEdQ06WJBjGFpUaoY1Oo6XDh4r4ROT01fAaZL06SrvNRKnpwja'
# Twice the longest range the reporting console shows, so that range has a
# period before it to be compared with.
HISTORY_DAYS = 180
# Prices walk from this day, so a symbol's price on a date never depends on when the tool runs.
PRICE_ANCHOR = date(2026, 1, 1)
MARKET_OPEN = time(13, 30)
MARKET_CLOSE = time(20, 0)
LOCK_DAYS = 7
MAX_ORDERS_PER_DAY = {'BEGINNER': 2, 'INTERMEDIATE': 3, 'ADVANCED': 5}
# The reasons the Order and Sell Service's own trading rules give.
REJECTED_FUNDS = 'BR-09: insufficient funds for this order'
REJECTED_HOLDINGS = 'Insufficient holdings for this SELL order'
CENT = Decimal('0.01')

Trader = namedtuple('Trader', 'slug first last level opening accounts activity joined_days_ago locked')
Instrument = namedtuple('Instrument', 'instrument_id ticker base_price')
Transfer = namedtuple('Transfer', 'at trader amount reason')
OrderAction = namedtuple('OrderAction', 'at trader account_index instrument_id side quantity price status reason')

# They joined at different times, so the platform grows over the six months.
TRADERS = (
    Trader('amara.okafor', 'Amara', 'Okafor', 'ADVANCED', 250000, ('Main Account', 'Growth'), 0.80, 180, False),
    Trader('liam.nguyen', 'Liam', 'Nguyen', 'ADVANCED', 180000, ('Main Account', 'Income'), 0.70, 165, False),
    Trader('sofia.rossi', 'Sofia', 'Rossi', 'INTERMEDIATE', 90000, ('Main Account',), 0.60, 150, False),
    Trader('mateo.garcia', 'Mateo', 'Garcia', 'INTERMEDIATE', 75000, ('Main Account', 'Retirement'), 0.55, 120, False),
    Trader('priya.sharma', 'Priya', 'Sharma', 'INTERMEDIATE', 60000, ('Main Account',), 0.50, 95, False),
    Trader('noah.williams', 'Noah', 'Williams', 'BEGINNER', 25000, ('Main Account',), 0.40, 110, False),
    Trader('chloe.martin', 'Chloe', 'Martin', 'BEGINNER', 15000, ('Main Account',), 0.35, 60, True),
    Trader('omar.haddad', 'Omar', 'Haddad', 'BEGINNER', 10000, ('Main Account',), 0.30, 30, False),
)
# Signed up three days ago and never filled in a profile: a customer with no name and no account.
SIGN_UP_ONLY = ('nadia.rahman', 3)


def email(slug):
    return f'{slug}@{EMAIL_DOMAIN}'


def user_id(slug):
    """The same id every run, so the tool recognises its own traders."""
    return uuid.uuid5(NAMESPACE, email(slug))


def money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


class Prices:
    """A seeded random walk per instrument: plausible, repeatable, and never the real market."""

    def __init__(self, instruments):
        self._base = {instrument.instrument_id: Decimal(instrument.base_price) for instrument in instruments}
        self._walks = {}

    def on(self, instrument_id, day):
        """The instrument's price on a day, as a factor of its base price walked from the anchor."""
        steps = max(0, (day - PRICE_ANCHOR).days)
        walk = self._walks.setdefault(instrument_id, [1.0])
        if len(walk) <= steps:
            rng = random.Random(f'price|{instrument_id}')
            # Replay the draws already used, so extending the walk continues the same sequence.
            for _ in range(len(walk) - 1):
                rng.gauss(0.0003, 0.011)
            while len(walk) <= steps:
                walk.append(max(0.2, walk[-1] * (1 + rng.gauss(0.0003, 0.011))))
        return money(self._base[instrument_id] * Decimal(repr(walk[steps])))


def new_state(trader):
    """What a trader has before their first day: the cash they registered with and nothing held."""
    return {'funds': Decimal(trader.opening), 'holdings': {}}


def _moments(rng, day, count, until):
    """count rising timestamps inside the day's trading hours, all before until."""
    start = datetime.combine(day, MARKET_OPEN, tzinfo=timezone.utc)
    end = datetime.combine(day, MARKET_CLOSE, tzinfo=timezone.utc)
    if until is not None and until < end:
        end = until - timedelta(minutes=1)
        if end <= start:
            # Before the open today: use the small hours instead of inventing the future.
            start = datetime.combine(day, time(0, 5), tzinfo=timezone.utc)
    if end <= start:
        return []
    span = (end - start).total_seconds()
    return sorted(start + timedelta(seconds=rng.uniform(0, span)) for _ in range(count))


def plan_day(trader, day, state, instruments, prices, until=None):
    """
    What the trader does on one day, in time order. state is their cash and
    holdings going in and is left as they are coming out. The same trader and
    day always plan the same things. until, the present moment, matters only
    for today: the same things happen, earlier, so that none is in the future.
    """
    rng = random.Random(f'{trader.slug}|{day.isoformat()}')
    opening = Decimal(trader.opening)
    wants = []
    if rng.random() < 0.04:
        wants.append(('DEPOSIT', money(round(float(opening) * rng.uniform(0.05, 0.20), -2))))
    if rng.random() < 0.02:
        wants.append(('WITHDRAWAL', money(round(float(opening) * rng.uniform(0.02, 0.08), -2))))
    if day.weekday() < 5 and rng.random() < trader.activity:
        wants.extend(('ORDER', None) for _ in range(rng.randint(1, MAX_ORDERS_PER_DAY[trader.level])))
    # Decide what, then when: the draws above never depend on the time of day the tool runs.
    rng.shuffle(wants)

    actions = []
    for at, (kind, amount) in zip(_moments(rng, day, len(wants), until), wants):
        if kind == 'DEPOSIT':
            state['funds'] += amount
            actions.append(Transfer(at, trader, amount, 'DEPOSIT'))
        elif kind == 'WITHDRAWAL':
            if amount < state['funds'] / 2:
                state['funds'] -= amount
                actions.append(Transfer(at, trader, -amount, 'WITHDRAWAL'))
        else:
            order = _plan_order(trader, at, state, instruments, prices, rng)
            if order is not None:
                actions.append(order)
    return actions


def _plan_order(trader, at, state, instruments, prices, rng):
    account_index = 0 if rng.random() < 0.7 else rng.randrange(len(trader.accounts))
    held = sorted((instrument_id, quantity) for (index, instrument_id), quantity in state['holdings'].items()
                  if index == account_index and quantity > 0)
    roll = rng.random()
    instrument = rng.choice(instruments)
    wobble = Decimal(repr(1 + rng.uniform(-0.004, 0.004)))

    def price_of(instrument_id):
        return money(prices.on(instrument_id, at.date()) * wobble)

    def order(instrument_id, side, quantity, status, reason=None):
        return OrderAction(at, trader, account_index, instrument_id, side, Decimal(quantity),
                           price_of(instrument_id), status, reason)

    if roll < 0.04:
        # Reaches for more than the cash allows; the funds rule turns it away.
        price = price_of(instrument.instrument_id)
        return order(instrument.instrument_id, 'BUY', int(state['funds'] // price) + rng.randint(5, 50),
                     'REJECTED', REJECTED_FUNDS)
    if roll < 0.07:
        owned = state['holdings'].get((account_index, instrument.instrument_id), Decimal(0))
        return order(instrument.instrument_id, 'SELL', int(owned) + rng.randint(1, 20), 'REJECTED',
                     REJECTED_HOLDINGS)
    if held and roll < 0.40:
        instrument_id, owned = rng.choice(held)
        quantity = max(1, int(owned * Decimal(repr(rng.uniform(0.2, 1.0)))))
        state['holdings'][(account_index, instrument_id)] = owned - quantity
        state['funds'] += quantity * price_of(instrument_id)
        return order(instrument_id, 'SELL', quantity, 'FILLED')

    price = price_of(instrument.instrument_id)
    quantity = int(state['funds'] * Decimal(repr(rng.uniform(0.02, 0.10))) // price)
    if quantity < 1:
        return None
    position = (account_index, instrument.instrument_id)
    state['holdings'][position] = state['holdings'].get(position, Decimal(0)) + quantity
    state['funds'] -= quantity * price
    return order(instrument.instrument_id, 'BUY', quantity, 'FILLED')


def plan_history(trader, first_day, last_day, state, instruments, prices, until=None):
    """Everything the trader does from first_day to last_day inclusive, in time order."""
    actions = []
    day = first_day
    while day <= last_day:
        actions.extend(plan_day(trader, day, state, instruments, prices, until))
        day += timedelta(days=1)
    return actions


# --------------------------------------------------------------------------- the database


def load_instruments(cursor):
    cursor.execute('''SELECT i.instrument_id, i.ticker, COALESCE(s.starting_price, 100)
                      FROM instruments i LEFT JOIN stocks s ON s.symbol = i.simulated_stock_symbol
                      WHERE i.is_tradable ORDER BY i.instrument_id''')
    return [Instrument(*row) for row in cursor.fetchall()]


def ensure_trader(cursor, trader, now):
    """
    Create the trader if they are new. Returns their account ids, their cash
    and holdings as the database has them, and the first day still to plan.
    """
    identity = user_id(trader.slug)
    cursor.execute('SELECT available_funds FROM users WHERE user_id = %s', (identity,))
    row = cursor.fetchone()
    if row is None:
        joined = (now - timedelta(days=trader.joined_days_ago)).replace(hour=12, minute=0, second=0, microsecond=0)
        locked_until = now + timedelta(days=LOCK_DAYS) if trader.locked else None
        cursor.execute('''INSERT INTO user_accounts (user_id, email, password_hash, user_role, failed_login_attempts,
                                                     locked_until, created_at, updated_at)
                          VALUES (%s, %s, %s, 'TRADER', %s, %s, %s, %s)''',
                       (identity, email(trader.slug), PASSWORD_HASH, 5 if trader.locked else 0, locked_until,
                        joined, now - timedelta(minutes=20) if trader.locked else joined))
        cursor.execute('''INSERT INTO users (user_id, first_name, last_name, ssn, address, date_of_birth,
                                             trader_level, available_funds, created_at)
                          VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                       (identity, trader.first, trader.last, f'900-00-{TRADERS.index(trader):04d}',
                        'Demo trader, no real address', date(1990, 1, 1), trader.level, trader.opening, joined))
        account_ids = []
        for name in trader.accounts:
            cursor.execute('''INSERT INTO accounts (user_id, name, opened_date, currency)
                              VALUES (%s, %s, %s, 'USD') RETURNING account_id''', (identity, name, joined.date()))
            account_ids.append(cursor.fetchone()[0])
        return account_ids, new_state(trader), joined.date(), True

    cursor.execute('SELECT account_id FROM accounts WHERE user_id = %s ORDER BY account_id', (identity,))
    account_ids = [account_id for (account_id,) in cursor.fetchall()][:len(trader.accounts)]
    state = {'funds': Decimal(row[0]), 'holdings': {}}
    cursor.execute('SELECT account_id, instrument_id, quantity FROM holdings WHERE account_id = ANY(%s)',
                   (account_ids,))
    for account_id, instrument_id, quantity in cursor.fetchall():
        state['holdings'][(account_ids.index(account_id), instrument_id)] = Decimal(quantity)
    cursor.execute('''SELECT GREATEST(
                          (SELECT max(submitted_at) FROM orders WHERE account_id = ANY(%s)),
                          (SELECT max(created_at) FROM cash_transactions WHERE account_id = ANY(%s)),
                          (SELECT created_at FROM users WHERE user_id = %s))''',
                   (account_ids, account_ids, identity))
    last = cursor.fetchone()[0]
    # The day after anything already written: a day is planned once, whole.
    return account_ids, state, last.astimezone(timezone.utc).date() + timedelta(days=1), False


def ensure_sign_up_only(cursor, now):
    slug, days_ago = SIGN_UP_ONLY
    joined = now - timedelta(days=days_ago)
    cursor.execute('''INSERT INTO user_accounts (user_id, email, password_hash, user_role, created_at, updated_at)
                      VALUES (%s, %s, %s, 'TRADER', %s, %s) ON CONFLICT (user_id) DO NOTHING''',
                   (user_id(slug), email(slug), PASSWORD_HASH, joined, joined))
    return cursor.rowcount == 1


def write_transfer(cursor, action, account_ids):
    cursor.execute('''INSERT INTO cash_transactions (account_id, amount, reason, created_at)
                      VALUES (%s, %s, %s, %s)''', (account_ids[0], action.amount, action.reason, action.at))


def write_order(cursor, action, account_ids, sequence):
    account_id = account_ids[action.account_index]
    reference = uuid.uuid5(NAMESPACE, f'{action.trader.slug}|{action.at.isoformat()}|{sequence}')
    filled = action.status == 'FILLED'
    accepted_at = action.at + timedelta(milliseconds=40) if filled else None
    resolved_at = action.at + timedelta(milliseconds=120 if filled else 30)
    # A filled order records its execution price, as live execution does; the client reads it
    # from the order, not the fill.
    cursor.execute('''INSERT INTO orders (account_id, instrument_id, client_reference, order_type, status, quantity,
                                          indicative_price, buffer_percent, rejection_reason, submitted_at,
                                          accepted_at, resolved_at, execution_price)
                      VALUES (%s, %s, %s, %s, %s, %s, %s, 0.50, %s, %s, %s, %s, %s) RETURNING order_id''',
                   (account_id, action.instrument_id, reference, action.side, action.status, action.quantity,
                    action.price, action.reason, action.at, accepted_at, resolved_at,
                    action.price if filled else None))
    order_id = cursor.fetchone()[0]

    trail = [('PENDING', None, action.at)]
    if filled:
        trail.append(('ACCEPTED', None, accepted_at))
        trail.append(('FILLED', f'Filled {action.quantity} @ {action.price}', resolved_at))
    else:
        trail.append(('REJECTED', action.reason, resolved_at))
    for event_type, detail, recorded_at in trail:
        cursor.execute('''INSERT INTO audit_trail (order_id, event_type, detail, recorded_at)
                          VALUES (%s, %s, %s, %s)''', (order_id, event_type, detail, recorded_at))
    if not filled:
        return

    buy = action.side == 'BUY'
    value = action.quantity * action.price
    cursor.execute('''INSERT INTO fills (order_id, quote_price, quantity, filled_at)
                      VALUES (%s, %s, %s, %s) RETURNING fill_id''',
                   (order_id, action.price, action.quantity, resolved_at))
    fill_id = cursor.fetchone()[0]
    cursor.execute('''INSERT INTO cash_transactions (account_id, fill_id, amount, reason, created_at)
                      VALUES (%s, %s, %s, 'ORDER_FILL', %s)''',
                   (account_id, fill_id, -value if buy else value, resolved_at))
    cursor.execute('''INSERT INTO holding_movements (account_id, instrument_id, fill_id, quantity_delta, created_at)
                      VALUES (%s, %s, %s, %s, %s)''',
                   (account_id, action.instrument_id, fill_id, action.quantity if buy else -action.quantity,
                    resolved_at))


def write_balances(cursor, trader, account_ids, state, last_action_at, prices, now):
    """Leave the trader's cash, holdings and portfolio value agreeing with the ledgers just written."""
    cursor.execute('UPDATE users SET available_funds = %s, last_activity_at = %s WHERE user_id = %s',
                   (money(state['funds']), last_action_at, user_id(trader.slug)))
    value = {account_id: Decimal(0) for account_id in account_ids}
    for (account_index, instrument_id), quantity in sorted(state['holdings'].items()):
        account_id = account_ids[account_index]
        cursor.execute('''INSERT INTO holdings (account_id, instrument_id, quantity, updated_at)
                          VALUES (%s, %s, %s, %s)
                          ON CONFLICT (account_id, instrument_id)
                          DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = EXCLUDED.updated_at''',
                       (account_id, instrument_id, quantity, last_action_at))
        value[account_id] += quantity * prices.on(instrument_id, now.date())
    held_accounts = {account_ids[account_index] for (account_index, _instrument_id) in state['holdings']}
    for account_id in sorted(held_accounts):
        cursor.execute('''INSERT INTO portfolio_valuations (account_id, observed_at, portfolio_value)
                          VALUES (%s, %s, %s)''', (account_id, now, value[account_id]))


def seed(connection, now, days=HISTORY_DAYS):
    """Write the history that is missing up to now. Returns counts of what was written; does not commit."""
    summary = {'traders created': 0, 'sign-ups without a profile': 0, 'orders filled': 0, 'orders rejected': 0,
               'deposits': 0, 'withdrawals': 0}
    with connection.cursor() as cursor:
        instruments = load_instruments(cursor)
        if not instruments:
            raise SystemExit('No tradable instruments in this database. Import market data first: '
                             'see apps/market-data/README.md.')
        prices = Prices(instruments)
        earliest = now.date() - timedelta(days=days)

        accounts, states, actions = {}, {}, []
        for trader in TRADERS:
            account_ids, state, first_day, created = ensure_trader(cursor, trader, now)
            summary['traders created'] += 1 if created else 0
            accounts[trader.slug], states[trader.slug] = account_ids, state
            actions.extend(plan_history(trader, max(first_day, earliest), now.date(), state, instruments, prices,
                                        until=now))
        summary['sign-ups without a profile'] = 1 if ensure_sign_up_only(cursor, now) else 0

        # In the order it happened across every trader, so ids rise with time as they would have.
        actions.sort(key=lambda action: (action.at, action.trader.slug))
        last_action = {}
        for sequence, action in enumerate(actions):
            if isinstance(action, Transfer):
                write_transfer(cursor, action, accounts[action.trader.slug])
                summary['deposits' if action.reason == 'DEPOSIT' else 'withdrawals'] += 1
            else:
                write_order(cursor, action, accounts[action.trader.slug], sequence)
                summary['orders filled' if action.status == 'FILLED' else 'orders rejected'] += 1
            last_action[action.trader.slug] = action.at
        for trader in TRADERS:
            if trader.slug in last_action:
                write_balances(cursor, trader, accounts[trader.slug], states[trader.slug],
                               last_action[trader.slug], prices, now)
    return summary


def parse_arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0].strip())
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'),
                        help='PostgreSQL URL of a development trading database; defaults to DATABASE_URL')
    parser.add_argument('--days', type=int, default=HISTORY_DAYS,
                        help=f'how far back the history starts on a first run (default {HISTORY_DAYS})')
    parser.add_argument('--dry-run', action='store_true', help='write, print the summary, and roll everything back')
    arguments = parser.parse_args(argv)
    if not arguments.database_url:
        parser.error('--database-url or DATABASE_URL is required')
    if arguments.days < 1:
        parser.error('--days must be at least 1')
    return arguments


def main(argv=None, connect=None, now=None, out=print):
    arguments = parse_arguments(argv)
    if connect is None:
        import psycopg

        connect = psycopg.connect
    now = now or datetime.now(timezone.utc)

    connection = connect(arguments.database_url)
    try:
        summary = seed(connection, now, arguments.days)
        for label, count in summary.items():
            out(f'{count:>6}  {label}')
        if arguments.dry_run:
            connection.rollback()
            out('Dry run: rolled back, nothing was kept.')
        else:
            connection.commit()
            out(f'Demo sign-ins end in @{EMAIL_DOMAIN}; the password is DemoTrader1!')
            out('Nothing was published to Kafka. Run db/tools/republish_history.py for reporting to see this.')
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()
    return 0


if __name__ == '__main__':  # pragma: no cover - the command line entry point
    sys.exit(main())
