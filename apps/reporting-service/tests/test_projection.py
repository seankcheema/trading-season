"""The projection: messages in, read model rows out, the same rows however often they arrive."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

import console
from models import (Account, AuditTrail, CashTransaction, Fill, FundsBalance, Holding, HoldingMovement, Instrument,
                    Order, PortfolioValuation, SimulationSession, User, UserAccount)
from projection import Unusable, apply_record, apply_trade_event
from tests.messages import (JANE, SEAN, account, audit, execution, filled, market_session, order_event, profile,
                            sign_in, transfer, valuation)

SEAN_ID = uuid.UUID(SEAN)
JANE_ID = uuid.UUID(JANE)


def utc(*parts):
    return datetime(*parts, tzinfo=timezone.utc)


def stored(value):
    """SQLite hands a timestamp back naive; it was stored as UTC."""
    return value.replace(tzinfo=timezone.utc)


def count(session, model):
    return session.query(model).count()


@pytest.fixture
def customer(db_session):
    """Sean, signed up, with a profile and one account, as three records."""
    apply_record(db_session, sign_in())
    apply_record(db_session, profile())
    apply_record(db_session, account())
    return db_session


class TestOrderEvents:

    def test_an_accepted_order_becomes_an_order_row_and_names_its_instrument(self, customer):
        assert apply_trade_event(customer, order_event(7, 'ACCEPTED', accepted_at='2026-10-05T09:30:00.500Z')) is True

        order = customer.get(Order, 7)
        assert (order.account_id, order.instrument_id, order.order_type, order.status) == (1, 3, 'BUY', 'ACCEPTED')
        assert order.client_reference == uuid.UUID('c0000000-0000-4000-8000-000000000007')
        assert order.quantity == Decimal('10')
        assert order.indicative_price == Decimal('100')
        assert order.buffer_percent == Decimal('0.5')
        assert stored(order.submitted_at) == utc(2026, 10, 5, 9, 30)
        assert stored(order.accepted_at) == utc(2026, 10, 5, 9, 30, 0, 500000)
        assert order.resolved_at is None
        instrument = customer.get(Instrument, 3)
        assert (instrument.ticker, instrument.name) == ('AAPL', 'Apple Inc.')
        assert count(customer, Fill) == 0

    def test_a_filled_order_brings_its_fill_both_postings_the_holding_and_the_cash_left(self, customer):
        apply_trade_event(customer, order_event(7, 'ACCEPTED', accepted_at='2026-10-05T09:30:00Z'))
        apply_trade_event(customer, filled(7, fill_id=4, cash_id=11, movement_id=5))

        assert customer.get(Order, 7).status == 'FILLED'
        fill = customer.get(Fill, 4)
        assert (fill.order_id, fill.quote_price, fill.quantity) == (7, Decimal('100'), Decimal('10'))
        posting = customer.get(CashTransaction, 11)
        assert (posting.account_id, posting.fill_id, posting.amount, posting.reason) == (
            1, 4, Decimal('-1000'), 'ORDER_FILL')
        movement = customer.get(HoldingMovement, 5)
        assert (movement.account_id, movement.instrument_id, movement.fill_id, movement.quantity_delta) == (
            1, 3, 4, Decimal('10'))
        holding = customer.query(Holding).one()
        assert (holding.account_id, holding.instrument_id, holding.quantity) == (1, 3, Decimal('10'))
        assert customer.get(User, SEAN_ID).available_funds == Decimal('9000')

    def test_a_rejected_order_keeps_its_reason_and_executes_nothing(self, customer):
        apply_trade_event(customer, order_event(8, 'REJECTED', side='SELL', quantity=500,
                                                reason='Insufficient holdings',
                                                resolved_at='2026-10-05T10:00:00Z'))

        order = customer.get(Order, 8)
        assert (order.status, order.rejection_reason) == ('REJECTED', 'Insufficient holdings')
        assert count(customer, Fill) == count(customer, CashTransaction) == count(customer, Holding) == 0
        assert customer.get(User, SEAN_ID).available_funds == Decimal('10000')

    def test_applying_a_message_twice_leaves_the_same_rows(self, customer):
        event = filled(7, fill_id=4, cash_id=11, movement_id=5)

        apply_trade_event(customer, event)
        apply_trade_event(customer, event)

        for model in (Order, Fill, CashTransaction, HoldingMovement, Holding, Instrument):
            assert count(customer, model) == 1, model.__name__
        assert customer.get(User, SEAN_ID).available_funds == Decimal('9000')

    def test_a_replayed_earlier_status_does_not_take_an_order_backwards(self, customer):
        apply_trade_event(customer, filled(7, fill_id=4, cash_id=11, movement_id=5))

        apply_trade_event(customer, order_event(7, 'ACCEPTED', accepted_at='2026-10-05T09:30:00Z'))

        order = customer.get(Order, 7)
        assert order.status == 'FILLED'
        assert order.resolved_at is not None

    def test_a_replayed_earlier_fill_does_not_put_an_older_holding_or_balance_back(self, customer):
        first = filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00, held=10,
                       at='2026-10-05T09:30:01Z')
        second = filled(9, fill_id=6, cash_id=13, movement_id=8, funds=8500.00, held=15, delta=5, quantity=5,
                        cash_amount=-500.00, at='2026-10-06T09:30:01Z')
        apply_trade_event(customer, first)
        apply_trade_event(customer, second)

        apply_trade_event(customer, first)

        assert customer.query(Holding).one().quantity == Decimal('15')
        assert customer.get(User, SEAN_ID).available_funds == Decimal('8500')
        assert count(customer, HoldingMovement) == 2

    def test_an_event_from_before_events_carried_the_order_row_is_left_out(self, customer):
        thin = {'accountId': 1, 'orderId': 7, 'status': 'FILLED', 'symbol': 'AAPL', 'side': 'BUY',
                'quantity': 10, 'price': 100.0, 'rejectionReason': None, 'occurredAt': '2026-10-05T09:30:01Z'}

        assert apply_trade_event(customer, thin) is False
        assert count(customer, Order) == 0

    def test_a_fill_without_ledger_ids_still_records_the_fill(self, customer):
        bare = execution(4, None, None, funds=None, held=None)

        apply_trade_event(customer, order_event(7, 'FILLED', resolved_at='2026-10-05T09:30:01Z', execution=bare))

        assert count(customer, Fill) == 1
        assert count(customer, CashTransaction) == count(customer, HoldingMovement) == count(customer, Holding) == 0
        assert customer.get(User, SEAN_ID).available_funds == Decimal('10000')

    def test_an_instrument_without_a_name_is_called_by_its_ticker(self, customer):
        apply_trade_event(customer, order_event(7, 'ACCEPTED', name=None))

        assert customer.get(Instrument, 3).name == 'AAPL'

    @pytest.mark.parametrize('damage', [
        {'orderId': None}, {'orderId': 'seven'}, {'orderId': 7.5}, {'orderId': True}, {'accountId': 'joanna'},
        {'status': None}, {'symbol': ''}, {'quantity': 'many'}, {'quantity': float('nan')}, {'quantity': False},
    ])
    def test_an_event_missing_what_its_order_needs_is_unusable_and_changes_nothing(self, customer, damage):
        with pytest.raises(Unusable):
            apply_trade_event(customer, {**order_event(7, 'ACCEPTED'), **damage})

        assert count(customer, Order) == count(customer, Instrument) == 0

    @pytest.mark.parametrize('field, value', [
        ('clientReference', 'not-a-uuid'), ('submittedAt', 'yesterday'), ('submittedAt', None),
        ('instrumentId', None),
    ])
    def test_a_garbled_order_row_is_unusable(self, customer, field, value):
        event = order_event(7, 'ACCEPTED')
        event['order'][field] = value

        with pytest.raises(Unusable):
            apply_trade_event(customer, event)

        assert count(customer, Order) == 0

    def test_a_garbled_execution_is_unusable_before_anything_is_written(self, customer):
        event = filled(7, fill_id=4, cash_id=11, movement_id=5)
        event['execution']['filledAt'] = 'soon'

        with pytest.raises(Unusable):
            apply_trade_event(customer, event)

        assert count(customer, Order) == count(customer, Fill) == 0


class TestSignIns:

    def test_a_sign_in_is_stored_with_its_role_and_lock(self, db_session):
        apply_record(db_session, sign_in(failed=5, locked_until='2026-10-05T09:45:00.000Z',
                                         updated_at='2026-10-05T09:30:00.000Z'))

        row = db_session.get(UserAccount, SEAN_ID)
        assert (row.email, row.user_role, row.failed_login_attempts) == ('sean@example.com', 'TRADER', 5)
        assert stored(row.locked_until) == utc(2026, 10, 5, 9, 45)
        assert stored(row.created_at) == utc(2026, 9, 1, 9, 0)

    def test_a_later_state_replaces_an_earlier_one(self, db_session):
        apply_record(db_session, sign_in(failed=5, locked_until='2026-10-05T09:45:00.000Z',
                                         updated_at='2026-10-05T09:30:00.000Z'))
        apply_record(db_session, sign_in(failed=0, updated_at='2026-10-05T09:50:00.000Z'))

        row = db_session.get(UserAccount, SEAN_ID)
        assert (row.failed_login_attempts, row.locked_until) == (0, None)
        assert count(db_session, UserAccount) == 1

    def test_a_republished_earlier_state_does_not_undo_a_later_one(self, db_session):
        apply_record(db_session, sign_in(failed=0, updated_at='2026-10-05T09:50:00.000Z'))

        apply_record(db_session, sign_in(failed=5, locked_until='2026-10-05T09:45:00.000Z',
                                         updated_at='2026-10-05T09:30:00.000Z'))

        assert db_session.get(UserAccount, SEAN_ID).failed_login_attempts == 0

    def test_missing_timestamps_fall_back_on_each_other(self, db_session):
        apply_record(db_session, sign_in(created_at=None, updated_at='2026-10-05T09:30:00.000Z'))

        row = db_session.get(UserAccount, SEAN_ID)
        assert stored(row.created_at) == stored(row.updated_at) == utc(2026, 10, 5, 9, 30)

    def test_a_sign_in_without_an_email_is_unusable(self, db_session):
        with pytest.raises(Unusable):
            apply_record(db_session, sign_in(email=None))

        assert count(db_session, UserAccount) == 0


class TestProfilesAndCash:

    def test_a_profile_becomes_a_user_with_its_level_and_opening_cash(self, db_session):
        apply_record(db_session, profile(timeout=15, last_activity='2026-10-05T08:00:00Z'))

        user = db_session.get(User, SEAN_ID)
        assert (user.first_name, user.last_name, user.trader_level) == ('Sean', 'Cheema', 'ADVANCED')
        assert user.available_funds == Decimal('10000')
        assert user.session_timeout_minutes == 15
        assert stored(user.last_activity_at) == utc(2026, 10, 5, 8, 0)

    def test_a_deposit_is_a_transfer_row_and_moves_the_balance(self, customer):
        apply_record(customer, transfer(21, amount=500.00, reason='DEPOSIT', funds=10500.00))

        row = customer.get(CashTransaction, 21)
        assert (row.account_id, row.fill_id, row.amount, row.reason) == (1, None, Decimal('500'), 'DEPOSIT')
        assert customer.get(User, SEAN_ID).available_funds == Decimal('10500')

    def test_the_balance_is_the_latest_one_whichever_topic_it_came_on(self, customer):
        apply_trade_event(customer, filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00,
                                           at='2026-10-05T09:30:01Z'))
        apply_record(customer, transfer(21, amount=-200.00, reason='WITHDRAWAL', funds=8800.00,
                                        created_at='2026-10-05T12:00:00Z'))
        # An earlier deposit arrives late, as it can from the other topic.
        apply_record(customer, transfer(20, amount=300.00, funds=10300.00, created_at='2026-10-04T12:00:00Z'))

        assert customer.get(User, SEAN_ID).available_funds == Decimal('8800')
        assert count(customer, CashTransaction) == 3, 'every posting is kept; only the balance is the latest'

    def test_a_republished_profile_does_not_put_an_older_balance_back(self, customer):
        apply_trade_event(customer, filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00))

        apply_record(customer, profile(first='Seán', funds=10000.00))

        user = customer.get(User, SEAN_ID)
        assert user.first_name == 'Seán', 'the rest of the profile is taken'
        assert user.available_funds == Decimal('9000'), 'the cash is still what the later fill left'

    def test_a_profile_read_after_the_fill_carries_the_newer_balance(self, customer):
        apply_trade_event(customer, filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00))

        apply_record(customer, profile(funds=9750.00, as_of='2026-10-08T00:00:00Z'))

        assert customer.get(User, SEAN_ID).available_funds == Decimal('9750')

    def test_a_balance_that_arrives_before_its_profile_is_kept_for_it(self, db_session):
        apply_record(db_session, transfer(21, funds=10500.00, created_at='2026-10-05T12:00:00Z'))
        assert db_session.get(User, SEAN_ID) is None
        assert db_session.get(FundsBalance, SEAN_ID).available_funds == Decimal('10500')

        apply_record(db_session, profile(funds=10000.00, as_of='2026-09-01T09:00:05Z'))

        assert db_session.get(User, SEAN_ID).available_funds == Decimal('10500')

    def test_a_profile_without_funds_takes_a_balance_already_known_or_starts_at_zero(self, db_session):
        apply_record(db_session, profile(funds=None))
        assert db_session.get(User, SEAN_ID).available_funds == Decimal('0')

        apply_record(db_session, transfer(21, funds=250.00))
        apply_record(db_session, profile(funds=None))

        assert db_session.get(User, SEAN_ID).available_funds == Decimal('250')

    def test_a_transfer_without_its_owner_is_still_a_transfer(self, customer):
        apply_record(customer, transfer(21, user_id=None, funds=10500.00))

        assert count(customer, CashTransaction) == 1
        assert customer.get(User, SEAN_ID).available_funds == Decimal('10000')

    def test_a_profile_without_a_name_is_unusable(self, db_session):
        with pytest.raises(Unusable):
            apply_record(db_session, profile(first=None))

        assert count(db_session, User) == 0


class TestTheOtherRecords:

    def test_an_account_is_stored_under_its_owner_and_renamed_in_place(self, db_session):
        apply_record(db_session, account(name='Main Account'))
        apply_record(db_session, account(name='Growth'))

        row = db_session.query(Account).one()
        assert (row.account_id, row.user_id, row.name, row.opened_date, row.currency) == (
            1, SEAN_ID, 'Growth', date(2026, 9, 1), 'USD')

    def test_an_account_without_a_date_or_currency_gets_today_and_dollars(self, db_session):
        apply_record(db_session, account(opened=None, currency=None))

        row = db_session.query(Account).one()
        assert row.currency == 'USD'
        assert row.opened_date is not None

    def test_an_account_with_a_garbled_date_is_unusable(self, db_session):
        with pytest.raises(Unusable):
            apply_record(db_session, account(opened='last week'))

    def test_only_the_newest_valuation_of_an_account_is_kept(self, db_session):
        apply_record(db_session, valuation(40, account_id=1, value=1500.00))
        apply_record(db_session, valuation(41, account_id=2, value=700.00))
        apply_record(db_session, valuation(45, account_id=1, value=1650.25))
        # An older one, republished late.
        apply_record(db_session, valuation(42, account_id=1, value=1.00))

        rows = {row.account_id: row for row in db_session.query(PortfolioValuation)}
        assert {key: (row.valuation_id, row.portfolio_value) for key, row in rows.items()} == {
            1: (45, Decimal('1650.25')), 2: (41, Decimal('700'))}

    def test_audit_entries_are_kept_per_order_in_their_own_order(self, db_session):
        apply_record(db_session, audit(3, 7, 'FILLED', 'Filled 10 @ 100.00'))
        apply_record(db_session, audit(1, 7, 'PENDING'))
        apply_record(db_session, audit(2, 7, 'ACCEPTED'))
        apply_record(db_session, audit(2, 7, 'ACCEPTED'))

        trail = db_session.query(AuditTrail).order_by(AuditTrail.audit_id).all()
        assert [(entry.event_type, entry.detail) for entry in trail] == [
            ('PENDING', None), ('ACCEPTED', None), ('FILLED', 'Filled 10 @ 100.00')]

    def test_the_current_session_replaces_the_one_before(self, db_session):
        apply_record(db_session, market_session(2026001))
        apply_record(db_session, market_session(2026002))

        assert [row.id for row in db_session.query(SimulationSession)] == [2026002]

    def test_a_record_type_this_service_does_not_show_is_ignored(self, db_session):
        assert apply_record(db_session, {'type': 'SOMETHING_NEW', 'id': 1}) is False
        assert apply_record(db_session, {'id': 1}) is False


class TestWhatTheConsoleMakesOfIt:
    """The console's queries read rows built from messages exactly as they read seeded rows."""

    @pytest.fixture
    def history(self, customer):
        session = customer
        apply_record(session, sign_in(JANE, 'jane@example.com', failed=5, locked_until='2099-01-01T00:00:00.000Z',
                                      updated_at='2026-10-05T11:00:00.000Z'))
        apply_record(session, profile(JANE, 'Jane', 'Doe', 'BEGINNER', funds=5000.00))
        apply_record(session, account(2, JANE, 'Primary'))
        apply_record(session, sign_in('c0000000-0000-4000-8000-00000000000c', 'analyst@example.com', 'ANALYST'))
        apply_record(session, market_session(2026001))
        apply_record(session, transfer(10, funds=10000.00, amount=2500.00, created_at='2026-10-04T08:00:00Z'))
        for entry in (audit(1, 7, 'PENDING'), audit(2, 7, 'ACCEPTED'),
                      audit(3, 7, 'FILLED', 'Filled 10 @ 100.00', '2026-10-05T09:30:01Z')):
            apply_record(session, entry)
        apply_trade_event(session, order_event(7, 'ACCEPTED', accepted_at='2026-10-05T09:30:00Z'))
        apply_trade_event(session, filled(7, fill_id=4, cash_id=11, movement_id=5, funds=9000.00))
        apply_trade_event(session, order_event(8, 'REJECTED', account_id=2, symbol='NVDA', name='NVIDIA Corporation',
                                               instrument_id=5, quantity=1000, price=180.00,
                                               reason='BR-09: insufficient funds for this order',
                                               submitted_at='2026-10-05T10:00:00Z',
                                               resolved_at='2026-10-05T10:00:00Z'))
        apply_record(session, valuation(40, account_id=1, value=1010.00))
        session.commit()
        return session

    NOW = datetime(2026, 10, 5, 21, 0, tzinfo=timezone.utc)

    def test_activity_counts_the_orders_and_the_transfer(self, history):
        activity = console.activity(history, '7d', self.NOW)

        assert activity['kpis']['orders']['value'] == 2
        assert activity['kpis']['fillRate'] == {'value': 50.0, 'change': None, 'filled': 1}
        assert activity['kpis']['rejected']['topReason'] == 'BR-09: insufficient funds for this order'
        assert activity['kpis']['netCashFlow']['value'] == 2500.0
        assert activity['notional']['total'] == 1000.0
        assert activity['sessionId'] == 2026001
        assert {row['segment']: row['orders'] for row in activity['segments']} == {
            'BEGINNER': 1, 'INTERMEDIATE': 0, 'ADVANCED': 1}
        assert {item['kind'] for item in activity['feed']} == {'fill', 'reject', 'cash', 'lock'}

    def test_an_order_shows_its_execution_ledger_and_audit_trail(self, history):
        detail = console.order_detail(history, 7)

        assert detail['userEmail'] == 'sean@example.com'
        assert detail['fill'] == {'fillId': 4, 'price': 100.0, 'quantity': 10.0,
                                  'filledAt': '2026-10-05T09:30:01+00:00'}
        assert detail['ledger'] == {
            'cashBefore': 10000.0, 'cashChange': -1000.0, 'cashAfter': 9000.0,
            'holdingBefore': 0.0, 'holdingChange': 10.0, 'holdingAfter': 10.0,
            'cashTransactionId': 11, 'holdingMovementId': 5,
        }
        assert [entry['eventType'] for entry in detail['audit']] == ['PENDING', 'ACCEPTED', 'FILLED']

    def test_customers_are_the_traders_with_cash_portfolio_and_lock(self, history):
        customers = {row['email']: row for row in console.customers(history, self.NOW)['customers']}

        assert sorted(customers) == ['jane@example.com', 'sean@example.com'], 'the analyst is staff'
        assert (customers['sean@example.com']['cash'], customers['sean@example.com']['portfolio']) == (9000.0, 1010.0)
        assert customers['jane@example.com']['status'] == 'LOCKED'
        assert customers['jane@example.com']['failedAttempts'] == 5


