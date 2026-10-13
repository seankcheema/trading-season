"""
Serves the real Reporting Service on a throwaway reporting files directory.

The directory is filled the way the consumer fills it: every message of
fixtures/scenario.json is appended to the topic files through the service's
own EventStore, then one report run is generated from them with the service's
own run_report, so the read model, the run and its PNG charts are the real
ones. Nothing is mocked in the service. It verifies tokens against the JWKS
of the auth stand-in at AUTH_SERVICE_URL, like it does against the Auth Service.

Environment: PORT (default 8390), AUTH_SERVICE_URL, AUTH_JWT_ISSUER.
"""

import atexit
import json
import logging
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVICE_DIR = HERE.parents[2] / 'reporting-service'
SCENARIO = json.loads((HERE.parent / 'fixtures' / 'scenario.json').read_text(encoding='utf-8'))

FILES_DIR = tempfile.mkdtemp(prefix='reporting-e2e-')
atexit.register(shutil.rmtree, FILES_DIR, ignore_errors=True)

os.environ.update({
    'FLASK_ENV': 'production',
    'REPORTING_FILES_DIR': FILES_DIR,
    'SCHEDULER_ENABLED': 'false',
    'MPLCONFIGDIR': os.path.join(FILES_DIR, 'matplotlib'),
})
os.environ.setdefault('AUTH_SERVICE_URL', 'http://127.0.0.1:3390')
os.environ.setdefault('AUTH_JWT_ISSUER', 'http://127.0.0.1:3390')

sys.path.insert(0, str(SERVICE_DIR))

from tests import messages  # noqa: E402  the producers' message shapes
from event_store import PLATFORM_RECORDS, TRADE_EVENTS, EventStore  # noqa: E402


STARTING_CASH = 50000


def stamp(moment):
    return moment.strftime('%Y-%m-%dT%H:%M:%SZ')


def seed(now):
    events = Path(FILES_DIR) / 'events'
    trade = EventStore(events, TRADE_EVENTS)
    platform = EventStore(events, PLATFORM_RECORDS)
    counters = {'trade': 0, 'platform': 0}

    def publish_record(record):
        # The service never reads the key of a platform record, only the body.
        platform.append(0, counters['platform'], f"{record['type']}:{counters['platform']}", record)
        counters['platform'] += 1

    def publish_order(event):
        trade.append(0, counters['trade'], str(event['accountId']), event)
        counters['trade'] += 1

    def ago(hours):
        return now - timedelta(hours=hours)

    publish_record(messages.market_session())

    long_ago = stamp(ago(24 * 200))
    for person in SCENARIO['staff']:
        role = person['roles'][0]
        publish_record(messages.sign_in(person['userId'], person['email'], role, created_at=long_ago,
                                        updated_at=long_ago))
        if 'profile' in person:
            profile = person['profile']
            publish_record(messages.profile(person['userId'], profile['firstName'], profile['lastName'],
                                            profile['traderLevel'], profile['funds'], as_of=long_ago,
                                            created_at=long_ago))

    account_owner = {}
    for customer in SCENARIO['customers']:
        locked_until = (stamp(now + timedelta(hours=customer['lockedForHours']))
                        if customer.get('lockedForHours') else None)
        publish_record(messages.sign_in(customer['userId'], customer['email'], 'TRADER',
                                        failed=customer['failedLoginAttempts'], locked_until=locked_until,
                                        created_at=long_ago, updated_at=stamp(ago(30))))
        publish_record(messages.profile(customer['userId'], customer['firstName'], customer['lastName'],
                                        customer['traderLevel'], customer['funds'], as_of=stamp(ago(30)),
                                        created_at=long_ago))
        for account in customer['accounts']:
            account_owner[account['accountId']] = customer['userId']
            publish_record(messages.account(account['accountId'], customer['userId'], account['name'],
                                            opened=long_ago[:10]))

    valuation_id = 0
    for customer in SCENARIO['customers']:
        for account in customer['accounts']:
            valuation_id += 1
            publish_record(messages.valuation(valuation_id, account['accountId'], account['valuation'],
                                              stamp(ago(1))))

    for transfer in SCENARIO['transfers']:
        publish_record(messages.transfer(transfer['transferId'], transfer['accountId'],
                                         account_owner[transfer['accountId']], transfer['amount'],
                                         transfer['reason'], stamp(ago(transfer['hoursAgo']))))

    # Orders are replayed oldest first so each fill carries the cash and the
    # holding the ledger really left: a trader starts with STARTING_CASH, and a
    # sell is only ever of shares an earlier buy brought in.
    cash = {customer['userId']: STARTING_CASH for customer in SCENARIO['customers']}
    held = {}
    fill_id = cash_id = audit_id = 0
    for order in sorted(SCENARIO['orders'], key=lambda item: -item['hoursAgo']):
        submitted = ago(order['hoursAgo'])
        resolved = submitted + timedelta(seconds=1)
        common = dict(account_id=order['accountId'], symbol=order['symbol'], name=order['name'],
                      instrument_id=order['instrumentId'], side=order['side'], quantity=order['quantity'],
                      price=order['price'], submitted_at=stamp(submitted))
        audit_id += 1
        publish_record(messages.audit(audit_id, order['orderId'], 'ORDER_SUBMITTED', recorded_at=stamp(submitted)))
        if order['status'] == 'FILLED':
            fill_id += 1
            cash_id += 1
            owner = account_owner[order['accountId']]
            sign = -1 if order['side'] == 'BUY' else 1
            cash[owner] += sign * order['quantity'] * order['price']
            holding = (order['accountId'], order['symbol'])
            held[holding] = held.get(holding, 0) - sign * order['quantity']
            publish_order(messages.filled(
                order['orderId'], fill_id, cash_id, fill_id, at=stamp(resolved), user_id=owner,
                cash_amount=sign * order['quantity'] * order['price'], funds=cash[owner],
                delta=-sign * order['quantity'], held=held[holding], **common))
            audit_id += 1
            publish_record(messages.audit(audit_id, order['orderId'], 'ORDER_FILLED', recorded_at=stamp(resolved)))
        elif order['status'] == 'REJECTED':
            publish_order(messages.order_event(order['orderId'], 'REJECTED', reason=order['reason'],
                                               resolved_at=stamp(resolved), **common))
            audit_id += 1
            publish_record(messages.audit(audit_id, order['orderId'], 'ORDER_REJECTED', order['reason'],
                                          recorded_at=stamp(resolved)))
        else:
            publish_order(messages.order_event(order['orderId'], order['status'], accepted_at=stamp(resolved),
                                               **common))
            audit_id += 1
            publish_record(messages.audit(audit_id, order['orderId'], 'ORDER_ACCEPTED', recorded_at=stamp(resolved)))


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    seed(now)

    from app import app, db, register_routes
    from read_model import read_model
    from report_run import run_report

    # Per-request access logs and chart bookkeeping drown a test run; failures still show.
    logging.getLogger().setLevel(logging.WARNING)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    register_routes()
    with app.app_context():
        with read_model.lock:
            read_model.sync(db.session, FILES_DIR)
            run_report(FILES_DIR, db.session, now=now)
            db.session.rollback()

    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', 8390)), threaded=True, use_reloader=False)


if __name__ == '__main__':
    main()
