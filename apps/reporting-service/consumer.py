"""
The reporting consumer process: consumer group reporting-ingester.

Runs as its own container (python consumer.py) beside the gunicorn web
service. It polls trade-events, appends each message to the event store,
commits the offset only after the line is on disk, and runs the report job
on a schedule. Exactly one instance may run at a time: two processes must
never append to the same partition file.
"""

import json
import logging
import signal
import threading

from apscheduler.schedulers.background import BackgroundScheduler

from event_store import EventStore

logger = logging.getLogger(__name__)


class KafkaSource:
    """Thin wrapper over confluent_kafka.Consumer so the loop can be tested with a fake."""

    def __init__(self, bootstrap_servers, group_id, topic, on_assign=None):
        from confluent_kafka import Consumer  # imported here so tests need no broker library

        self._consumer = Consumer({
            'bootstrap.servers': bootstrap_servers,
            'group.id': group_id,
            'enable.auto.commit': False,
            'auto.offset.reset': 'earliest',
        })
        self._consumer.subscribe([topic], on_assign=lambda consumer, partitions: on_assign() if on_assign else None)
        logger.info('Subscribed to %s as group %s via %s', topic, group_id, bootstrap_servers)

    def poll(self, timeout):
        return self._consumer.poll(timeout)

    def commit(self, message):
        self._consumer.commit(message=message, asynchronous=False)

    def close(self):
        self._consumer.close()


def handle_message(message, store):
    """
    Append one message to the store. Returns True when a line was written,
    False when it was a duplicate or unreadable. Both outcomes commit.
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
        logger.warning('Skipping unreadable trade event partition=%s offset=%s',
                       message.partition(), message.offset())
        return False
    written = store.append(message.partition(), message.offset(), key, body)
    if written:
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


def start_scheduler(app, files_dir, interval_minutes):
    """Run the report job on an interval inside the Flask app context."""
    from models import db
    from report_run import run_report

    def job():
        with app.app_context():
            try:
                run_report(files_dir, db.session)
            except Exception:  # noqa: BLE001 - the job must never kill the scheduler
                logger.exception('Report run failed')
            finally:
                db.session.remove()

    scheduler = BackgroundScheduler()
    scheduler.add_job(job, trigger='interval', minutes=interval_minutes, id='report_run',
                      coalesce=True, max_instances=1)
    scheduler.start()
    logger.info('Report run scheduled every %s minutes', interval_minutes)
    return scheduler


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
    from app import app

    config = app.config
    files_dir = config['REPORTING_FILES_DIR']
    store = EventStore(f'{files_dir}/events')

    stop = threading.Event()
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda *_: stop.set())

    scheduler = None
    if config['SCHEDULER_ENABLED']:
        scheduler = start_scheduler(app, files_dir, config['SCHEDULER_INTERVAL_MINUTES'])

    source = KafkaSource(config['KAFKA_BOOTSTRAP_SERVERS'], config['REPORTING_CONSUMER_GROUP'],
                         config['KAFKA_TRADE_EVENTS_TOPIC'], on_assign=store.refresh)
    try:
        run_consumer_loop(source, store, stop)
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=True)


if __name__ == '__main__':  # pragma: no cover - the container entry point
    main()
