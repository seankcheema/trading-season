"""The republish tool: database rows in, the services' own messages out."""

import json
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import reporting_feed  # noqa: E402
import republish_history  # noqa: E402
from reporting_feed import PLATFORM_RECORDS, TRADE_EVENTS, balances_after, build_messages, iso, publish  # noqa: E402

SEAN = uuid.UUID('a0000000-0000-4000-8000-00000000000a')
JANE = uuid.UUID('b0000000-0000-4000-8000-00000000000b')
REFERENCE = uuid.UUID('c0000000-0000-4000-8000-000000000007')


def at(day, hour=9, minute=30):
    return datetime(2026, 10, day, hour, minute, tzinfo=timezone.utc)


@pytest.fixture
def snapshot():
    """
    Sean deposited 500, bought 10 AAPL at 100 then 5 more at 110, and
    withdrew 200; he has 7750 left and holds 15. Jane had an order rejected.
    """
    def order(order_id, account_id, status, quantity, price, when, fill_id=None, reason=None):
        filled = fill_id is not None
        return {
            'order_id': order_id, 'account_id': account_id, 'instrument_id': 3, 'client_reference': REFERENCE,
            'order_type': 'BUY', 'status': status, 'quantity': Decimal(quantity), 'indicative_price': Decimal(price),
            'buffer_percent': Decimal('0.50'), 'rejection_reason': reason, 'submitted_at': when,
            'accepted_at': when if filled else None, 'resolved_at': when, 'simulated_at': None,
            'ticker': 'AAPL', 'instrument_name': 'Apple Inc.', 'fill_id': fill_id,
            'quote_price': Decimal(price) if filled else None,
            'fill_quantity': Decimal(quantity) if filled else None, 'filled_at': when if filled else None,
        }

    return {
        'as_of': [{'as_of': at(8, 12)}],
        'sign_ins': [
            {'user_id': SEAN, 'email': 'sean@example.com', 'user_role': 'TRADER', 'failed_login_attempts': 0,
             'locked_until': None, 'created_at': at(1), 'updated_at': at(1)},
            {'user_id': JANE, 'email': 'jane@example.com', 'user_role': 'TRADER', 'failed_login_attempts': 5,
             'locked_until': at(9), 'created_at': at(2), 'updated_at': at(8)},
        ],
        'profiles': [
            {'user_id': SEAN, 'first_name': 'Sean', 'last_name': 'Cheema', 'trader_level': 'ADVANCED',
             'available_funds': Decimal('7750.00'), 'session_timeout_minutes': 15, 'last_activity_at': at(7),
             'created_at': at(1)},
            {'user_id': JANE, 'first_name': 'Jane', 'last_name': 'Doe', 'trader_level': 'BEGINNER',
             'available_funds': Decimal('5000.00'), 'session_timeout_minutes': 10, 'last_activity_at': None,
             'created_at': at(2)},
        ],
        'accounts': [
            {'account_id': 1, 'user_id': SEAN, 'name': 'Main Account', 'opened_date': date(2026, 10, 1),
             'currency': 'USD'},
            {'account_id': 2, 'user_id': SEAN, 'name': 'Growth', 'opened_date': date(2026, 10, 3), 'currency': 'USD'},
            {'account_id': 3, 'user_id': JANE, 'name': 'Primary', 'opened_date': date(2026, 10, 2),
             'currency': 'USD'},
        ],
        'session': [{'id': 2026001}],
        'cash': [
            {'cash_transaction_id': 10, 'account_id': 1, 'fill_id': None, 'amount': Decimal('500.00'),
             'reason': 'DEPOSIT', 'created_at': at(4)},
            {'cash_transaction_id': 11, 'account_id': 1, 'fill_id': 4, 'amount': Decimal('-1000.00'),
             'reason': 'ORDER_FILL', 'created_at': at(5)},
            # Booked against his other account: cash is the trader's, not the account's.
            {'cash_transaction_id': 12, 'account_id': 2, 'fill_id': 5, 'amount': Decimal('-550.00'),
             'reason': 'ORDER_FILL', 'created_at': at(6)},
            {'cash_transaction_id': 13, 'account_id': 1, 'fill_id': None, 'amount': Decimal('-200.00'),
             'reason': 'WITHDRAWAL', 'created_at': at(7)},
        ],
        'movements': [
            {'holding_movement_id': 5, 'account_id': 1, 'instrument_id': 3, 'fill_id': 4,
             'quantity_delta': Decimal('10')},
            {'holding_movement_id': 6, 'account_id': 2, 'instrument_id': 3, 'fill_id': 5,
             'quantity_delta': Decimal('5')},
        ],
        'holdings': [
            {'account_id': 1, 'instrument_id': 3, 'quantity': Decimal('10')},
            {'account_id': 2, 'instrument_id': 3, 'quantity': Decimal('5')},
        ],
        'valuations': [{'valuation_id': 45, 'account_id': 1, 'observed_at': at(8), 'portfolio_value': Decimal('1100.50')}],
        'audit': [
            {'audit_id': 1, 'order_id': 7, 'event_type': 'PENDING', 'detail': None, 'recorded_at': at(5)},
            {'audit_id': 2, 'order_id': 7, 'event_type': 'FILLED', 'detail': 'Filled 10 @ 100.00',
             'recorded_at': at(5)},
        ],
        'orders': [
            order(7, 1, 'FILLED', 10, '100.00', at(5), fill_id=4),
            order(8, 2, 'FILLED', 5, '110.00', at(6), fill_id=5),
            order(9, 3, 'REJECTED', 1000, '180.00', at(7), reason='BR-09: insufficient funds for this order'),
        ],
    }


