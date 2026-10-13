"""
The reporting service's own copy of every message it consumed, as files.

One JSON Lines file per topic partition under <files_dir>/events:
trade-events-p0.jsonl, platform-records-p0.jsonl and so on. Each line is one
message: the partition and offset it came from, its key, and the fields of
the body. The consumer appends; the report run and the read model read.
Nothing is ever rewritten, so the files are also the rebuild source for
everything the service serves.

Idempotency needs no side file. Kafka delivers at least once, so a crash
between an append and the offset commit redelivers a message already on
disk. append() refuses any offset at or below the last one written for that
partition, which it learns by scanning the file on start. A line torn by a
crash mid-write is unparseable, is skipped by readers, and is appended again
when Kafka redelivers it, because its offset was never committed.
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

TRADE_EVENTS = 'trade-events'
PLATFORM_RECORDS = 'platform-records'
# The fields every order status line has, present or null, whatever the producer sent.
EVENT_FIELDS = ('orderId', 'status', 'symbol', 'side', 'quantity', 'price', 'rejectionReason', 'occurredAt')
_FRACTION = re.compile(r'(\.\d{6})\d+')


def parse_occurred_at(value):
    """
    Parse the ISO-8601 timestamp Jackson writes. It may end in Z or an offset
    and may carry more than six fractional digits, which Python rejects.
    Returns an aware datetime in UTC, or None when unparseable.
    """
    if not isinstance(value, str) or not value:
        return None
    text = value.strip()
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    text = _FRACTION.sub(r'\1', text)
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class EventStore:
    """
    Append-only JSON Lines files for one topic, one per partition.

    topic says what the files hold, TRADE_EVENTS or PLATFORM_RECORDS, and
    names them. It is not the broker's name for the topic, which a deployment
    may configure: readers find the files by these two names whatever it is.

    An order status line keeps the account id that was the message key as
    accountId. A platform record line keeps its key, record type and id, as
    key. Either way the body's own fields follow unchanged.
    """

    def __init__(self, events_dir, topic=TRADE_EVENTS):
        self.events_dir = Path(events_dir)
        self.events_dir.mkdir(parents=True, exist_ok=True)
        self.topic = topic
        self._last_offset = {}
        self.refresh()

    def _files(self):
        return sorted(self.events_dir.glob(f'{self.topic}-p*.jsonl'))

    def refresh(self):
        """Re-read the last written offset of every partition file on disk."""
        self._last_offset = {}
        for path in self._files():
            partition = _partition_of(path)
            if partition is None:
                continue
            last = None
            for event in _read_lines(path):
                last = event['offset']
            if last is not None:
                self._last_offset[partition] = last

    def last_offset(self, partition):
        """The highest offset written for a partition, or None if nothing has been."""
        return self._last_offset.get(partition)

    def path_for(self, partition):
        return self.events_dir / f'{self.topic}-p{partition}.jsonl'

    def append(self, partition, offset, key, body):
        """
        Write one message as one line. Returns False, writing nothing, when the
        offset is not newer than the last one written for that partition.
        """
        last = self._last_offset.get(partition)
        if last is not None and offset <= last:
            logger.info('Skipping duplicate %s message partition=%s offset=%s (last written %s)',
                        self.topic, partition, offset, last)
            return False

        with open(self.path_for(partition), 'a', encoding='utf-8') as handle:
            handle.write(json.dumps(self._line(partition, offset, key, body), separators=(',', ':')) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
        self._last_offset[partition] = offset
        return True

    def _line(self, partition, offset, key, body):
        """Where the message came from first, so no body field can replace it."""
        if self.topic == TRADE_EVENTS:
            line = {'partition': partition, 'offset': offset, 'accountId': _account_id(key)}
            for field in EVENT_FIELDS:
                line[field] = body.get(field)
        else:
            line = {'partition': partition, 'offset': offset, 'key': key}
        for field, value in body.items():
            line.setdefault(field, value)
        return line

    def iter_events(self):
        """Yield every parseable event across all partition files, in file order."""
        for path in self._files():
            yield from _read_lines(path)


def _partition_of(path):
    stem = path.stem  # trade-events-p0
    try:
        return int(stem.rsplit('-p', 1)[1])
    except (IndexError, ValueError):
        return None


def _read_lines(path):
    with open(path, 'r', encoding='utf-8') as handle:
        for number, raw in enumerate(handle, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning('Skipping unreadable line %s in %s', number, path.name)
                continue
            if not isinstance(event, dict) or not isinstance(event.get('offset'), int):
                logger.warning('Skipping malformed line %s in %s', number, path.name)
                continue
            yield event


def _account_id(key):
    if key is None:
        return None
    try:
        return int(key)
    except (TypeError, ValueError):
        return str(key)
