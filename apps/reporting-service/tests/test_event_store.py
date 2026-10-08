"""The append-only JSON Lines store the consumer writes."""

import json

from event_store import EventStore

BODY = {
    'orderId': 7, 'status': 'FILLED', 'symbol': 'TEST', 'side': 'BUY',
    'quantity': 100, 'price': 50.0, 'rejectionReason': None,
    'occurredAt': '2026-10-06T09:30:00Z',
}


def read_lines(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


class TestAppend:

    def test_writes_one_line_with_partition_offset_and_key(self, tmp_path):
        store = EventStore(tmp_path)

        assert store.append(0, 0, '42', BODY) is True

        lines = read_lines(tmp_path / 'trade-events-p0.jsonl')
        assert len(lines) == 1
        assert lines[0]['partition'] == 0
        assert lines[0]['offset'] == 0
        assert lines[0]['accountId'] == 42
        assert lines[0]['orderId'] == 7
        assert lines[0]['status'] == 'FILLED'
        assert lines[0]['rejectionReason'] is None
        assert store.last_offset(0) == 0

    def test_refuses_an_offset_already_written(self, tmp_path):
        store = EventStore(tmp_path)
        store.append(0, 5, '42', BODY)

        assert store.append(0, 5, '42', BODY) is False
        assert store.append(0, 4, '42', BODY) is False
        assert store.append(0, 6, '42', BODY) is True

        assert [line['offset'] for line in read_lines(tmp_path / 'trade-events-p0.jsonl')] == [5, 6]

    def test_partitions_do_not_block_each_other(self, tmp_path):
        store = EventStore(tmp_path)
        store.append(0, 5, '42', BODY)

        assert store.append(1, 0, '43', BODY) is True
        assert store.last_offset(0) == 5
        assert store.last_offset(1) == 0
        assert store.last_offset(2) is None

    def test_keeps_a_non_numeric_key_as_text_and_a_missing_key_as_null(self, tmp_path):
        store = EventStore(tmp_path)
        store.append(0, 0, 'joanna', BODY)
        store.append(0, 1, None, BODY)

        lines = read_lines(tmp_path / 'trade-events-p0.jsonl')
        assert lines[0]['accountId'] == 'joanna'
        assert lines[1]['accountId'] is None


class TestResume:

    def test_a_new_store_resumes_from_the_files_on_disk(self, tmp_path):
        first = EventStore(tmp_path)
        first.append(0, 3, '42', BODY)
        first.append(2, 11, '43', BODY)

        second = EventStore(tmp_path)

        assert second.last_offset(0) == 3
        assert second.last_offset(2) == 11
        assert second.append(0, 3, '42', BODY) is False
        assert second.append(2, 12, '43', BODY) is True

    def test_a_torn_last_line_is_skipped_and_does_not_stop_appends(self, tmp_path):
        store = EventStore(tmp_path)
        store.append(0, 0, '42', BODY)
        path = tmp_path / 'trade-events-p0.jsonl'
        with open(path, 'a', encoding='utf-8') as handle:
            handle.write('{"partition":0,"offset":1,"orderId":8,"stat')  # crash mid-write

        reopened = EventStore(tmp_path)

        assert reopened.last_offset(0) == 0
        assert [event['offset'] for event in reopened.iter_events()] == [0]
        # Kafka redelivers offset 1 because it was never committed; it is appended normally.
        # The torn fragment has no trailing newline, so the next line starts on it; readers skip
        # that combined unreadable line, and the event after it is read.
        assert reopened.append(0, 1, '42', {**BODY, 'orderId': 8}) is True
        assert reopened.append(0, 2, '42', {**BODY, 'orderId': 9}) is True
        offsets = [event['offset'] for event in EventStore(tmp_path).iter_events()]
        assert offsets[0] == 0
        assert offsets[-1] == 2

    def test_iter_events_reads_every_partition_in_order(self, tmp_path):
        store = EventStore(tmp_path)
        store.append(1, 0, '43', {**BODY, 'orderId': 2})
        store.append(0, 0, '42', {**BODY, 'orderId': 1})
        store.append(0, 1, '42', {**BODY, 'orderId': 3})

        assert [event['orderId'] for event in store.iter_events()] == [1, 3, 2]

    def test_ignores_files_that_are_not_partition_files(self, tmp_path):
        (tmp_path / 'trade-events-pX.jsonl').write_text('{"offset": 1}\n', encoding='utf-8')
        (tmp_path / 'notes.txt').write_text('ignored', encoding='utf-8')

        store = EventStore(tmp_path)

        assert store.last_offset(0) is None