def of_type(messages, record_type):
    return [message for message in messages if message.body.get('type') == record_type]


class TestBalancesAfter:

    def test_the_newest_posting_left_the_current_balance_and_each_earlier_one_what_came_before(self):
        after = balances_after(Decimal('7750'), [(10, Decimal('500')), (13, Decimal('-200')),
                                                 (11, Decimal('-1000')), (12, Decimal('-550'))])

        assert after == {13: Decimal('7750'), 12: Decimal('7950'), 11: Decimal('8500'), 10: Decimal('9500')}

    def test_no_postings_no_balances(self):
        assert balances_after(Decimal('10'), []) == {}


class TestRecords:

    def test_every_row_becomes_one_record_keyed_by_its_type_and_id(self, snapshot):
        messages = [message for message in build_messages(snapshot) if message.topic == PLATFORM_RECORDS]

        assert [message.key for message in messages] == [
            f'SIGN_IN:{SEAN}', f'SIGN_IN:{JANE}',
            f'CUSTOMER_PROFILE:{SEAN}', f'CUSTOMER_PROFILE:{JANE}',
            'TRADING_ACCOUNT:1', 'TRADING_ACCOUNT:2', 'TRADING_ACCOUNT:3',
            'MARKET_SESSION:current',
            'CASH_TRANSFER:10', 'CASH_TRANSFER:13',
            'PORTFOLIO_VALUATION:1',
            'ORDER_AUDIT:1', 'ORDER_AUDIT:2',
        ]

    def test_a_sign_in_carries_its_lock_and_never_a_password(self, snapshot):
        jane = of_type(build_messages(snapshot), 'SIGN_IN')[1].body

        assert jane == {'type': 'SIGN_IN', 'userId': str(JANE), 'email': 'jane@example.com', 'role': 'TRADER',
                        'failedLoginAttempts': 5, 'lockedUntil': '2026-10-09T09:30:00+00:00',
                        'createdAt': '2026-10-02T09:30:00+00:00', 'updatedAt': '2026-10-08T09:30:00+00:00'}
        assert 'password' not in reporting_feed.QUERIES['sign_ins']

    def test_a_profile_carries_todays_cash_as_of_the_snapshot_and_nothing_private(self, snapshot):
        sean = of_type(build_messages(snapshot), 'CUSTOMER_PROFILE')[0].body

        assert sean['availableFunds'] == 7750.0
        assert sean['asOf'] == '2026-10-08T12:30:00+00:00'
        assert (sean['firstName'], sean['traderLevel'], sean['sessionTimeoutMinutes']) == ('Sean', 'ADVANCED', 15)
        for private in ('ssn', 'address', 'date_of_birth', 'middle_name'):
            assert private not in reporting_feed.QUERIES['profiles']

    def test_a_transfer_carries_the_balance_it_left_across_all_the_traders_accounts(self, snapshot):
        deposit, withdrawal = of_type(build_messages(snapshot), 'CASH_TRANSFER')

        assert (deposit.body['amount'], deposit.body['availableFunds']) == (500.0, 9500.0)
        assert (withdrawal.body['amount'], withdrawal.body['availableFunds']) == (-200.0, 7750.0)
        assert withdrawal.body['userId'] == str(SEAN)
        assert withdrawal.body['reason'] == 'WITHDRAWAL'

    def test_an_order_fills_cash_posting_is_not_published_as_a_transfer(self, snapshot):
        assert [message.body['cashTransactionId'] for message in of_type(build_messages(snapshot), 'CASH_TRANSFER')
                ] == [10, 13]

    def test_the_other_records(self, snapshot):
        messages = build_messages(snapshot)

        assert of_type(messages, 'TRADING_ACCOUNT')[1].body == {
            'type': 'TRADING_ACCOUNT', 'accountId': 2, 'userId': str(SEAN), 'name': 'Growth',
            'openedDate': '2026-10-03', 'currency': 'USD'}
        assert of_type(messages, 'MARKET_SESSION')[0].body == {'type': 'MARKET_SESSION', 'sessionId': 2026001}
        assert of_type(messages, 'PORTFOLIO_VALUATION')[0].body == {
            'type': 'PORTFOLIO_VALUATION', 'valuationId': 45, 'accountId': 1,
            'observedAt': '2026-10-08T09:30:00+00:00', 'portfolioValue': 1100.5}
        assert of_type(messages, 'ORDER_AUDIT')[1].body == {
            'type': 'ORDER_AUDIT', 'auditId': 2, 'orderId': 7, 'eventType': 'FILLED',
            'detail': 'Filled 10 @ 100.00', 'recordedAt': '2026-10-05T09:30:00+00:00'}

    def test_a_database_without_a_completed_session_publishes_none(self, snapshot):
        snapshot['session'] = []

        assert of_type(build_messages(snapshot), 'MARKET_SESSION') == []