class TestAccountLifecycle:
    def test_archival_preserves_financial_rows_and_survives_older_replay(self, customer):
        apply_trade_event(customer, filled(7, 11, 21, 31))
        retained = (count(customer, Order), count(customer, Fill), count(customer, CashTransaction))
        record = dict(account(), status='ARCHIVED', archivedAt='2026-10-15T12:00:00Z')
        apply_record(customer, record)
        apply_record(customer, record)
        apply_record(customer, account())
        row = customer.get(Account, 1)
        assert row.status == 'ARCHIVED'
        assert stored(row.archived_at) == utc(2026, 10, 15, 12)
        assert retained == (count(customer, Order), count(customer, Fill), count(customer, CashTransaction))

    def test_unknown_status_cannot_change_account(self, customer):
        with pytest.raises(Unusable):
            apply_record(customer, dict(account(), status='UNKNOWN'))
        assert customer.get(Account, 1).status == 'ACTIVE'


    def test_status_and_archive_timestamp_must_agree(self, customer):
        with pytest.raises(Unusable):
            apply_record(customer, dict(account(), status='ARCHIVED'))
        with pytest.raises(Unusable):
            apply_record(customer, dict(account(), archivedAt='2026-10-15T12:00:00Z'))
        assert customer.get(Account, 1).status == 'ACTIVE'


