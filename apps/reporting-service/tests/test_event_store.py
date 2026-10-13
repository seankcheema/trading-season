"""The append-only JSON Lines store the consumer writes."""

import json

from event_store import PLATFORM_RECORDS, EventStore

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


class TestWhatALineCarries:

    def test_an_order_line_keeps_the_order_row_and_execution_the_event_carried(self, tmp_path):
        store = EventStore(tmp_path)
        body = {**BODY, 'order': {'clientReference': 'c0ffee', 'instrumentName': 'Test Corp'},
                'execution': {'fillId': 9, 'availableFunds': 5000.0}}

        store.append(0, 0, '42', body)

        line = read_lines(tmp_path / 'trade-events-p0.jsonl')[0]
        assert line['order'] == {'clientReference': 'c0ffee', 'instrumentName': 'Test Corp'}
        assert line['execution'] == {'fillId': 9, 'availableFunds': 5000.0}

    def test_an_order_line_always_has_the_status_fields_even_when_the_body_lacks_them(self, tmp_path):
        store = EventStore(tmp_path)

        store.append(0, 0, '42', {'orderId': 7})

        line = read_lines(tmp_path / 'trade-events-p0.jsonl')[0]
        assert line['orderId'] == 7
        assert line['status'] is None and line['rejectionReason'] is None and line['occurredAt'] is None

    def test_a_body_cannot_replace_where_the_message_came_from(self, tmp_path):
        store = EventStore(tmp_path)

        store.append(2, 9, '42', {**BODY, 'partition': 0, 'offset': 1, 'accountId': 7})

        line = read_lines(tmp_path / 'trade-events-p2.jsonl')[0]
        assert (line['partition'], line['offset'], line['accountId']) == (2, 9, 42)


class TestPlatformRecords:

    RECORD = {'type': 'CASH_TRANSFER', 'cashTransactionId': 31, 'accountId': 7, 'amount': -25.0,
              'reason': 'WITHDRAWAL', 'createdAt': '2026-10-06T09:30:00Z', 'availableFunds': 75.0}

    def test_a_record_line_keeps_its_key_and_every_field_of_the_body(self, tmp_path):
        store = EventStore(tmp_path, PLATFORM_RECORDS)

        assert store.append(1, 0, 'CASH_TRANSFER:31', self.RECORD) is True

        line = read_lines(tmp_path / 'platform-records-p1.jsonl')[0]
        assert line == {'partition': 1, 'offset': 0, 'key': 'CASH_TRANSFER:31', **self.RECORD}
        assert line['accountId'] == 7, 'the account id of the record, not a key parsed as one'

    def test_each_topic_has_its_own_files_and_its_own_offsets(self, tmp_path):
        trades = EventStore(tmp_path)
        records = EventStore(tmp_path, PLATFORM_RECORDS)

        trades.append(0, 5, '42', BODY)
        assert records.append(0, 5, 'CASH_TRANSFER:31', self.RECORD) is True, 'offset 5 of another topic'
        assert records.append(0, 5, 'CASH_TRANSFER:31', self.RECORD) is False

        assert [event['orderId'] for event in trades.iter_events()] == [7]
        assert [event['type'] for event in records.iter_events()] == ['CASH_TRANSFER']
        assert EventStore(tmp_path).last_offset(0) == 5
        assert EventStore(tmp_path, PLATFORM_RECORDS).last_offset(0) == 5
        assert sorted(path.name for path in tmp_path.iterdir()) == ['platform-records-p0.jsonl',
                                                                    'trade-events-p0.jsonl']


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
