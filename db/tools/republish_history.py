"""
Publish the trading database's history to Kafka for the reporting service.

    python db/tools/republish_history.py \
        --database-url postgresql://trading_season:password@localhost:5432/trading_season \
        --bootstrap-servers localhost:29092

The reporting service reads Kafka and nothing else. Run this once when
adopting that, so the customers, orders and transfers already in the
database appear in it, and again after loading rows with SQL (a seed, a
restore), which no service saw being written. It reads the database once, in
a single read-only snapshot, and writes nothing to it.

It is safe to run again. Every message is keyed by the row it describes and
the reporting service applies each one as an upsert, so a second run leaves
the same rows there. Republished order events carry a replay header, so the
trading services' own consumers of trade-events do not react to them.

--dry-run builds the messages and prints the counts without a broker.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import reporting_feed  # noqa: E402


def parse_arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0].strip())
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'),
                        help='PostgreSQL URL of the trading database; defaults to DATABASE_URL')
    parser.add_argument('--bootstrap-servers', default=os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:29092'),
                        help='Kafka broker; defaults to KAFKA_BOOTSTRAP_SERVERS or localhost:29092')
    parser.add_argument('--trade-events-topic',
                        default=os.getenv('KAFKA_TRADE_EVENTS_TOPIC', reporting_feed.TRADE_EVENTS),
                        help='the order status topic, if the deployment renamed it')
    parser.add_argument('--platform-records-topic',
                        default=os.getenv('KAFKA_PLATFORM_RECORDS_TOPIC', reporting_feed.PLATFORM_RECORDS),
                        help='the records topic, if the deployment renamed it')
    parser.add_argument('--dry-run', action='store_true', help='build the messages and print the counts only')
    arguments = parser.parse_args(argv)
    if not arguments.database_url:
        parser.error('--database-url or DATABASE_URL is required')
    return arguments


def main(argv=None, connect=None, publish=reporting_feed.publish, out=print):
    arguments = parse_arguments(argv)
    if connect is None:
        import psycopg

        connect = psycopg.connect

    with connect(arguments.database_url) as connection:
        snapshot = reporting_feed.load_snapshot(connection)
    messages = reporting_feed.build_messages(snapshot)

    for kind, count in sorted(reporting_feed.summarize(messages).items()):
        out(f'{count:>7}  {kind}')
    if arguments.dry_run:
        out(f'Dry run: {len(messages)} message(s) built, none published.')
        return 0

    acknowledged = publish(messages, arguments.bootstrap_servers, topics={
        reporting_feed.TRADE_EVENTS: arguments.trade_events_topic,
        reporting_feed.PLATFORM_RECORDS: arguments.platform_records_topic,
    })
    out(f'Published {acknowledged} message(s) to {arguments.bootstrap_servers}.')
    return 0


if __name__ == '__main__':  # pragma: no cover - the command line entry point
    sys.exit(main())
