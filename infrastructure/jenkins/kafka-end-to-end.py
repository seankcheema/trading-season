"""
One trade order through the trade-events topic and its three consumers, and
into a reporting service that has no database.

Run inside the reporting-service container of the local Compose stack
(the Jenkins "Kafka End-to-End Flow" stage does this), where every service
is reachable by its Compose name and the reporting files are at hand. The
trading database is not: nothing in this container can reach it, which is
the point, and the first step checks it.

    docker compose ... exec -T reporting-service python - < infrastructure/jenkins/kafka-end-to-end.py

It registers a trader, opens that trader's order-status stream, places a BUY
order, and then verifies what each consumer did with the two messages
(ACCEPTED and FILLED) the order published:

  order-status-pusher          the stream received both status frames
  portfolio-valuation-capture  the account's portfolio history has a valuation
  reporting-ingester           both events are in the event files, a report run
                               counts the fill, and the web service serves it
                               to an analyst and refuses it to the trader

It then checks what reached reporting on the platform-records topic, each
record from the service that owns the row: the sign-in from the auth service,
the profile, account and valuation from Holdings and Trade, the audit trail
from Order and Sell. The console, served to the seeded development admin,
must show the trader, the order, its ledger impact and its audit trail.

Every finding is printed as a "[KAFKA-E2E] step: result" line so the Jenkins
console and the archived evidence file read as a plain checklist. The exit
code is non-zero on the first failed step.
"""

import json
from decimal import Decimal, ROUND_HALF_UP
import logging
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

AUTH = 'http://auth-service:3001'
ORDERS = 'http://order-and-sell-service:8081'
HOLDINGS = 'http://holdings-and-trade-service:8082'
REPORTING = 'http://reporting-service:8083'
WAIT_SECONDS = 45

# Report runs are served to the ANALYST role only, and registration only ever
# creates traders. This is the development analyst the auth service seeds when
# NODE_ENV is not production, which is how the Compose stack runs it.
ANALYST_EMAIL = 'analyst@example.com'
ANALYST_PASSWORD = 'analyst123'
# The console is served to the ADMIN role only; the auth service seeds this one too.
ADMIN_EMAIL = 'reporting-admin@example.com'
ADMIN_PASSWORD = 'admin123'
OPENING_FUNDS = 50000.00
ORDER_QUANTITY = 10

# The chart library comments on string axis labels at INFO level; keep the
# checklist readable.
logging.getLogger('matplotlib.category').setLevel(logging.WARNING)


def say(step, result):
    print(f'[KAFKA-E2E] {step}: {result}', flush=True)


def fail(step, result):
    say(step, f'FAILED. {result}')
    sys.exit(1)


def call(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header('Content-Type', 'application/json')
    if token:
        request.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b'null')
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode(errors='replace')


def wait_for(description, probe):
    """Poll until probe() returns a truthy value or the wait runs out."""
    deadline = time.monotonic() + WAIT_SECONDS
    while time.monotonic() < deadline:
        result = probe()
        if result:
            return result
        time.sleep(1)
    fail(description, f'nothing after {WAIT_SECONDS} seconds')


class StreamReader(threading.Thread):
    """Reads GET /api/orders/stream and keeps every order-status frame."""

    def __init__(self, token):
        super().__init__(daemon=True)
        self.token = token
        self.frames = []
        self.opened = threading.Event()
        self.error = None

    def run(self):
        request = urllib.request.Request(f'{ORDERS}/api/orders/stream')
        request.add_header('Authorization', f'Bearer {self.token}')
        try:
            with urllib.request.urlopen(request, timeout=WAIT_SECONDS + 15) as response:
                self.opened.set()
                event = None
                for raw in response:
                    line = raw.decode().rstrip('\n')
                    if line.startswith('event:'):
                        event = line[len('event:'):].strip()
                    elif line.startswith('data:') and event == 'order-status':
                        self.frames.append(json.loads(line[len('data:'):]))
                        if self.frames[-1].get('status') in ('FILLED', 'REJECTED'):
                            return
        except Exception as error:  # noqa: BLE001 - reported by the main thread
            self.error = error
            self.opened.set()


