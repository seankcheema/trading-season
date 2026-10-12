"""
The reporting consumer process: consumer group reporting-ingester.

Runs as its own container (python consumer.py) beside the gunicorn web
service. It polls trade-events and platform-records, appends each message to
that topic's event store, commits the offset only after the line is on disk,
and runs the report job on a schedule. Exactly one instance may run at a
time: two processes must never append to the same partition file.

These two topics are everything the reporting service knows. Neither this
process nor the web service connects to the trading database.
"""

import json
import logging
import signal
import threading
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from event_store import PLATFORM_RECORDS, TRADE_EVENTS, EventStore

logger = logging.getLogger(__name__)


class KafkaSource:
    """Thin wrapper over confluent_kafka.Consumer so the loop can be tested with a fake."""

    def __init__(self, bootstrap_servers, group_id, topics, on_assign=None):
        from confluent_kafka import Consumer  # imported here so tests need no broker library

        topics = [topics] if isinstance(topics, str) else list(topics)
        self._consumer = Consumer({
            'bootstrap.servers': bootstrap_servers,
            'group.id': group_id,
            'enable.auto.commit': False,
            'auto.offset.reset': 'earliest',
        })
        self._consumer.subscribe(topics, on_assign=lambda consumer, partitions: on_assign() if on_assign else None)
        logger.info('Subscribed to %s as group %s via %s', ', '.join(topics), group_id, bootstrap_servers)

    def poll(self, timeout):
        return self._consumer.poll(timeout)

    def commit(self, message):
        self._consumer.commit(message=message, asynchronous=False)

    def close(self):
        self._consumer.close()


class TopicStores:
    """
    The event store of each consumed topic, so a message lands in its own
    topic's files. stores maps the name the broker knows a topic by to the
    store of what it carries.
    """

    def __init__(self, stores):
        self._stores = dict(stores)

    def refresh(self):
        for store in self._stores.values():
            store.refresh()

    def append(self, message, key, body):
        """Append to the store of the message's topic. A topic nobody stores is not written."""
        store = self._stores.get(message.topic())
        if store is None:
            logger.warning('Skipping message from unexpected topic %s', message.topic())
            return False
        return store.append(message.partition(), message.offset(), key, body)


def handle_message(message, store):
    """
    Append one message to the store. Returns True when a line was written,
    False when it was a duplicate or unreadable. Both outcomes commit. store
    is one topic's EventStore, or the TopicStores of every consumed topic.
    """
    key = message.key()
    value = message.value()
    key = key.decode('utf-8') if isinstance(key, bytes) else key
    value = value.decode('utf-8') if isinstance(value, bytes) else value
    try:
        body = json.loads(value) if value else None
    except json.JSONDecodeError:
        body = None
    if not isinstance(body, dict):
        logger.warning('Skipping unreadable message partition=%s offset=%s',
                       message.partition(), message.offset())
        return False
    if isinstance(store, TopicStores):
        written = store.append(message, key, body)
    else:
        written = store.append(message.partition(), message.offset(), key, body)
    if written and body.get('type') is not None:
        logger.info('Stored platform record type=%s key=%s partition=%s offset=%s',
                    body.get('type'), key, message.partition(), message.offset())
    elif written:
        logger.info('Stored trade event orderId=%s status=%s key=%s partition=%s offset=%s',
                    body.get('orderId'), body.get('status'), key, message.partition(), message.offset())
    return written


def run_consumer_loop(source, store, stop_event, poll_timeout=1.0):
    """
    Poll until stop_event is set. Every message is handled then committed
    synchronously, so nothing is pending to commit on shutdown.
    """
    stats = {'written': 0, 'skipped': 0, 'errors': 0}
    try:
        while not stop_event.is_set():
            message = source.poll(poll_timeout)
            if message is None:
                continue
            if message.error():
                stats['errors'] += 1
                logger.error('Kafka error: %s', message.error())
                continue
            if handle_message(message, store):
                stats['written'] += 1
            else:
                stats['skipped'] += 1
            source.commit(message)
    finally:
        source.close()
        logger.info('Consumer stopped: %s', stats)
    return stats


def start_scheduler(app, files_dir, interval_minutes, first_run_at=None):
    """
    Run the report job on an interval inside the Flask app context. The first
    run is one interval away unless first_run_at names an earlier time.

    The job brings this process's read model up to date first: a run takes
    its trade data from the event files and the names and trader levels it
    labels them with from the read model built out of those same files.
    """
    from models import db
    from read_model import read_model
    from report_run import run_report

    def job():
        with app.app_context(), read_model.lock:
            try:
                read_model.sync(db.session, files_dir)
                run_report(files_dir, db.session)
            except Exception:  # noqa: BLE001 - the job must never kill the scheduler
                logger.exception('Report run failed')
            finally:
                db.session.remove()

    # Passed only when set: APScheduler reads next_run_time=None as a paused job.
    first_run = {'next_run_time': first_run_at} if first_run_at is not None else {}
    # No misfire grace limit: a run that comes due while the process is busy,
    # as the first one does during start-up, still runs instead of being dropped.
    scheduler = BackgroundScheduler()
    scheduler.add_job(job, trigger='interval', minutes=interval_minutes, id='report_run',
                      coalesce=True, max_instances=1, misfire_grace_time=None, **first_run)
    scheduler.start()
    logger.info('Report run scheduled every %s minutes', interval_minutes)
    return scheduler


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
    from app import app

    config = app.config
    files_dir = config['REPORTING_FILES_DIR']
    events_dir = f'{files_dir}/events'
    stores = TopicStores({
        config['KAFKA_TRADE_EVENTS_TOPIC']: EventStore(events_dir, TRADE_EVENTS),
        config['KAFKA_PLATFORM_RECORDS_TOPIC']: EventStore(events_dir, PLATFORM_RECORDS),
    })
    topics = list(stores._stores)

    stop = threading.Event()
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda *_: stop.set())

    # The first run is due at once, so a restarted consumer serves a report of
    # the events already on disk instead of nothing for a whole interval.
    scheduler = None
    if config['SCHEDULER_ENABLED']:
        scheduler = start_scheduler(app, files_dir, config['SCHEDULER_INTERVAL_MINUTES'],
                                    first_run_at=datetime.now(timezone.utc))

    source = KafkaSource(config['KAFKA_BOOTSTRAP_SERVERS'], config['REPORTING_CONSUMER_GROUP'],
                         topics, on_assign=stores.refresh)
    try:
        run_consumer_loop(source, stores, stop)
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=True)


if __name__ == '__main__':  # pragma: no cover - the container entry point
    main()
