"""The consumer loop, driven by a fake Kafka source."""

import json
import sys
import threading
import types
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import consumer
from consumer import KafkaSource, TopicStores, handle_message, main, run_consumer_loop, start_scheduler
from event_store import PLATFORM_RECORDS, TRADE_EVENTS, EventStore

BODY = {'orderId': 7, 'status': 'FILLED', 'symbol': 'TEST', 'side': 'BUY',
        'quantity': 100, 'price': 50.0, 'rejectionReason': None, 'occurredAt': '2026-10-06T09:30:00Z'}


class FakeMessage:
    """Looks like a confluent_kafka.Message for the parts the loop uses."""

    def __init__(self, partition, offset, key, value, error=None, topic=TRADE_EVENTS):
        self._partition, self._offset, self._key, self._value, self._error = partition, offset, key, value, error
        self._topic = topic

    def error(self):
        return self._error

    def topic(self):
        return self._topic

    def partition(self):
        return self._partition

    def offset(self):
        return self._offset

    def key(self):
        return self._key

    def value(self):
        return self._value


class FakeSource:
    """Hands out scripted messages, then asks the loop to stop."""

    def __init__(self, messages, stop_event):
        self.messages = list(messages)
        self.stop_event = stop_event
        self.committed = []
        self.closed = False

    def poll(self, timeout):
        if not self.messages:
            self.stop_event.set()
            return None
        return self.messages.pop(0)

    def commit(self, message):
        self.committed.append((message.partition(), message.offset()))

    def close(self):
        self.closed = True


def message(partition, offset, key='42', body=BODY):
    return FakeMessage(partition, offset, key.encode() if key is not None else None,
                       json.dumps(body).encode())


class TestHandleMessage:

    def test_appends_a_readable_message(self, tmp_path):
        store = EventStore(tmp_path)

        assert handle_message(message(0, 0), store) is True
        assert store.last_offset(0) == 0

    def test_skips_a_body_that_is_not_json(self, tmp_path):
        store = EventStore(tmp_path)

        assert handle_message(FakeMessage(0, 0, b'42', b'not json'), store) is False
        assert handle_message(FakeMessage(0, 1, b'42', None), store) is False
        assert store.last_offset(0) is None


class TestTopicStores:
    """One consumer reads both topics; each message goes to its own topic's files."""

    RECORD = {'type': 'CASH_TRANSFER', 'cashTransactionId': 31, 'accountId': 7, 'amount': -25.0,
              'reason': 'WITHDRAWAL', 'createdAt': '2026-10-06T09:30:00Z'}

    def stores(self, tmp_path):
        return TopicStores({TRADE_EVENTS: EventStore(tmp_path, TRADE_EVENTS),
                            PLATFORM_RECORDS: EventStore(tmp_path, PLATFORM_RECORDS)})

    def test_a_topic_the_broker_knows_by_another_name_still_fills_the_same_files(self, tmp_path):
        stores = TopicStores({'staging.orders': EventStore(tmp_path, TRADE_EVENTS),
                              'staging.records': EventStore(tmp_path, PLATFORM_RECORDS)})
        record = FakeMessage(0, 0, b'CASH_TRANSFER:31', json.dumps(self.RECORD).encode(), topic='staging.records')
        trade = FakeMessage(0, 0, b'42', json.dumps(BODY).encode(), topic='staging.orders')

        assert handle_message(trade, stores) is True
        assert handle_message(record, stores) is True

        assert sorted(path.name for path in tmp_path.iterdir()) == ['platform-records-p0.jsonl',
                                                                    'trade-events-p0.jsonl']

    def test_routes_each_message_to_the_files_of_its_topic(self, tmp_path):
        stores = self.stores(tmp_path)
        record = FakeMessage(0, 0, b'CASH_TRANSFER:31', json.dumps(self.RECORD).encode(), topic=PLATFORM_RECORDS)

        assert handle_message(message(0, 0), stores) is True
        assert handle_message(record, stores) is True

        trade = json.loads((tmp_path / 'trade-events-p0.jsonl').read_text(encoding='utf-8'))
        assert (trade['accountId'], trade['orderId']) == (42, 7)
        stored = json.loads((tmp_path / 'platform-records-p0.jsonl').read_text(encoding='utf-8'))
        assert stored['key'] == 'CASH_TRANSFER:31'
        assert stored['type'] == 'CASH_TRANSFER'
        assert stored['cashTransactionId'] == 31

    def test_the_same_offset_on_two_topics_is_two_messages(self, tmp_path):
        stores = self.stores(tmp_path)
        record = FakeMessage(0, 0, b'CASH_TRANSFER:31', json.dumps(self.RECORD).encode(), topic=PLATFORM_RECORDS)

        assert handle_message(message(0, 0), stores) is True
        assert handle_message(record, stores) is True
        assert handle_message(record, stores) is False, 'redelivered'

    def test_a_message_from_a_topic_nobody_stores_is_skipped(self, tmp_path):
        stores = self.stores(tmp_path)
        stray = FakeMessage(0, 0, b'1', json.dumps(BODY).encode(), topic='some-other-topic')

        assert handle_message(stray, stores) is False
        assert list(tmp_path.iterdir()) == []

    def test_refresh_re_reads_every_topic(self, tmp_path):
        stores = self.stores(tmp_path)
        other = EventStore(tmp_path, PLATFORM_RECORDS)
        other.append(1, 4, 'SIGN_IN:a', {'type': 'SIGN_IN'})

        stores.refresh()

        again = FakeMessage(1, 4, b'SIGN_IN:a', b'{"type":"SIGN_IN"}', topic=PLATFORM_RECORDS)
        assert handle_message(again, stores) is False, 'the offset another writer left is seen after a refresh'


