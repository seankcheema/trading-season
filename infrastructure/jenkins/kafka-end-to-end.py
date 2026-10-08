"""
One trade order through the trade-events topic and its three consumers.

Run inside the reporting-consumer container of the local Compose stack
(the Jenkins "Kafka End-to-End Flow" stage does this), where every service
is reachable by its Compose name and the reporting files and database are
at hand:

    docker compose ... exec -T reporting-consumer python - < infrastructure/jenkins/kafka-end-to-end.py

It registers a trader, opens that trader's order-status stream, places a BUY
order, and then verifies what each consumer did with the two messages
(ACCEPTED and FILLED) the order published:

  order-status-pusher          the stream received both status frames
  portfolio-valuation-capture  a portfolio valuation row exists for the account
  reporting-ingester           both events are in the event files, a report run
                               counts the fill, and the web service serves it

Every finding is printed as a "[KAFKA-E2E] step: result" line so the Jenkins
console and the archived evidence file read as a plain checklist. The exit
code is non-zero on the first failed step.
"""

import json
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


def main():
    email = f'jenkins-{uuid.uuid4().hex[:8]}@example.com'
    password = 'Jenkins-' + uuid.uuid4().hex[:12]

    status, body = call('POST', f'{AUTH}/auth/register', {'email': email, 'password': password})
    if status != 201 or 'accessToken' not in body:
        fail('register credentials', f'auth-service answered {status}: {body}')
    token = body['accessToken']
    say('register credentials', f'{email} registered with the auth service')

    status, body = call('POST', f'{HOLDINGS}/api/auth/register', {
        'email': email, 'firstName': 'Jenkins', 'lastName': 'Pipeline', 'ssn': '123-45-6789',
        'address': '1 Build Street', 'dateOfBirth': '1990-01-01', 'traderLevel': 'INTERMEDIATE',
        'availableFunds': 50000.00}, token)
    if status != 201:
        fail('register trader profile', f'holdings-and-trade-service answered {status}: {body}')
    status, accounts = call('GET', f'{HOLDINGS}/api/me/accounts', token=token)
    if status != 200 or not accounts:
        fail('default account', f'holdings-and-trade-service answered {status}: {accounts}')
    account_id = accounts[0]['accountId']
    say('register trader profile', f'profile created, default account {account_id}')

    status, instruments = call('GET', f'{ORDERS}/api/instruments', token=token)
    tradable = [i for i in instruments if i.get('tradable')] if status == 200 else []
    if not tradable:
        fail('instrument', f'no tradable instrument; order-and-sell-service answered {status}: {instruments}')
    instrument = tradable[0]
    say('instrument', f"{instrument['ticker']} (id {instrument['instrumentId']}) is tradable")

    stream = StreamReader(token)
    stream.start()
    stream.opened.wait(30)
    if stream.error or not stream.opened.is_set():
        fail('open order stream', f'GET /api/orders/stream did not open: {stream.error}')
    say('open order stream', 'GET /api/orders/stream is open for this trader')

    status, order = call('POST', f'{ORDERS}/api/orders', {
        'accountId': account_id, 'instrumentId': instrument['instrumentId'], 'orderType': 'BUY',
        'quantity': 10, 'indicativePrice': 25.00, 'clientReference': str(uuid.uuid4())}, token)
    if status != 201 or order.get('status') != 'FILLED':
        fail('place order', f'order-and-sell-service answered {status}: {order}')
    order_id = order['orderId']
    say('place order', f'order {order_id}: BUY 10 {instrument["ticker"]} at 25.00, status {order["status"]}')
    print(f'[KAFKA-E2E] orderId={order_id} accountId={account_id}', flush=True)

    stream.join(WAIT_SECONDS)
    statuses = [frame['status'] for frame in stream.frames if frame.get('orderId') == order_id]
    if statuses != ['ACCEPTED', 'FILLED']:
        fail('consumer order-status-pusher', f'stream frames for order {order_id} were {statuses}, error {stream.error}')
    say('consumer order-status-pusher', f'the stream delivered ACCEPTED then FILLED for order {order_id}')

    from app import app
    from models import db
    from sqlalchemy import text
    import report_run
    import run_store

    with app.app_context():
        def valuation_rows():
            return db.session.execute(
                text('SELECT count(*) FROM portfolio_valuations WHERE account_id = :account'),
                {'account': account_id}).scalar()
        rows = wait_for('consumer portfolio-valuation-capture', valuation_rows)
        value = db.session.execute(
            text('SELECT portfolio_value FROM portfolio_valuations WHERE account_id = :account '
                 'ORDER BY observed_at DESC LIMIT 1'), {'account': account_id}).scalar()
        say('consumer portfolio-valuation-capture',
            f'{rows} valuation row(s) for account {account_id}, latest value {value}')

        files_dir = app.config['REPORTING_FILES_DIR']

        def stored_statuses():
            found = sorted(e['status'] for e in report_run.load_events(files_dir) if e.get('orderId') == order_id)
            return found if found == ['ACCEPTED', 'FILLED'] else None
        wait_for('consumer reporting-ingester', stored_statuses)
        say('consumer reporting-ingester', f'both events of order {order_id} are in the event files')

        report = report_run.run_report(files_dir, db.session)
        db.session.remove()
    say('report run', f"run {report['runId']}: {report['eventCount']} events, "
                      f"{report['statusCounts']['FILLED']} filled, {report['statusCounts']['REJECTED']} rejected, "
                      f"charts {', '.join(report['files'])}")

    status, served = call('GET', f'{REPORTING}/api/reporting/runs/latest', token=token)
    if status != 200 or served.get('runId') != report['runId']:
        fail('report served', f'reporting-service answered {status}: {served}')
    symbols = [row['symbol'] for row in served['volumeBySymbol']]
    if instrument['ticker'] not in symbols:
        fail('report served', f'{instrument["ticker"]} missing from volumeBySymbol {symbols}')
    say('report served', f"GET /api/reporting/runs/latest returns run {served['runId']} with {instrument['ticker']} in its volume table")
    say('result', 'one order, two messages, three consumers: all verified')


if __name__ == '__main__':
    main()
