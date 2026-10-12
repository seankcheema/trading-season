"""The console: activity, orders and customers read from the trading database."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

import console
from models import (Account, AuditTrail, CashTransaction, Fill, Holding, HoldingMovement, Instrument, Order,
                    PortfolioValuation, SimulationSession, User, UserAccount)

NOW = datetime(2026, 10, 8, 21, 0, tzinfo=timezone.utc)
# Ids with letters in them: SQLite stores an all-digit UUID as a number.
SEAN = uuid.UUID('a0000000-0000-4000-8000-00000000000a')
JANE = uuid.UUID('b0000000-0000-4000-8000-00000000000b')
ANALYST = uuid.UUID('c0000000-0000-4000-8000-00000000000c')
NOBODY = uuid.UUID('d0000000-0000-4000-8000-00000000000d')
ADMIN = uuid.UUID('e0000000-0000-4000-8000-00000000000e')
NEWCOMER = uuid.UUID('f0000000-0000-4000-8000-00000000000f')


def hours_ago(hours):
    return NOW - timedelta(hours=hours)


@pytest.fixture
def platform(db_session):
    """
    Two traders, a trader who has only signed up, an analyst and an admin.
    Sean filled a buy today and one yesterday; Jane had an order rejected
    today and has one still accepted. Jane is locked out. Sean deposited
    today and withdrew yesterday.
    """
    add = db_session.add_all
    add([
        UserAccount(user_id=SEAN, email='sean@example.com', user_role='TRADER', created_at=hours_ago(900)),
        UserAccount(user_id=JANE, email='jane@example.com', user_role='TRADER', failed_login_attempts=5,
                    locked_until=NOW + timedelta(minutes=15), created_at=hours_ago(800), updated_at=hours_ago(1)),
        UserAccount(user_id=ANALYST, email='analyst@example.com', user_role='ANALYST', created_at=hours_ago(700)),
        UserAccount(user_id=ADMIN, email='reporting-admin@example.com', user_role='ADMIN',
                    created_at=hours_ago(600)),
        UserAccount(user_id=NEWCOMER, email='newcomer@example.com', user_role='TRADER', created_at=hours_ago(5)),
        User(user_id=SEAN, first_name='Sean', last_name='Cheema', ssn='123-45-6789', address='1 Main St',
             date_of_birth=date(1990, 1, 1), trader_level='ADVANCED', available_funds=Decimal('4000.00'),
             session_timeout_minutes=15, last_activity_at=hours_ago(2)),
        User(user_id=JANE, first_name='Jane', last_name='Doe', ssn='987-65-4321', address='2 Side St',
             date_of_birth=date(1991, 2, 2), trader_level='BEGINNER', available_funds=Decimal('5000.00')),
        Account(account_id=1, user_id=SEAN, name='Growth'),
        Account(account_id=2, user_id=SEAN, name='Retirement'),
        Account(account_id=3, user_id=JANE, name='Primary'),
        Instrument(instrument_id=1, ticker='AAPL', name='Apple Inc.'),
        Instrument(instrument_id=2, ticker='NVDA', name='NVIDIA Corporation'),
        SimulationSession(id=12, status='RUNNING'),
    ])
    add([
        # Yesterday: Sean bought 2 AAPL at 100.
        Order(order_id=1, account_id=1, instrument_id=1, order_type='BUY', status='FILLED', quantity=2,
              indicative_price=Decimal('99.50'), buffer_percent=Decimal('1.00'),
              submitted_at=hours_ago(30), accepted_at=hours_ago(30), resolved_at=hours_ago(30)),
        # Today: Sean bought 4 AAPL at 110, Jane was rejected, Jane has one in flight.
        Order(order_id=2, account_id=1, instrument_id=1, order_type='BUY', status='FILLED', quantity=4,
              indicative_price=Decimal('109.00'), submitted_at=hours_ago(3), accepted_at=hours_ago(3),
              resolved_at=hours_ago(3), simulated_at=hours_ago(3)),
        Order(order_id=3, account_id=3, instrument_id=2, order_type='BUY', status='REJECTED', quantity=1000,
              indicative_price=Decimal('180.00'), rejection_reason='BR-09: insufficient funds for this order',
              submitted_at=hours_ago(2), resolved_at=hours_ago(2)),
        Order(order_id=4, account_id=3, instrument_id=2, order_type='SELL', status='ACCEPTED', quantity=1,
              submitted_at=hours_ago(1), accepted_at=hours_ago(1)),
    ])
    add([
        Fill(fill_id=1, order_id=1, quote_price=Decimal('100.00'), quantity=2, filled_at=hours_ago(30)),
        Fill(fill_id=2, order_id=2, quote_price=Decimal('110.00'), quantity=4, filled_at=hours_ago(3)),
        CashTransaction(cash_transaction_id=1, account_id=1, fill_id=1, amount=Decimal('-200.00'),
                        reason='ORDER_FILL', created_at=hours_ago(30)),
        CashTransaction(cash_transaction_id=2, account_id=2, amount=Decimal('-60.00'), reason='WITHDRAWAL',
                        created_at=hours_ago(28)),
        CashTransaction(cash_transaction_id=3, account_id=1, fill_id=2, amount=Decimal('-440.00'),
                        reason='ORDER_FILL', created_at=hours_ago(3)),
        CashTransaction(cash_transaction_id=4, account_id=1, amount=Decimal('300.00'), reason='DEPOSIT',
                        created_at=hours_ago(1)),
        HoldingMovement(holding_movement_id=1, account_id=1, instrument_id=1, fill_id=1, quantity_delta=2,
                        created_at=hours_ago(30)),
        HoldingMovement(holding_movement_id=2, account_id=1, instrument_id=1, fill_id=2, quantity_delta=4,
                        created_at=hours_ago(3)),
        Holding(account_id=1, instrument_id=1, quantity=6),
        AuditTrail(audit_id=1, order_id=2, event_type='PENDING', recorded_at=hours_ago(3)),
        AuditTrail(audit_id=2, order_id=2, event_type='ACCEPTED', recorded_at=hours_ago(3)),
        AuditTrail(audit_id=3, order_id=2, event_type='FILLED', detail='Filled 4 @ 110.0', recorded_at=hours_ago(3)),
        PortfolioValuation(valuation_id=1, account_id=1, portfolio_value=Decimal('500.00'), observed_at=hours_ago(5)),
        PortfolioValuation(valuation_id=2, account_id=1, portfolio_value=Decimal('660.00'), observed_at=hours_ago(1)),
        PortfolioValuation(valuation_id=3, account_id=2, portfolio_value=Decimal('1000.00'), observed_at=hours_ago(1)),
    ])
    db_session.commit()
    return db_session


class TestWindow:

    def test_today_is_cut_into_hours_of_the_viewers_own_day(self):
        # 21:00 UTC is 16:00 at UTC-5, so the day began at 05:00 UTC and is in its 17th hour.
        start, step, count = console.window('today', NOW, -300)

        assert start == datetime(2026, 10, 8, 5, 0, tzinfo=timezone.utc)
        assert (step, count) == (timedelta(hours=1), 17)

    def test_longer_ranges_are_whole_days_ending_today(self):
        start, step, count = console.window('7d', NOW)

        assert start == datetime(2026, 10, 2, tzinfo=timezone.utc)
        assert (step, count) == (timedelta(days=1), 7)


class TestActivity:

    def test_headline_figures_compare_today_with_the_same_span_before_it(self, platform):
        kpis = console.activity(platform, 'today', NOW)['kpis']

        # Today: orders 2, 3 and 4 and a deposit. The 21 hours before it: order 1 and a withdrawal.
        assert kpis['orders'] == {'value': 3, 'change': 200.0}
        assert kpis['fillRate'] == {'value': 50.0, 'change': -50.0, 'filled': 1}
        assert kpis['rejected'] == {'value': 1, 'topReason': 'BR-09: insufficient funds for this order',
                                    'topReasonCount': 1}
        assert kpis['netCashFlow'] == {'value': 300.0, 'change': 600.0}
        assert kpis['activeTraders'] == {'value': 2, 'change': 100.0}

    def test_a_longer_range_reports_change_against_the_prior_period(self, platform):
        platform.add_all([
            Order(order_id=9, account_id=1, instrument_id=1, order_type='BUY', status='FILLED', quantity=1,
                  submitted_at=hours_ago(24 * 9), resolved_at=hours_ago(24 * 9)),
            Fill(fill_id=9, order_id=9, quote_price=Decimal('320.00'), quantity=1, filled_at=hours_ago(24 * 9)),
            CashTransaction(cash_transaction_id=9, account_id=1, amount=Decimal('120.00'), reason='DEPOSIT',
                            created_at=hours_ago(24 * 9)),
        ])
        platform.commit()

        report = console.activity(platform, '7d', NOW)

        assert report['kpis']['orders'] == {'value': 4, 'change': 300.0}
        # 2 of 3 resolved orders filled, against 1 of 1 before: 33.33 points lower.
        assert report['kpis']['fillRate'] == {'value': 66.67, 'change': -33.33, 'filled': 2}
        assert report['kpis']['netCashFlow'] == {'value': 240.0, 'change': 100.0}
        assert report['kpis']['activeTraders'] == {'value': 2, 'change': 100.0}
        assert report['notional']['total'] == 640.0
        assert report['notional']['change'] == 100.0

    def test_notional_is_bucketed_by_hour_and_every_status_is_counted(self, platform):
        report = console.activity(platform, 'today', NOW)

        points = report['notional']['points']
        assert len(points) == 22, 'one point per hour of the day so far'
        assert points[18] == {'at': '2026-10-08T18:00:00+00:00', 'value': 440.0}
        assert sum(point['value'] for point in points) == report['notional']['total'] == 440.0
        assert report['statuses'] == [
            {'status': 'FILLED', 'count': 1}, {'status': 'PENDING', 'count': 0},
            {'status': 'ACCEPTED', 'count': 1}, {'status': 'REJECTED', 'count': 1}]
        assert report['sessionId'] == 12
        assert report['range'] == 'today'
        assert report['from'] == '2026-10-08T00:00:00+00:00'

    def test_most_traded_ranks_symbols_by_notional_with_their_fill_prices(self, platform):
        report = console.activity(platform, '7d', NOW)

        assert report['mostTraded'] == [
            {'symbol': 'AAPL', 'orders': 2, 'notional': 640.0, 'prices': [100.0, 110.0]},
            {'symbol': 'NVDA', 'orders': 2, 'notional': 0.0, 'prices': []},
        ]

    def test_the_feed_is_the_newest_fills_rejections_transfers_and_locks(self, platform):
        feed = console.activity(platform, 'today', NOW)['feed']

        assert [item['kind'] for item in feed] == ['cash', 'lock', 'reject', 'fill', 'cash', 'fill']
        assert feed[0] == {'kind': 'cash', 'at': hours_ago(1).isoformat(), 'userName': 'Sean Cheema',
                           'reason': 'DEPOSIT', 'amount': 300.0}
        assert feed[1] == {'kind': 'lock', 'at': hours_ago(1).isoformat(), 'userName': 'Jane Doe',
                           'failedAttempts': 5}
        assert feed[2] == {'kind': 'reject', 'at': hours_ago(2).isoformat(), 'orderId': 3,
                           'reason': 'BR-09: insufficient funds for this order', 'symbol': 'NVDA'}
        assert feed[3] == {'kind': 'fill', 'at': hours_ago(3).isoformat(), 'userName': 'Sean Cheema',
                           'side': 'BUY', 'quantity': 4.0, 'symbol': 'AAPL', 'amount': 440.0}

    def test_an_expired_lock_is_not_news(self, platform):
        platform.get(UserAccount, JANE).locked_until = NOW - timedelta(minutes=1)
        platform.commit()

        assert 'lock' not in [item['kind'] for item in console.activity(platform, 'today', NOW)['feed']]

    def test_activity_is_split_by_client_segment_with_every_level_listed(self, platform):
        today = console.activity(platform, 'today', NOW)['segments']

        # Jane, a beginner, had one order rejected and has one in flight; Sean, advanced, filled 4 at 110.
        assert today == [
            {'segment': 'BEGINNER', 'traders': 1, 'orders': 2, 'notional': 0.0},
            {'segment': 'INTERMEDIATE', 'traders': 0, 'orders': 0, 'notional': 0.0},
            {'segment': 'ADVANCED', 'traders': 1, 'orders': 1, 'notional': 440.0},
        ]
        # The week adds yesterday's fill, by the same trader.
        week = console.activity(platform, '7d', NOW)['segments']
        assert week[2] == {'segment': 'ADVANCED', 'traders': 1, 'orders': 2, 'notional': 640.0}

    def test_an_empty_platform_reports_zeros(self, db_session):
        report = console.activity(db_session, '30d', NOW)

        assert [row['segment'] for row in report['segments']] == ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
        assert all((row['traders'], row['orders'], row['notional']) == (0, 0, 0.0) for row in report['segments'])
        assert report['kpis']['orders'] == {'value': 0, 'change': None}
        assert report['kpis']['fillRate'] == {'value': None, 'change': None, 'filled': 0}
        assert report['kpis']['rejected'] == {'value': 0, 'topReason': None, 'topReasonCount': 0}
        assert report['notional']['total'] == 0.0
        assert len(report['notional']['points']) == 30
        assert report['feed'] == [] and report['mostTraded'] == []
        assert report['sessionId'] is None


class TestOrders:

    def test_lists_the_newest_orders_first_with_who_placed_them(self, platform):
        listing = console.orders(platform)

        assert listing['total'] == 4
        assert listing['sessionId'] == 12
        assert [order['orderId'] for order in listing['orders']] == [4, 3, 2, 1]
        filled = listing['orders'][2]
        assert filled['userName'] == 'Sean Cheema' and filled['accountName'] == 'Growth'
        assert (filled['symbol'], filled['instrumentName']) == ('AAPL', 'Apple Inc.')
        assert (filled['side'], filled['type'], filled['status']) == ('BUY', 'MARKET', 'FILLED')
        assert (filled['quantity'], filled['price'], filled['indicativePrice']) == (4.0, 110.0, 109.0)
        assert filled['submittedAt'] == hours_ago(3).isoformat()
        assert listing['orders'][1]['price'] is None
        assert listing['orders'][1]['rejectionReason'] == 'BR-09: insufficient funds for this order'

    def test_the_limit_caps_the_rows_but_not_the_total(self, platform):
        listing = console.orders(platform, limit=2)

        assert listing['total'] == 4
        assert [order['orderId'] for order in listing['orders']] == [4, 3]

    def test_lists_deposits_and_withdrawals_beside_the_orders_but_not_what_a_fill_posted(self, platform):
        listing = console.orders(platform)

        assert listing['transfers'] == [
            {'transferId': 4, 'at': hours_ago(1).isoformat(), 'userId': str(SEAN), 'userName': 'Sean Cheema',
             'accountId': 1, 'accountName': 'Growth', 'kind': 'DEPOSIT', 'amount': 300.0},
            {'transferId': 2, 'at': hours_ago(28).isoformat(), 'userId': str(SEAN), 'userName': 'Sean Cheema',
             'accountId': 2, 'accountName': 'Retirement', 'kind': 'WITHDRAWAL', 'amount': -60.0},
        ]

    def test_the_limit_caps_the_transfers_too(self, platform):
        listing = console.orders(platform, limit=1)

        assert [transfer['transferId'] for transfer in listing['transfers']] == [4]

    def test_a_filled_order_shows_what_it_did_to_cash_and_holdings(self, platform):
        detail = console.order_detail(platform, 1)

        # Sean holds 4000.00 now. After order 1 came a withdrawal of 60, a fill of 440 and a deposit of 300.
        assert detail['ledger'] == {
            'cashBefore': 4400.0, 'cashChange': -200.0, 'cashAfter': 4200.0,
            'holdingBefore': 0.0, 'holdingChange': 2.0, 'holdingAfter': 2.0,
            'cashTransactionId': 1, 'holdingMovementId': 1}
        assert detail['fill'] == {'fillId': 1, 'price': 100.0, 'quantity': 2.0, 'filledAt': hours_ago(30).isoformat()}
        assert detail['userEmail'] == 'sean@example.com'
        assert detail['bufferPercent'] == 1.0
        assert detail['simulatedAt'] is None

    def test_the_audit_trail_is_in_the_order_it_was_recorded(self, platform):
        detail = console.order_detail(platform, 2)

        assert [(event['eventType'], event['detail']) for event in detail['audit']] == [
            ('PENDING', None), ('ACCEPTED', None), ('FILLED', 'Filled 4 @ 110.0')]
        assert detail['ledger']['cashAfter'] == 3700.0
        assert detail['ledger']['holdingAfter'] == 6.0

    def test_an_order_that_did_not_fill_posted_nothing(self, platform):
        detail = console.order_detail(platform, 3)

        assert detail['fill'] is None
        assert detail['ledger'] == {
            'cashBefore': 5000.0, 'cashChange': None, 'cashAfter': 5000.0,
            'holdingBefore': 0.0, 'holdingChange': None, 'holdingAfter': 0.0,
            'cashTransactionId': None, 'holdingMovementId': None}
        assert detail['audit'] == []

    def test_an_unknown_order_is_none(self, platform):
        assert console.order_detail(platform, 404) is None


class TestCustomers:

    def test_lists_every_trader_with_balances_and_lock_status(self, platform):
        people = {person['email']: person for person in console.customers(platform, NOW)['customers']}

        sean = people['sean@example.com']
        assert (sean['name'], sean['role'], sean['status'], sean['traderLevel']) == (
            'Sean Cheema', 'TRADER', 'ACTIVE', 'ADVANCED')
        assert (sean['accounts'], sean['cash'], sean['portfolio']) == (2, 4000.0, 1660.0)
        assert sean['lastActiveAt'] == hours_ago(2).isoformat()
        assert sean['memberSince'] == hours_ago(900).isoformat()
        assert sean['lockedUntil'] is None

        jane = people['jane@example.com']
        assert (jane['status'], jane['failedAttempts']) == ('LOCKED', 5)
        assert jane['lockedUntil'] == (NOW + timedelta(minutes=15)).isoformat()
        assert jane['portfolio'] == 0.0 and jane['lastActiveAt'] is None

    def test_a_trader_without_a_trading_profile_is_listed_by_their_email(self, platform):
        people = {person['email']: person for person in console.customers(platform, NOW)['customers']}

        newcomer = people['newcomer@example.com']
        assert (newcomer['name'], newcomer['role'], newcomer['traderLevel']) == (
            'newcomer@example.com', 'TRADER', None)
        assert (newcomer['accounts'], newcomer['cash'], newcomer['portfolio']) == (0, 0.0, 0.0)

    def test_analysts_and_admins_are_not_customers(self, platform):
        listed = [person['email'] for person in console.customers(platform, NOW)['customers']]

        assert listed == ['jane@example.com', 'newcomer@example.com', 'sean@example.com']
        assert console.customer(platform, ANALYST, NOW) is None
        assert console.customer(platform, ADMIN, NOW) is None

    def test_never_returns_personal_identifiers(self, platform):
        listing = console.customers(platform, NOW)
        detail = console.customer(platform, SEAN, NOW)

        for forbidden in ('123-45-6789', '1 Main St', '1990-01-01', 'password'):
            assert forbidden not in str(listing) and forbidden not in str(detail), forbidden

    def test_one_customer_comes_with_accounts_and_orders(self, platform):
        detail = console.customer(platform, SEAN, NOW)

        assert detail['sessionTimeoutMinutes'] == 15
        assert detail['accountBalances'] == [
            {'accountId': 1, 'name': 'Growth', 'value': 660.0},
            {'accountId': 2, 'name': 'Retirement', 'value': 1000.0}]
        assert [order['orderId'] for order in detail['orders']] == [2, 1]
        assert detail['total'] == 2
        assert [(transfer['kind'], transfer['amount']) for transfer in detail['transfers']] == [
            ('DEPOSIT', 300.0), ('WITHDRAWAL', -60.0)]

    def test_a_customer_only_comes_with_their_own_transfers(self, platform):
        assert console.customer(platform, JANE, NOW)['transfers'] == []

    def test_a_customer_without_a_profile_has_no_accounts_orders_or_transfers(self, platform):
        detail = console.customer(platform, NEWCOMER, NOW)

        assert detail['sessionTimeoutMinutes'] is None
        assert detail['accountBalances'] == [] and detail['orders'] == [] and detail['transfers'] == []

    def test_an_unknown_customer_is_none(self, platform):
        assert console.customer(platform, NOBODY, NOW) is None


class TestConsoleRoutes:

    PATHS = ('/api/reporting/activity', '/api/reporting/orders', '/api/reporting/orders/2',
             '/api/reporting/customers', f'/api/reporting/customers/{SEAN}')

    def test_every_console_endpoint_needs_a_token(self, client, platform):
        for path in self.PATHS:
            assert client.get(path).status_code == 401, path

    def test_a_trader_is_refused_every_console_endpoint(self, client, platform, authenticated_trader):
        for path in self.PATHS:
            response = client.get(path, headers=authenticated_trader)
            assert response.status_code == 403, path
            assert response.get_json() == {'error': 'The ADMIN role is required'}

    def test_an_analyst_is_refused_every_console_endpoint(self, client, platform, authenticated):
        for path in self.PATHS:
            response = client.get(path, headers=authenticated)
            assert response.status_code == 403, path
            assert response.get_json() == {'error': 'The ADMIN role is required'}

    def test_an_admin_is_served_every_console_endpoint(self, client, platform, authenticated_admin):
        for path in self.PATHS:
            assert client.get(path, headers=authenticated_admin).status_code == 200, path

    def test_activity_takes_a_range_and_the_viewers_offset(self, client, platform, authenticated_admin):
        response = client.get('/api/reporting/activity?range=7d&tzOffset=-300', headers=authenticated_admin)

        assert response.status_code == 200
        body = response.get_json()
        assert body['range'] == '7d'
        assert len(body['notional']['points']) == 7

    def test_activity_refuses_a_range_or_offset_it_does_not_know(self, client, platform, authenticated_admin):
        for query in ('range=1y', 'tzOffset=abc', 'tzOffset=9000'):
            response = client.get(f'/api/reporting/activity?{query}', headers=authenticated_admin)
            assert response.status_code == 400, query
            assert 'error' in response.get_json()

    def test_orders_take_a_limit_inside_bounds(self, client, platform, authenticated_admin):
        response = client.get('/api/reporting/orders?limit=1', headers=authenticated_admin)

        assert [order['orderId'] for order in response.get_json()['orders']] == [4]
        assert response.get_json()['total'] == 4
        for limit in ('0', '1001', 'many'):
            assert client.get(f'/api/reporting/orders?limit={limit}', headers=authenticated_admin).status_code == 400

    def test_an_order_is_served_with_its_audit_trail(self, client, platform, authenticated_admin):
        body = client.get('/api/reporting/orders/2', headers=authenticated_admin).get_json()

        assert body['orderId'] == 2
        assert len(body['audit']) == 3

    def test_unknown_orders_and_customers_are_not_found(self, client, platform, authenticated_admin):
        assert client.get('/api/reporting/orders/404', headers=authenticated_admin).status_code == 404
        assert client.get('/api/reporting/customers/not-a-uuid', headers=authenticated_admin).status_code == 404
        missing = client.get(f'/api/reporting/customers/{NOBODY}', headers=authenticated_admin)
        assert missing.status_code == 404
        assert missing.get_json() == {'error': 'Customer not found'}

    def test_a_customer_is_served_with_their_orders_and_transfers(self, client, platform, authenticated_admin):
        body = client.get(f'/api/reporting/customers/{SEAN}', headers=authenticated_admin).get_json()

        assert body['name'] == 'Sean Cheema'
        assert [order['orderId'] for order in body['orders']] == [2, 1]
        assert [transfer['transferId'] for transfer in body['transfers']] == [4, 2]

    def test_an_analyst_or_admin_is_not_found_as_a_customer(self, client, platform, authenticated_admin):
        for staff in (ANALYST, ADMIN):
            response = client.get(f'/api/reporting/customers/{staff}', headers=authenticated_admin)
            assert response.status_code == 404, staff