class TestOrderEvents:

    def orders(self, snapshot):
        return [message for message in build_messages(snapshot) if message.topic == TRADE_EVENTS]

    def test_an_order_is_one_event_at_its_current_status_keyed_by_its_account(self, snapshot):
        first, second, rejected = self.orders(snapshot)

        assert [message.key for message in (first, second, rejected)] == ['1', '2', '3']
        assert first.body['orderId'] == 7
        assert (first.body['status'], first.body['symbol'], first.body['side']) == ('FILLED', 'AAPL', 'BUY')
        assert (first.body['quantity'], first.body['price']) == (10.0, 100.0)
        assert first.body['occurredAt'] == '2026-10-05T09:30:00+00:00'
        assert first.body['order'] == {
            'clientReference': str(REFERENCE), 'instrumentId': 3, 'instrumentName': 'Apple Inc.',
            'indicativePrice': 100.0, 'bufferPercent': 0.5, 'submittedAt': '2026-10-05T09:30:00+00:00',
            'acceptedAt': '2026-10-05T09:30:00+00:00', 'resolvedAt': '2026-10-05T09:30:00+00:00',
            'simulatedAt': None}

    def test_a_fill_carries_both_postings_and_the_balances_they_left(self, snapshot):
        first, second, _rejected = self.orders(snapshot)

        assert first.body['execution'] == {
            'userId': str(SEAN), 'fillId': 4, 'price': 100.0, 'quantity': 10.0,
            'filledAt': '2026-10-05T09:30:00+00:00', 'cashTransactionId': 11, 'cashAmount': -1000.0,
            'availableFunds': 8500.0, 'holdingMovementId': 5, 'quantityDelta': 10.0, 'holdingQuantity': 10.0}
        # The second fill is on another account of the same trader: one cash balance, its own holding.
        assert second.body['execution']['availableFunds'] == 7950.0
        assert second.body['execution']['holdingQuantity'] == 5.0

    def test_a_holding_is_worked_back_through_later_movements_of_the_same_position(self, snapshot):
        snapshot['movements'].append({'holding_movement_id': 9, 'account_id': 1, 'instrument_id': 3, 'fill_id': 8,
                                      'quantity_delta': Decimal('-4')})
        snapshot['holdings'][0]['quantity'] = Decimal('6')

        assert self.orders(snapshot)[0].body['execution']['holdingQuantity'] == 10.0

    def test_a_rejected_order_has_its_reason_and_no_execution(self, snapshot):
        rejected = self.orders(snapshot)[2].body

        assert rejected['rejectionReason'] == 'BR-09: insufficient funds for this order'
        assert rejected['execution'] is None
        assert rejected['order']['acceptedAt'] is None

    def test_a_fill_whose_ledger_rows_are_missing_still_publishes_the_fill(self, snapshot):
        snapshot['cash'] = [row for row in snapshot['cash'] if row['fill_id'] != 4]
        snapshot['movements'] = [row for row in snapshot['movements'] if row['fill_id'] != 4]

        execution = self.orders(snapshot)[0].body['execution']

        assert execution['fillId'] == 4
        assert execution['cashTransactionId'] is None and execution['holdingMovementId'] is None
        assert execution['availableFunds'] is None and execution['holdingQuantity'] is None

    def test_an_order_of_an_account_without_a_profile_is_published_without_a_balance(self, snapshot):
        snapshot['profiles'] = [row for row in snapshot['profiles'] if row['user_id'] != SEAN]

        assert self.orders(snapshot)[0].body['execution']['availableFunds'] is None


