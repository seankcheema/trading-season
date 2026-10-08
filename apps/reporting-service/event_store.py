"""
The reporting service's own copy of every trade event, as files.

One JSON Lines file per Kafka partition under <files_dir>/events. Each line is
one message: the partition and offset it came from, the account id that was
the message key, and the fields of the body. The consumer appends; the report
run reads. Nothing is ever rewritten, so the files are also the rebuild
source for any run.

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
from pathlib import Path

logger = logging.getLogger(__name__)

FILE_NAME = 'trade-events-p{partition}.jsonl'
EVENT_FIELDS = ('orderId', 'status', 'symbol', 'side', 'quantity', 'price', 'rejectionReason', 'occurredAt')


class EventStore:
    """Append-only JSON Lines files, one per partition."""

    def __init__(self, events_dir):
        self.events_dir = Path(events_dir)
        self.events_dir.mkdir(parents=True, exist_ok=True)
        self._last_offset = {}
        self.refresh()

    def refresh(self):
        """Re-read the last written offset of every partition file on disk."""
        self._last_offset = {}
        for path in sorted(self.events_dir.glob('trade-events-p*.jsonl')):
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
        return self.events_dir / FILE_NAME.format(partition=partition)

    def append(self, partition, offset, key, body):
        """
        Write one message as one line. Returns False, writing nothing, when the
        offset is not newer than the last one written for that partition.
        """
        last = self._last_offset.get(partition)
        if last is not None and offset <= last:
            logger.info('Skipping duplicate trade event partition=%s offset=%s (last written %s)',
                        partition, offset, last)
            return False

        line = {'partition': partition, 'offset': offset, 'accountId': _account_id(key)}
        for field in EVENT_FIELDS:
            line[field] = body.get(field)

        with open(self.path_for(partition), 'a', encoding='utf-8') as handle:
            handle.write(json.dumps(line, separators=(',', ':')) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
        self._last_offset[partition] = offset
        return True

    def iter_events(self):
        """Yield every parseable event across all partition files, in file order."""
        for path in sorted(self.events_dir.glob('trade-events-p*.jsonl')):
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