class TestConsumerLoop:

    def test_stores_commits_and_closes(self, tmp_path):
        stop = threading.Event()
        store = EventStore(tmp_path)
        source = FakeSource([
            None,                                            # a quiet poll
            message(0, 0),
            FakeMessage(0, 0, None, None, error='broker went away'),  # a transport error
            message(0, 1, body={**BODY, 'orderId': 8}),
            message(0, 1, body={**BODY, 'orderId': 8}),      # redelivered after a crash
            FakeMessage(1, 0, b'43', b'garbage'),            # a poison message
            message(2, 0, key='44'),
        ], stop)

        stats = run_consumer_loop(source, store, stop, poll_timeout=0)

        assert stats == {'written': 3, 'skipped': 2, 'errors': 1}
        # Every handled message is committed, including the duplicate and the poison one,
        # so neither is redelivered forever. The error carried no offset to commit.
        assert source.committed == [(0, 0), (0, 1), (0, 1), (1, 0), (2, 0)]
        assert source.closed is True
        assert [event['orderId'] for event in store.iter_events()] == [7, 8, 7]

    def test_closes_the_source_even_when_the_store_fails(self, tmp_path):
        stop = threading.Event()
        source = FakeSource([message(0, 0)], stop)

        class BrokenStore:
            def append(self, *args):
                raise OSError('disk full')

        try:
            run_consumer_loop(source, BrokenStore(), stop, poll_timeout=0)
        except OSError:
            pass
        else:  # pragma: no cover - the loop must not swallow a disk error
            raise AssertionError('expected the disk error to propagate')

        assert source.closed is True
        assert source.committed == [], 'nothing is committed for a message that was not stored'


