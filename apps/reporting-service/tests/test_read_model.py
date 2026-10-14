"""The read model: built from the consumer's files, and nothing else."""

import json
import uuid
from decimal import Decimal

import pytest

from event_store import PLATFORM_RECORDS, TRADE_EVENTS, EventStore
from models import Account, Fill, Order, User, UserAccount
from read_model import ReadModel
from tests.messages import SEAN, account, filled, order_event, profile, sign_in, transfer

SEAN_ID = uuid.UUID(SEAN)


class Topics:
    """Writes messages the way the consumer does, with the next offset of each partition."""

    def __init__(self, files_dir):
        self.events_dir = files_dir / 'events'
        self.records = EventStore(self.events_dir, PLATFORM_RECORDS)
        self.trades = EventStore(self.events_dir, TRADE_EVENTS)

    def _next(self, store, partition):
        last = store.last_offset(partition)
        return 0 if last is None else last + 1

    def record(self, body, partition=0):
        key = f"{body.get('type')}:{body.get('userId') or body.get('accountId') or ''}"
        self.records.append(partition, self._next(self.records, partition), key, body)

    def trade(self, event, partition=0):
        body = {key: value for key, value in event.items() if key != 'accountId'}
        self.trades.append(partition, self._next(self.trades, partition), str(event['accountId']), body)

    def customer(self):
        self.record(sign_in())
        self.record(profile())
        self.record(account())


@pytest.fixture
def topics(files_dir):
    return Topics(files_dir)


@pytest.fixture
def model():
    return ReadModel()


class TestSync:

    def test_builds_the_tables_from_both_topics_files(self, db_session, files_dir, topics, model):
        topics.customer()
        topics.trade(order_event(7, 'ACCEPTED', accepted_at='2026-10-05T09:30:00Z'))
        topics.trade(filled(7, fill_id=4, cash_id=11, movement_id=5))

        assert model.sync(db_session, files_dir) == 5

        assert db_session.get(UserAccount, SEAN_ID).email == 'sean@example.com'
        assert db_session.get(Order, 7).status == 'FILLED'
        assert db_session.get(User, SEAN_ID).available_funds == Decimal('9000')

    def test_a_second_sync_reads_only_what_was_appended_since(self, db_session, files_dir, topics, model):
        topics.customer()
        assert model.sync(db_session, files_dir) == 3
        assert model.sync(db_session, files_dir) == 0

        topics.trade(order_event(7, 'ACCEPTED'))

        assert model.sync(db_session, files_dir) == 1
        assert db_session.get(Order, 7) is not None

    def test_with_no_files_at_all_the_tables_are_simply_empty(self, db_session, files_dir, model):
        assert model.sync(db_session, files_dir) == 0
        assert db_session.query(Order).count() == 0

    def test_records_are_applied_before_order_events_whatever_the_file_names(self, db_session, files_dir, topics,
                                                                              model):
        # The fill and the profile both carry a balance; the fill is later and must win on a cold start.
        topics.trade(filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00))
        topics.customer()

        model.sync(db_session, files_dir)

        assert db_session.get(User, SEAN_ID).available_funds == Decimal('9000')

    def test_an_order_whose_account_is_published_later_appears_when_it_is(self, db_session, files_dir, topics,
                                                                           model):
        import console

        topics.trade(order_event(7, 'ACCEPTED'))
        model.sync(db_session, files_dir)
        assert console.orders(db_session)['orders'] == []

        topics.customer()
        model.sync(db_session, files_dir)

        assert [row['orderId'] for row in console.orders(db_session)['orders']] == [7]

    def test_money_is_read_exactly_not_through_a_float(self, db_session, files_dir, topics, model):
        topics.customer()
        topics.trade(filled(7, fill_id=4, cash_id=11, movement_id=5, price=187.123456, quantity=3,
                            cash_amount=-561.37, funds=9438.63))

        model.sync(db_session, files_dir)

        assert db_session.get(Fill, 4).quote_price == Decimal('187.123456')
        assert db_session.get(User, SEAN_ID).available_funds == Decimal('9438.63')

    def test_every_partition_file_is_read(self, db_session, files_dir, topics, model):
        topics.customer()
        topics.record(account(2, name='Second'), partition=2)
        topics.trade(order_event(7, 'ACCEPTED'), partition=0)
        topics.trade(order_event(8, 'ACCEPTED', account_id=2), partition=1)

        model.sync(db_session, files_dir)

        assert sorted(row.account_id for row in db_session.query(Account)) == [1, 2]
        assert sorted(row.order_id for row in db_session.query(Order)) == [7, 8]


