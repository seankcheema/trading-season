"""The consumer loop, driven by a fake Kafka source."""

import json
import threading

from consumer import handle_message, run_consumer_loop, start_scheduler
from event_store import EventStore

BODY = {'orderId': 7, 'status': 'FILLED', 'symbol': 'TEST', 'side': 'BUY',
        'quantity': 100, 'price': 50.0, 'rejectionReason': None, 'occurredAt': '2026-10-06T09:30:00Z'}


class FakeMessage:
    """Looks like a confluent_kafka.Message for the parts the loop uses."""

    def __init__(self, partition, offset, key, value, error=None):
        self._partition, self._offset, self._key, self._value, self._error = partition, offset, key, value, error

    def error(self):
        return self._error

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
        finally:
            scheduler.shutdown(wait=False)