class TestIso:

    def test_timestamps_are_utc_and_naive_ones_are_taken_as_utc(self):
        eastern = datetime.fromisoformat('2026-10-05T05:30:00-04:00')

        assert iso(eastern) == '2026-10-05T09:30:00+00:00'
        assert iso(datetime(2026, 10, 5, 9, 30)) == '2026-10-05T09:30:00+00:00'
        assert iso(date(2026, 10, 5)) == '2026-10-05'
        assert iso(None) is None
        assert iso('already text') == 'already text'


class FakeProducer:

    def __init__(self, fail_keys=(), unsent=0, full_once=False):
        self.sent, self.fail_keys, self.unsent, self.full_once = [], fail_keys, unsent, full_once
        self.polled = []

    def produce(self, topic, key, value, headers, on_delivery):
        if self.full_once:
            self.full_once = False
            raise BufferError('queue full')
        self.sent.append((topic, key, json.loads(value), headers))
        error = 'broker said no' if key in self.fail_keys else None
        on_delivery(error, type('Delivered', (), {'topic': lambda self: topic, 'key': lambda self: key})())

    def poll(self, timeout):
        self.polled.append(timeout)

    def flush(self, timeout):
        return self.unsent


class TestPublish:

    def test_sends_every_message_and_marks_only_order_events_as_replayed(self, snapshot):
        messages = build_messages(snapshot)
        producer = FakeProducer()

        assert publish(messages, 'unused:9092', producer=producer) == len(messages)

        headers = {topic: {str(sent_headers) for sent_topic, _key, _body, sent_headers in producer.sent
                           if sent_topic == topic} for topic in (TRADE_EVENTS, PLATFORM_RECORDS)}
        assert headers == {TRADE_EVENTS: {"[('replay', b'true')]"}, PLATFORM_RECORDS: {'None'}}
        assert [body for _topic, _key, body, _headers in producer.sent] == [message.body for message in messages]

    def test_publishes_to_the_names_a_deployment_gave_the_topics(self, snapshot):
        producer = FakeProducer()

        publish(build_messages(snapshot), 'unused:9092', producer=producer,
                topics={TRADE_EVENTS: 'staging.orders', PLATFORM_RECORDS: 'staging.records'})

        assert {topic for topic, _key, _body, _headers in producer.sent} == {'staging.orders', 'staging.records'}
        replayed = {topic for topic, _key, _body, headers in producer.sent if headers}
        assert replayed == {'staging.orders'}, 'the replay header still marks the order events only'

    def test_waits_out_a_full_local_queue(self, snapshot):
        producer = FakeProducer(full_once=True)

        publish(build_messages(snapshot)[:1], 'unused:9092', producer=producer)

        assert len(producer.sent) == 1
        assert 1 in producer.polled

    def test_a_message_the_broker_refused_is_an_error(self, snapshot):
        with pytest.raises(RuntimeError, match='TRADING_ACCOUNT:2.*broker said no'):
            publish(build_messages(snapshot), 'unused:9092', producer=FakeProducer(fail_keys=('TRADING_ACCOUNT:2',)))

    def test_messages_still_unsent_at_the_timeout_are_an_error(self, snapshot):
        with pytest.raises(RuntimeError, match='3 message.s. still unsent after 5s'):
            publish(build_messages(snapshot), 'unused:9092', producer=FakeProducer(unsent=3), timeout=5)


