"""
Keeps the read model (models.py) in step with the files the consumer writes.

The service has no database to ask. Each process holds the tables in an
in-memory SQLite database and fills them itself: sync() reads whatever has
been appended to the event files since it last looked and applies it
(projection.py). The first call reads everything; later calls read only the
new lines, so a request costs a few stat() calls when nothing has happened.

The platform-records files are read before the trade-events files. Both
orders converge on the same rows, but reading the customers and accounts
first means an order never waits a round for the account it belongs to.

One connection serves every thread of the process, so everything that
touches the tables happens while holding lock: syncing, querying, and
releasing the session afterwards. Reads are short and the console is polled
every few seconds per open screen, so one at a time is plenty.

Nothing here is the only copy of anything. The files are the source, and if
one is replaced or removed the tables are emptied and rebuilt from what is
on disk.
"""

import json
import logging
import threading
from decimal import Decimal
from pathlib import Path

from event_store import PLATFORM_RECORDS, TRADE_EVENTS
from models import db
from projection import Unusable, apply_record, apply_trade_event

logger = logging.getLogger(__name__)

# Applied in this order on every sync: records, then order events.
SOURCES = ((PLATFORM_RECORDS, apply_record), (TRADE_EVENTS, apply_trade_event))


class ReadModel:
    """The tail position of every event file, and the lock the tables are used under."""

    def __init__(self):
        self.lock = threading.RLock()
        self._positions = {}

    def sync(self, session, files_dir):
        """
        Apply every complete line appended since the last call and commit.
        Returns how many messages were applied. Hold lock while calling, and
        until the session is released.
        """
        events_dir = Path(files_dir) / 'events'
        db.metadata.create_all(session.get_bind())

        sources = [(path, apply) for topic, apply in SOURCES
                   for path in sorted(events_dir.glob(f'{topic}-p*.jsonl'))]
        if self._was_replaced(events_dir, [path for path, _ in sources]):
            logger.warning('Event files under %s were replaced; rebuilding the read model', events_dir)
            self._empty(session, events_dir)

        applied = 0
        for path, apply in sources:
            applied += self._tail(session, path, apply)
        session.commit()
        if applied:
            logger.info('Read model applied %s message(s) from %s', applied, events_dir)
        return applied

    def _was_replaced(self, events_dir, paths):
        """True when a file we have read from is gone or shorter than what we read of it."""
        on_disk = {str(path): path.stat().st_size for path in paths}
        for known, position in self._positions.items():
            if Path(known).parent != events_dir:
                continue
            if known not in on_disk or on_disk[known] < position:
                return True
        return False

    def _empty(self, session, events_dir):
        for table in reversed(db.metadata.sorted_tables):
            session.execute(table.delete())
        for known in [known for known in self._positions if Path(known).parent == events_dir]:
            del self._positions[known]

    def _tail(self, session, path, apply):
        position = self._positions.get(str(path), 0)
        with open(path, 'rb') as handle:
            handle.seek(position)
            chunk = handle.read()
        # The consumer may be mid-write: a line counts once its newline is on disk.
        end = chunk.rfind(b'\n')
        if end < 0:
            return 0
        applied = 0
        for raw in chunk[:end].split(b'\n'):
            if not raw.strip():
                continue
            try:
                # Money and quantities stay exact instead of passing through a float.
                message = json.loads(raw, parse_float=Decimal)
            except (ValueError, UnicodeDecodeError):
                logger.warning('Skipping unreadable line in %s', path.name)
                continue
            if not isinstance(message, dict):
                logger.warning('Skipping malformed line in %s', path.name)
                continue
            try:
                applied += 1 if apply(session, message) else 0
            except Unusable as reason:
                logger.warning('Skipping %s message partition=%s offset=%s: %s',
                               path.name, message.get('partition'), message.get('offset'), reason)
        self._positions[str(path)] = position + end + 1
        return applied


read_model = ReadModel()