def assert_no_database():
    """The reporting image must have neither a database setting nor a driver to use one with."""
    from app import app

    configured = [name for name in app.config if 'DATABASE_URL' in name]
    if configured or app.config['SQLALCHEMY_DATABASE_URI'] != 'sqlite:///:memory:':
        fail('reporting has no database', f'the service is configured with {configured or "a database URI"}')
    for driver in ('psycopg', 'psycopg2', 'pg8000', 'asyncpg'):
        try:
            __import__(driver)
        except ImportError:
            continue
        fail('reporting has no database', f'the {driver} driver is installed in the reporting image')
    say('reporting has no database', 'no database setting and no PostgreSQL driver in the reporting image; '
                                     'its tables are an in-memory read model built from the event files')


def check_conditional_orders_and_archival(token, instrument, snapshot, admin_token):
    """Exercise reservations, cancellation and retained account history over real HTTP."""
    status, account = call('POST', f'{HOLDINGS}/api/me/accounts', {'name': 'Lifecycle CI'}, token)
    if status != 201:
        fail('lifecycle account', f'creation answered {status}: {account}')
    account_id = account['accountId']
    # The fixture stays at $100, so these instructions must stay open for both
    # immediate evaluation and the background evaluator until explicitly cancelled.
    for execution_type, prices in (
        ('LIMIT', {'limitPrice': 90}),
        ('STOP', {'stopPrice': 110}),
        ('STOP_LIMIT', {'stopPrice': 110, 'limitPrice': 105}),
    ):
        status, order = call('POST', f'{ORDERS}/api/orders', {
            'accountId': account_id, 'instrumentId': instrument['instrumentId'],
            'orderType': 'BUY', 'quantity': 1, 'executionType': execution_type,
            'indicativePrice': 100, 'sessionId': snapshot['sessionId'],
            'clientReference': str(uuid.uuid4()), **prices}, token)
        if status != 201 or order.get('status') != 'ACCEPTED' or order.get('reservedCash', 0) <= 0:
            fail('conditional order', f'{execution_type} answered {status}: {order}')
        status, blocked = call('DELETE', f'{HOLDINGS}/api/me/accounts/{account_id}?confirmed=true', token=token)
        if status != 409:
            fail('archive with open order', f'expected 409, got {status}: {blocked}')
        status, cancelled = call('POST', f'{ORDERS}/api/orders/{order["orderId"]}/cancel', token=token)
        if status != 200 or cancelled.get('status') != 'CANCELLED' or cancelled.get('reservedCash') != 0:
            fail('conditional cancellation', f'{execution_type} answered {status}: {cancelled}')
        say('conditional cancellation', f'{execution_type} stayed open, blocked archival, then released its reservation')

    status, body = call('DELETE', f'{HOLDINGS}/api/me/accounts/{account_id}', token=token)
    if status != 400:
        fail('archive confirmation', f'expected 400 without confirmation, got {status}: {body}')
    status, body = call('DELETE', f'{HOLDINGS}/api/me/accounts/{account_id}?confirmed=true', token=token)
    if status != 204:
        fail('archive empty account', f'expected 204, got {status}: {body}')
    status, active = call('GET', f'{HOLDINGS}/api/me/accounts', token=token)
    if status != 200 or any(row['accountId'] == account_id for row in active):
        fail('archived account hidden', f'active accounts answered {status}: {active}')
    status, archived = call('GET', f'{HOLDINGS}/api/me/accounts/archived', token=token)
    if status != 200 or not any(row['accountId'] == account_id for row in archived):
        fail('archived history retained', f'archived accounts answered {status}: {archived}')

    def retained_order():
        status, detail = call('GET', f'{REPORTING}/api/reporting/orders/{order["orderId"]}', token=admin_token)
        return detail if status == 200 and detail.get('status') == 'CANCELLED' else None

    wait_for('cancelled order retained in reporting', retained_order)
    say('account archival', 'confirmed deletion hides the empty account and retains cancelled order history in reporting')