class FakeConnection:
    """Answers each query of the snapshot from a prepared dict, like a psycopg connection would."""

    def __init__(self, snapshot):
        self.snapshot, self.executed, self.rolled_back = snapshot, [], False
        self.read_only = self.isolation_level = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self, row_factory=None):
        return self

    def execute(self, query):
        self.executed.append(query)

    def fetchall(self):
        name = next(name for name, query in reporting_feed.QUERIES.items() if query == self.executed[-1])
        return self.snapshot[name]

    def rollback(self):
        self.rolled_back = True


class TestCommandLine:

    def test_reads_one_read_only_snapshot_and_publishes_it(self, snapshot):
        pytest.importorskip('psycopg')
        connection = FakeConnection(snapshot)
        published, lines = [], []

        code = republish_history.main(
            ['--database-url', 'postgresql://ignored', '--bootstrap-servers', 'broker:9092'],
            connect=lambda url: connection,
            publish=lambda messages, servers, topics: published.append((len(messages), servers, topics))
            or len(messages),
            out=lines.append)

        assert code == 0
        assert connection.read_only is True and connection.rolled_back is True
        assert len(connection.executed) == len(reporting_feed.QUERIES)
        assert published == [(16, 'broker:9092', {'trade-events': 'trade-events',
                                                  'platform-records': 'platform-records'})]
        assert '      3  trade-events' in lines
        assert '      2  CASH_TRANSFER' in lines
        assert lines[-1] == 'Published 16 message(s) to broker:9092.'

    def test_a_dry_run_builds_the_messages_and_publishes_nothing(self, snapshot):
        pytest.importorskip('psycopg')
        published, lines = [], []

        republish_history.main(['--database-url', 'postgresql://ignored', '--dry-run'],
                               connect=lambda url: FakeConnection(snapshot),
                               publish=lambda *args: published.append(args), out=lines.append)

        assert published == []
        assert lines[-1] == 'Dry run: 16 message(s) built, none published.'

    def test_the_database_url_is_required(self, monkeypatch, capsys):
        monkeypatch.delenv('DATABASE_URL', raising=False)

        with pytest.raises(SystemExit):
            republish_history.parse_arguments([])

        assert '--database-url or DATABASE_URL is required' in capsys.readouterr().err