def test_execution_snapshot_survives_old_accepted_replay(customer):
    original = order_event(70, 'ACCEPTED', accepted_at='2026-10-05T09:30:00Z')
    original['order'].update(executionType='STOP_LIMIT', referencePrice=100, sessionId=1,
                             referenceAt='2026-10-05T09:30:00Z', evaluatedAt='2026-10-05T09:30:00Z',
                             limitPrice=102, stopPrice=105, reservedCash=1020, reservedShares=0)
    apply_trade_event(customer, original)
    import copy
    triggered = copy.deepcopy(original)
    triggered['order'].update(triggeredAt='2026-10-05T09:31:00Z', evaluatedAt='2026-10-05T09:31:00Z')
    apply_trade_event(customer, triggered)
    apply_trade_event(customer, original)
    current = customer.get(Order, 70)
    assert current.execution_type == 'STOP_LIMIT'
    assert current.reference_price == Decimal('100')
    assert current.reserved_cash == Decimal('1020')
    assert stored(current.triggered_at) == utc(2026, 10, 5, 9, 31)
    cancelled = copy.deepcopy(triggered)
    cancelled['status'] = 'CANCELLED'
    cancelled['order'].update(reservedCash=0, resolvedAt='2026-10-05T09:32:00Z')
    apply_trade_event(customer, cancelled)
    apply_trade_event(customer, triggered)
    customer.expire_all()
    assert customer.get(Order, 70).status == 'CANCELLED'
    assert customer.get(Order, 70).reserved_cash == Decimal('0')