def main():
    assert_no_database()
    email = f'jenkins-{uuid.uuid4().hex[:8]}@example.com'
    password = 'Jenkins-' + uuid.uuid4().hex[:12]

    status, body = call('POST', f'{AUTH}/auth/register', {'email': email, 'password': password})
    if status != 201 or 'accessToken' not in body:
        fail('register credentials', f'auth-service answered {status}: {body}')
    token = body['accessToken']
    say('register credentials', f'{email} registered with the auth service')

    status, body = call('POST', f'{HOLDINGS}/api/registration', {
        'email': email, 'firstName': 'Jenkins', 'lastName': 'Pipeline', 'ssn': '123-45-6789',
        'address': '1 Build Street', 'dateOfBirth': '1990-01-01', 'traderLevel': 'INTERMEDIATE',
        'availableFunds': OPENING_FUNDS}, token)
    if status != 201:
        fail('register trader profile', f'holdings-and-trade-service answered {status}: {body}')
    status, body = call('PUT', f'{HOLDINGS}/api/users/me/terms-acceptance',
                        {'termsVersion': '2026-10-12'}, token)
    if status != 200 or not body.get('termsAccepted'):
        fail('accept platform terms', f'holdings-and-trade-service answered {status}: {body}')
    say('accept platform terms', 'current platform terms accepted for the test trader')
    status, accounts = call('GET', f'{HOLDINGS}/api/me/accounts', token=token)
    if status != 200 or not accounts:
        fail('default account', f'holdings-and-trade-service answered {status}: {accounts}')
    account_id = accounts[0]['accountId']
    say('register trader profile', f'profile created, default account {account_id}')

    status, settings = call('GET', f'{HOLDINGS}/api/users/me/execution-settings', token=token)
    if status != 200 or settings.get('executionBufferPercent') != 1:
        fail('default execution buffer', f'new trader preference was {status}: {settings}')
    status, settings = call('PUT', f'{HOLDINGS}/api/users/me/execution-settings', {'executionBufferPercent': 2}, token)
    if status != 200 or settings.get('executionBufferPercent') != 2:
        fail('save execution buffer', f'preference update was {status}: {settings}')
    say('save execution buffer', 'default 1% changed to persisted 2% for this trader')
    status, snapshot = call('GET', f'{HOLDINGS}/api/market/snapshot')
    if status != 200:
        fail('market quote', f'authoritative snapshot was {status}: {snapshot}')
    quotes = {stock['symbol']: stock['price'] for stock in snapshot['stocks']}
    status, instruments = call('GET', f'{ORDERS}/api/instruments', token=token)
    tradable = [i for i in instruments if i.get('tradable') and i.get('simulatedStockSymbol') in quotes] if status == 200 else []
    if not tradable:
        fail('instrument', f'no tradable instrument; order-and-sell-service answered {status}: {instruments}')
    instrument = tradable[0]
    displayed_price = quotes[instrument['simulatedStockSymbol']]
    say('instrument', f"{instrument['ticker']} (id {instrument['instrumentId']}) is tradable")

    stream = StreamReader(token)
    stream.start()
    stream.opened.wait(30)
    if stream.error or not stream.opened.is_set():
        fail('open order stream', f'GET /api/orders/stream did not open: {stream.error}')
    say('open order stream', 'GET /api/orders/stream is open for this trader')

    status, order = call('POST', f'{ORDERS}/api/orders', {
        'accountId': account_id, 'instrumentId': instrument['instrumentId'], 'orderType': 'BUY',
        'quantity': ORDER_QUANTITY, 'executionType': 'MARKET', 'indicativePrice': displayed_price,
        'sessionId': snapshot['sessionId'], 'clientReference': str(uuid.uuid4())}, token)
    if status != 201 or order.get('status') != 'FILLED':
        fail('place order', f'order-and-sell-service answered {status}: {order}')
    if order.get('bufferPercent') != 2 or order.get('referencePrice') is None:
        fail('order protection snapshot', f'missing persisted execution protection: {order}')
    order_id = order['orderId']
    say('place order', f'order {order_id}: BUY 10 {instrument["ticker"]} at {order["executionPrice"]}, status {order["status"]}')
    print(f'[KAFKA-E2E] orderId={order_id} accountId={account_id}', flush=True)

    stream.join(WAIT_SECONDS)
    statuses = [frame['status'] for frame in stream.frames if frame.get('orderId') == order_id]
    if statuses != ['ACCEPTED', 'FILLED']:
        fail('consumer order-status-pusher', f'stream frames for order {order_id} were {statuses}, error {stream.error}')
    say('consumer order-status-pusher', f'the stream delivered ACCEPTED then FILLED for order {order_id}')

    from app import app
    from models import Account, PortfolioValuation, User, db
    from read_model import read_model
    import report_run

    # The capture consumer wrote to the trading database, which this container
    # cannot reach, so ask the service that owns the row.
    def captured_points():
        status, points = call('GET', f'{HOLDINGS}/api/accounts/{account_id}/portfolio-history?timeframe=1D',
                              token=token)
        return points if status == 200 and points else None
    points = wait_for('consumer portfolio-valuation-capture', captured_points)
    say('consumer portfolio-valuation-capture',
        f'the portfolio history of account {account_id} has {len(points)} point(s), latest value {points[-1]["value"]}')

    with app.app_context():
        files_dir = app.config['REPORTING_FILES_DIR']

        def stored_statuses():
            found = sorted(e['status'] for e in report_run.load_events(files_dir) if e.get('orderId') == order_id)
            return found if found == ['ACCEPTED', 'FILLED'] else None
        wait_for('consumer reporting-ingester', stored_statuses)
        say('consumer reporting-ingester', f'both events of order {order_id} are in the event files')

        # The same capture, as it reached reporting: published by Holdings and
        # Trade to platform-records, stored by the consumer, applied to the read model.
        def valuation_in_read_model():
            with read_model.lock:
                try:
                    read_model.sync(db.session, files_dir)
                    row = db.session.query(PortfolioValuation).filter_by(account_id=account_id).first()
                    return float(row.portfolio_value) if row is not None else None
                finally:
                    db.session.rollback()
        # Zero is a real value, so compare with None instead of using wait_for's truthiness.
        deadline = time.monotonic() + WAIT_SECONDS
        value = valuation_in_read_model()
        while value is None and time.monotonic() < deadline:
            time.sleep(1)
            value = valuation_in_read_model()
        if value is None:
            fail('valuation reached reporting', f'no PORTFOLIO_VALUATION record for account {account_id} '
                                                f'after {WAIT_SECONDS} seconds')
        say('valuation reached reporting', f'the read model holds a portfolio value of {value} for account '
                                           f'{account_id}, from the platform-records topic')

        # The account and profile records travel on other partitions of platform-records
        # than the valuation, so they can land after it. A report run before they are
        # applied cannot name the account, so wait for both rows like the valuation.
        def account_in_read_model():
            with read_model.lock:
                try:
                    read_model.sync(db.session, files_dir)
                    account = db.session.get(Account, account_id)
                    return account is not None and db.session.get(User, account.user_id) is not None
                finally:
                    db.session.rollback()
        wait_for('account reached reporting', account_in_read_model)
        say('account reached reporting', f'the read model holds account {account_id} and its customer profile, '
                                         'from the platform-records topic')

        with read_model.lock:
            read_model.sync(db.session, files_dir)
            report = report_run.run_report(files_dir, db.session)
            db.session.remove()
    say('report run', f"run {report['runId']}: {report['eventCount']} events, "
                      f"{report['statusCounts']['FILLED']} filled, {report['statusCounts']['REJECTED']} rejected, "
                      f"charts {', '.join(report['files'])}")

    status, refused = call('GET', f'{REPORTING}/api/reporting/runs/latest', token=token)
    if status != 403:
        fail('report refused to a trader', f'reporting-service answered {status} to a TRADER token: {refused}')
    say('report refused to a trader', 'GET /api/reporting/runs/latest answers 403 to the trader who placed the order')

    status, body = call('POST', f'{AUTH}/auth/login', {'email': ANALYST_EMAIL, 'password': ANALYST_PASSWORD})
    if status != 201 or 'accessToken' not in body:
        fail('analyst sign-in', f'auth-service answered {status} for the seeded analyst {ANALYST_EMAIL}: {body}')
    analyst_token = body['accessToken']
    say('analyst sign-in', f'{ANALYST_EMAIL} signed in with the ANALYST role')

    status, served = call('GET', f'{REPORTING}/api/reporting/runs/latest', token=analyst_token)
    if status != 200 or served.get('runId') != report['runId']:
        fail('report served', f'reporting-service answered {status}: {served}')
    symbols = [row['symbol'] for row in served['volumeBySymbol']]
    if instrument['ticker'] not in symbols:
        fail('report served', f'{instrument["ticker"]} missing from volumeBySymbol {symbols}')
    say('report served', f"GET /api/reporting/runs/latest returns run {served['runId']} to the analyst with {instrument['ticker']} in its volume table")

    account_names = [row.get('accountName') for row in served['tradesPerAccount'] if row['accountId'] == account_id]
    if account_names != ['Main Account']:
        fail('report names the account', f'tradesPerAccount names account {account_id} as {account_names}')
    say('report names the account', f'the run labels account {account_id} "Main Account (Jenkins Pipeline)" '
                                    'from the account and profile records, not from the database')

    status, body = call('POST', f'{AUTH}/auth/login', {'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
    if status != 201 or 'accessToken' not in body:
        fail('admin sign-in', f'auth-service answered {status} for the seeded admin {ADMIN_EMAIL}: {body}')
    admin_token = body['accessToken']
    say('admin sign-in', f'{ADMIN_EMAIL} signed in with the ADMIN role')

    settled_cost = (Decimal(str(order['executionPrice'])) * ORDER_QUANTITY).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    funds_left = float(Decimal(str(OPENING_FUNDS)) - settled_cost)

    def customer_in_console():
        status, listed = call('GET', f'{REPORTING}/api/reporting/customers', token=admin_token)
        if status != 200:
            return None
        return next((row for row in listed['customers'] if row['email'] == email and row['cash'] == funds_left), None)
    customer = wait_for('console shows the customer', customer_in_console)
    if (customer['name'], customer['traderLevel'], customer['accounts']) != ('Jenkins Pipeline', 'INTERMEDIATE', 1):
        fail('console shows the customer', f'the console lists {customer}')
    say('console shows the customer', f"{customer['email']} is listed as {customer['name']}, {customer['traderLevel']}, "
                                      f"cash {customer['cash']}: sign-in from auth, profile and account from "
                                      "Holdings and Trade, cash from the fill")

    def order_in_console():
        status, detail = call('GET', f'{REPORTING}/api/reporting/orders/{order_id}', token=admin_token)
        if status != 200 or len(detail.get('audit', [])) < 3:
            return None
        return detail
    detail = wait_for('console shows the order', order_in_console)
    trail = [entry['eventType'] for entry in detail['audit']]
    ledger = detail['ledger']
    if (detail['status'], trail) != ('FILLED', ['PENDING', 'ACCEPTED', 'FILLED']):
        fail('console shows the order', f"order {order_id} is {detail['status']} with audit trail {trail}")
    if (ledger['cashBefore'], ledger['cashAfter'], ledger['holdingAfter']) != (OPENING_FUNDS, funds_left,
                                                                               float(ORDER_QUANTITY)):
        fail('console shows the order', f'order {order_id} has ledger {ledger}')
    say('console shows the order', f"order {order_id} is FILLED with audit trail {' > '.join(trail)}, cash "
                                   f"{ledger['cashBefore']} to {ledger['cashAfter']}, holding "
                                   f"{ledger['holdingBefore']} to {ledger['holdingAfter']}")
    check_conditional_orders_and_archival(token, instrument, snapshot, admin_token)
    say('result', 'market fill, conditional cancellations, account archival, three consumers and retained reporting history: all verified')


if __name__ == '__main__':
    main()