class TestHalfWrittenAndBrokenLines:

    def test_a_line_still_being_written_waits_for_its_newline(self, db_session, files_dir, topics, model):
        topics.customer()
        line = json.dumps({'partition': 0, 'offset': 3, 'key': 'TRADING_ACCOUNT:2', **account(2, name='Second')})
        path = topics.records.path_for(0)
        with open(path, 'a', encoding='utf-8') as handle:
            handle.write(line[:40])

        model.sync(db_session, files_dir)
        assert db_session.query(Account).count() == 1

        with open(path, 'a', encoding='utf-8') as handle:
            handle.write(line[40:] + '\n')
        model.sync(db_session, files_dir)

        assert db_session.query(Account).count() == 2

    def test_an_unreadable_line_is_skipped_and_the_rest_still_applied(self, db_session, files_dir, topics, model,
                                                                      caplog):
        topics.record(sign_in())
        with open(topics.records.path_for(0), 'a', encoding='utf-8') as handle:
            handle.write('{"partition":0,"offset":1,"type":"CUSTOMER_PRO\n')
            handle.write('["not", "a", "message"]\n')
            handle.write('\n')
        topics.record(account())

        with caplog.at_level('WARNING', logger='read_model'):
            assert model.sync(db_session, files_dir) == 2

        assert db_session.query(Account).count() == 1
        assert 'Skipping unreadable line' in caplog.text
        assert 'Skipping malformed line' in caplog.text

    def test_a_message_that_cannot_be_used_is_skipped_once_and_named(self, db_session, files_dir, topics, model,
                                                                     caplog):
        topics.record(profile(first=None))
        topics.record(account())

        with caplog.at_level('WARNING', logger='read_model'):
            assert model.sync(db_session, files_dir) == 1
            assert model.sync(db_session, files_dir) == 0, 'it is not retried on every request'

        assert db_session.query(User).count() == 0
        assert 'partition=0 offset=0: firstName is missing' in caplog.text

    def test_a_message_of_an_unknown_kind_is_not_counted(self, db_session, files_dir, topics, model):
        topics.record({'type': 'SOMETHING_NEW', 'id': 1})

        assert model.sync(db_session, files_dir) == 0


class TestRebuild:
    """The files are the source: when they are replaced, so is everything built from them."""

    def test_a_replaced_file_rebuilds_the_tables_from_what_is_on_disk(self, db_session, files_dir, topics, model):
        topics.customer()
        topics.record(account(2, name='Second'))
        model.sync(db_session, files_dir)
        assert db_session.query(Account).count() == 2

        # The operator wiped the files and the consumer started over from the topic.
        for path in topics.events_dir.iterdir():
            path.unlink()
        fresh = Topics(files_dir)
        fresh.record(sign_in())
        model.sync(db_session, files_dir)

        assert db_session.query(Account).count() == 0
        assert db_session.query(UserAccount).count() == 1

    def test_a_removed_file_rebuilds_too(self, db_session, files_dir, topics, model):
        topics.customer()
        topics.trade(order_event(7, 'ACCEPTED'))
        model.sync(db_session, files_dir)

        topics.trades.path_for(0).unlink()
        model.sync(db_session, files_dir)

        assert db_session.query(Order).count() == 0
        assert db_session.query(Account).count() == 1, 'what is still on disk is applied again'

    def test_files_of_another_directory_do_not_trigger_a_rebuild(self, db_session, files_dir, tmp_path_factory,
                                                                 topics, model):
        elsewhere = tmp_path_factory.mktemp('other-files')
        Topics(elsewhere).customer()
        model.sync(db_session, elsewhere)

        topics.record(account(2, name='Second'))
        model.sync(db_session, files_dir)

        assert db_session.query(Account).count() == 2


class TestThroughTheApi:
    """Files in, HTTP out: the whole path the service runs in production, without a database."""

    def test_the_console_serves_what_the_topics_delivered(self, client, db_session, files_dir, topics,
                                                          authenticated_admin):
        topics.customer()
        topics.record(transfer(10, amount=2500.00, funds=10000.00, created_at='2026-10-04T08:00:00Z'))
        topics.trade(order_event(7, 'ACCEPTED', accepted_at='2026-10-05T09:30:00Z'))
        topics.trade(filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00))

        customers = client.get('/api/reporting/customers', headers=authenticated_admin).get_json()['customers']
        orders = client.get('/api/reporting/orders', headers=authenticated_admin).get_json()
        detail = client.get('/api/reporting/orders/7', headers=authenticated_admin).get_json()

        assert [(row['email'], row['name'], row['cash']) for row in customers] == [
            ('sean@example.com', 'Sean Cheema', 9000.0)]
        assert [(row['orderId'], row['status'], row['symbol']) for row in orders['orders']] == [(7, 'FILLED', 'AAPL')]
        assert [row['kind'] for row in orders['transfers']] == ['DEPOSIT']
        assert detail['ledger']['cashAfter'] == 9000.0

    def test_a_message_that_arrives_between_two_requests_is_in_the_second(self, client, db_session, files_dir,
                                                                           topics, authenticated_admin):
        topics.customer()
        before = client.get('/api/reporting/orders', headers=authenticated_admin).get_json()

        topics.trade(order_event(7, 'ACCEPTED'))
        after = client.get('/api/reporting/orders', headers=authenticated_admin).get_json()

        assert (before['total'], after['total']) == (0, 1)

    def test_the_callers_profile_comes_from_their_profile_record(self, client, db_session, files_dir, topics,
                                                                  mocker):
        topics.customer()
        mocker.patch('app.verify_token', return_value={'sub': SEAN, 'roles': ['TRADER']})

        response = client.get('/api/reporting/profile', headers={'Authorization': 'Bearer token'})

        assert response.status_code == 200
        assert response.get_json()['first_name'] == 'Sean'
        assert response.get_json()['available_funds'] == 10000.0

    def test_health_reports_the_read_model(self, client, db_session, files_dir, topics):
        topics.customer()

        assert client.get('/health').get_json()['status'] == 'healthy'
        assert db_session.query(UserAccount).count() == 1, 'the check brought the read model up to date'

    def test_health_is_unhealthy_when_the_files_cannot_be_read(self, client, db_session, files_dir, mocker):
        mocker.patch('read_model.read_model.sync', side_effect=OSError('volume not mounted'))

        response = client.get('/health')

        assert response.status_code == 503
        assert response.get_json()['status'] == 'unhealthy'
        assert 'volume not mounted' in response.get_json()['error']