class TestScheduler:

    def test_schedules_the_report_job(self, app, tmp_path):
        scheduler = start_scheduler(app, str(tmp_path), interval_minutes=60)
        try:
            job = scheduler.get_job('report_run')
            assert job is not None
            assert job.trigger.interval.total_seconds() == 3600
            first_run_in = job.next_run_time - datetime.now(timezone.utc)
            assert timedelta(minutes=59) < first_run_in <= timedelta(minutes=60)
        finally:
            scheduler.shutdown(wait=False)

    def test_the_first_run_can_be_due_before_a_whole_interval(self, app, tmp_path):
        first_run_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        scheduler = start_scheduler(app, str(tmp_path), interval_minutes=60, first_run_at=first_run_at)
        try:
            assert scheduler.get_job('report_run').next_run_time == first_run_at
        finally:
            scheduler.shutdown(wait=False)

    def test_a_run_that_comes_due_late_still_runs(self, app, tmp_path, mocker):
        ran = threading.Event()
        mocker.patch('report_run.run_report', side_effect=lambda *args: ran.set())
        mocker.patch('read_model.read_model.sync')
        mocker.patch('models.db.session.remove')
        overdue = datetime.now(timezone.utc) - timedelta(minutes=5)
        scheduler = start_scheduler(app, str(tmp_path), interval_minutes=60, first_run_at=overdue)
        try:
            assert ran.wait(5), 'a first run already overdue at start-up is not dropped as a misfire'
        finally:
            scheduler.shutdown(wait=True)

    def test_the_job_runs_a_report_inside_the_app_context(self, app, tmp_path, mocker):
        calls = []
        sync = mocker.patch('read_model.read_model.sync', side_effect=lambda *args: calls.append('sync'))
        run_report = mocker.patch('report_run.run_report', side_effect=lambda *args: calls.append('report'))
        remove = mocker.patch('models.db.session.remove')
        scheduler = start_scheduler(app, str(tmp_path), interval_minutes=60)
        try:
            scheduler.get_job('report_run').func()
        finally:
            scheduler.shutdown(wait=False)

        run_report.assert_called_once()
        assert run_report.call_args.args[0] == str(tmp_path)
        assert sync.call_args.args[1] == str(tmp_path)
        assert calls == ['sync', 'report'], 'the names a run uses come from a read model brought up to date first'
        assert remove.called

    def test_a_failed_report_is_logged_and_does_not_escape(self, app, tmp_path, mocker, caplog):
        mocker.patch('report_run.run_report', side_effect=RuntimeError('disk away'))
        mocker.patch('read_model.read_model.sync')
        remove = mocker.patch('models.db.session.remove')
        scheduler = start_scheduler(app, str(tmp_path), interval_minutes=60)
        try:
            with caplog.at_level('ERROR', logger='consumer'):
                scheduler.get_job('report_run').func()
        finally:
            scheduler.shutdown(wait=False)

        assert 'Report run failed' in caplog.text
        assert remove.called, 'the session is released even when the run fails'


def fake_confluent_kafka(mocker):
    """
    Stand in for the confluent_kafka package. The real one loads a native
    library, which is neither needed nor always loadable on a test machine.
    """
    module = types.ModuleType('confluent_kafka')
    module.Consumer = MagicMock(name='Consumer')
    mocker.patch.dict(sys.modules, {'confluent_kafka': module})
    return module.Consumer


class TestKafkaSource:
    """The wrapper over confluent_kafka.Consumer, with the client replaced by a fake."""

    def test_subscribes_with_manual_commits_from_the_earliest_offset(self, mocker):
        consumer_cls = fake_confluent_kafka(mocker)
        assigned = []

        KafkaSource('kafka:9092', 'reporting-ingester', 'trade-events', on_assign=lambda: assigned.append(True))

        config = consumer_cls.call_args.args[0]
        assert config['bootstrap.servers'] == 'kafka:9092'
        assert config['group.id'] == 'reporting-ingester'
        assert config['enable.auto.commit'] is False, 'offsets are committed only after the line is on disk'
        assert config['auto.offset.reset'] == 'earliest'
        subscribe = consumer_cls.return_value.subscribe
        assert subscribe.call_args.args[0] == ['trade-events']
        # The assignment callback lets the store re-read the partition files it now owns.
        subscribe.call_args.kwargs['on_assign'](consumer_cls.return_value, [])
        assert assigned == [True]

    def test_one_group_subscribes_to_every_topic_it_is_given(self, mocker):
        consumer_cls = fake_confluent_kafka(mocker)

        KafkaSource('kafka:9092', 'reporting-ingester', ['trade-events', 'platform-records'])

        assert consumer_cls.return_value.subscribe.call_args.args[0] == ['trade-events', 'platform-records']

    def test_without_an_assign_callback(self, mocker):
        consumer_cls = fake_confluent_kafka(mocker)

        KafkaSource('kafka:9092', 'reporting-ingester', 'trade-events')

        on_assign = consumer_cls.return_value.subscribe.call_args.kwargs['on_assign']
        assert on_assign(consumer_cls.return_value, []) is None

    def test_delegates_poll_commit_and_close(self, mocker):
        client = fake_confluent_kafka(mocker).return_value
        client.poll.return_value = 'a message'
        source = KafkaSource('kafka:9092', 'reporting-ingester', 'trade-events')

        assert source.poll(1.5) == 'a message'
        source.commit('the message')
        source.close()

        client.poll.assert_called_once_with(1.5)
        client.commit.assert_called_once_with(message='the message', asynchronous=False)
        client.close.assert_called_once()


class TestMain:
    """The process entry point, with the client, loop and signals stubbed."""

    def test_wires_the_store_scheduler_and_source_from_the_app_config(self, app, files_dir, mocker):
        mocker.patch.dict(app.config, {
            'SCHEDULER_ENABLED': True, 'SCHEDULER_INTERVAL_MINUTES': 5, 'KAFKA_BOOTSTRAP_SERVERS': 'kafka:9092',
            'REPORTING_CONSUMER_GROUP': 'reporting-ingester', 'KAFKA_TRADE_EVENTS_TOPIC': 'trade-events',
            'KAFKA_PLATFORM_RECORDS_TOPIC': 'platform-records'})
        signal = mocker.patch('consumer.signal.signal')
        source_cls = mocker.patch('consumer.KafkaSource')
        loop = mocker.patch('consumer.run_consumer_loop')
        start_scheduler = mocker.patch('consumer.start_scheduler')
        scheduler = start_scheduler.return_value

        main()

        assert start_scheduler.call_args.args[1:] == (str(files_dir), 5)
        first_run_in = start_scheduler.call_args.kwargs['first_run_at'] - datetime.now(timezone.utc)
        assert abs(first_run_in) < timedelta(seconds=30), 'the first report run is due as the consumer starts'
        assert signal.call_count == 2, 'SIGTERM and SIGINT both ask the loop to stop'
        source_cls.assert_called_once()
        assert source_cls.call_args.args == ('kafka:9092', 'reporting-ingester',
                                             ['trade-events', 'platform-records'])
        stores = loop.call_args.args[1]
        assert source_cls.call_args.kwargs['on_assign'] == stores.refresh
        assert isinstance(stores, TopicStores)
        assert {name: store.topic for name, store in stores._stores.items()} == {
            'trade-events': 'trade-events', 'platform-records': 'platform-records'}
        assert all(store.events_dir == files_dir / 'events' for store in stores._stores.values())
        loop.assert_called_once_with(source_cls.return_value, stores, loop.call_args.args[2])
        scheduler.shutdown.assert_called_once_with(wait=True)

    def test_signal_handler_stops_the_loop(self, app, files_dir, mocker):
        mocker.patch.dict(app.config, {'SCHEDULER_ENABLED': False})
        handlers = {}
        mocker.patch('consumer.signal.signal', side_effect=lambda signum, handler: handlers.__setitem__(signum, handler))
        mocker.patch('consumer.KafkaSource')
        loop = mocker.patch('consumer.run_consumer_loop')
        start_scheduler = mocker.patch('consumer.start_scheduler')

        main()

        start_scheduler.assert_not_called()
        stop = loop.call_args.args[2]
        assert not stop.is_set()
        handlers[consumer.signal.SIGTERM]()
        assert stop.is_set()

    def test_the_scheduler_is_shut_down_when_the_loop_fails(self, app, files_dir, mocker):
        mocker.patch.dict(app.config, {'SCHEDULER_ENABLED': True})
        mocker.patch('consumer.signal.signal')
        mocker.patch('consumer.KafkaSource')
        mocker.patch('consumer.run_consumer_loop', side_effect=OSError('disk full'))
        scheduler = mocker.patch('consumer.start_scheduler').return_value

        try:
            main()
        except OSError:
            pass
        else:  # pragma: no cover - the failure must propagate so the container exits
            raise AssertionError('expected the disk error to propagate')

        scheduler.shutdown.assert_called_once_with(wait=True)
