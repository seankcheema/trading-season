"""The demo history: what the traders are planned to do, before any of it is written."""

import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import seed_demo_history as seed  # noqa: E402
from seed_demo_history import (Instrument, OrderAction, Prices, Transfer, new_state, plan_day,  # noqa: E402
                               plan_history)

INSTRUMENTS = [Instrument(1, 'AAPL', Decimal('224.15')), Instrument(4, 'JPM', Decimal('210.25')),
               Instrument(7, 'NVDA', Decimal('900.15')), Instrument(10, 'XOM', Decimal('118.80'))]
NOW = datetime(2026, 10, 12, 16, 45, tzinfo=timezone.utc)   # a Monday afternoon
START = NOW.date() - timedelta(days=90)


def history(trader, first=START, last=NOW.date(), until=NOW, state=None):
    state = state if state is not None else new_state(trader)
    return plan_history(trader, first, last, state, INSTRUMENTS, Prices(INSTRUMENTS), until=until), state


def replay(trader, actions):
    """Apply the plan the way the ledgers would, checking nothing ever goes below zero."""
    funds, holdings = Decimal(trader.opening), {}
    for action in actions:
        if isinstance(action, Transfer):
            funds += action.amount
        elif action.status == 'FILLED':
            position = (action.account_index, action.instrument_id)
            signed = action.quantity if action.side == 'BUY' else -action.quantity
            holdings[position] = holdings.get(position, Decimal(0)) + signed
            funds -= signed * action.price
            assert holdings[position] >= 0, f'sold more than held: {action}'
        assert funds >= 0, f'spent more than there was: {action}'
    return funds, holdings


class TestThePlan:

    @pytest.mark.parametrize('trader', seed.TRADERS, ids=lambda trader: trader.slug)
    def test_a_traders_history_never_overspends_or_oversells_and_ends_where_the_state_says(self, trader):
        actions, state = history(trader)

        funds, holdings = replay(trader, actions)

        assert funds == state['funds']
        assert holdings == state['holdings']

    def test_the_same_trader_and_days_always_plan_the_same_history(self):
        trader = seed.TRADERS[0]

        assert history(trader)[0] == history(trader)[0]

    def test_planning_in_two_runs_gives_the_history_one_run_would(self):
        trader = seed.TRADERS[1]
        whole, _ = history(trader)
        split = START + timedelta(days=40)

        first, state = history(trader, last=split)
        second, _ = history(trader, first=split + timedelta(days=1), state=state)

        assert first + second == whole

    def test_everything_is_in_time_order_and_nothing_is_in_the_future(self):
        for trader in seed.TRADERS:
            times = [action.at for action in history(trader)[0]]

            assert times == sorted(times)
            assert all(at < NOW for at in times)
            assert all(at.date() >= START for at in times)

    def test_the_cohort_was_active_recently_and_long_ago_and_today(self):
        times = [action.at for trader in seed.TRADERS for action in history(trader)[0]]

        assert any(at.date() == NOW.date() for at in times), 'something happened today'
        assert sum(1 for at in times if at > NOW - timedelta(days=7)) >= 10, 'a busy last week'
        assert any(at < NOW - timedelta(days=75) for at in times), 'and history from months back'

    def test_there_is_enough_of_everything_for_the_console_to_show(self):
        actions = [action for trader in seed.TRADERS for action in history(trader)[0]]
        orders = [action for action in actions if isinstance(action, OrderAction)]
        rejected = [order for order in orders if order.status == 'REJECTED']

        assert len(orders) > 300
        assert 0.03 < len(rejected) / len(orders) < 0.15
        assert {order.reason for order in rejected} == {seed.REJECTED_FUNDS, seed.REJECTED_HOLDINGS}
        assert all(order.reason is None for order in orders if order.status == 'FILLED')
        assert {order.side for order in orders if order.status == 'FILLED'} == {'BUY', 'SELL'}
        assert {action.reason for action in actions if isinstance(action, Transfer)} == {'DEPOSIT', 'WITHDRAWAL'}
        assert len({order.instrument_id for order in orders}) == len(INSTRUMENTS)

    def test_a_rejected_order_asks_for_more_than_there_is_and_changes_nothing(self):
        for trader in seed.TRADERS:
            funds, holdings = Decimal(trader.opening), {}
            for action in history(trader)[0]:
                if isinstance(action, Transfer):
                    funds += action.amount
                    continue
                position = (action.account_index, action.instrument_id)
                if action.status == 'REJECTED' and action.side == 'BUY':
                    assert action.quantity * action.price > funds
                elif action.status == 'REJECTED':
                    assert action.quantity > holdings.get(position, 0)
                else:
                    signed = action.quantity if action.side == 'BUY' else -action.quantity
                    holdings[position] = holdings.get(position, Decimal(0)) + signed
                    funds -= signed * action.price

    def test_nobody_trades_at_the_weekend_or_before_they_joined(self):
        trader = seed.TRADERS[-1]   # the newest of them
        joined = NOW.date() - timedelta(days=trader.joined_days_ago)
        actions, _ = history(trader, first=joined)

        assert actions, 'even the trader who joined last has done something'
        assert all(action.at.date() >= joined for action in actions)
        orders = [action for trader in seed.TRADERS for action in history(trader)[0]
                  if isinstance(action, OrderAction)]
        assert all(order.at.weekday() < 5 for order in orders)

    def test_only_the_traders_second_account_names_are_used_when_they_have_one(self):
        for trader in seed.TRADERS:
            indexes = {action.account_index for action in history(trader)[0] if isinstance(action, OrderAction)}

            assert indexes <= set(range(len(trader.accounts)))


class TestToday:

    def test_what_happens_today_is_the_same_whenever_the_tool_runs_only_earlier_in_the_day(self):
        trader = seed.TRADERS[0]
        prices = Prices(INSTRUMENTS)
        day = next(NOW.date() - timedelta(days=offset) for offset in range(0, 30)
                   if plan_day(trader, NOW.date() - timedelta(days=offset), new_state(trader), INSTRUMENTS, prices))
        whole = plan_day(trader, day, new_state(trader), INSTRUMENTS, prices)
        midday = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=15)

        early = plan_day(trader, day, new_state(trader), INSTRUMENTS, prices, until=midday)

        def what(actions):
            return [action._replace(at=None) for action in actions]

        assert what(early) == what(whole)
        assert all(action.at < midday for action in early)

    def test_before_the_market_opens_today_uses_the_small_hours(self):
        trader = seed.TRADERS[0]
        dawn = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)

        actions = plan_day(trader, dawn.date(), new_state(trader), INSTRUMENTS, Prices(INSTRUMENTS), until=dawn)

        assert all(action.at < dawn for action in actions)

    def test_in_the_first_minutes_of_a_day_nothing_is_planned_yet(self):
        trader = seed.TRADERS[0]
        midnight = datetime(2026, 10, 12, 0, 3, tzinfo=timezone.utc)

        assert plan_day(trader, midnight.date(), new_state(trader), INSTRUMENTS, Prices(INSTRUMENTS),
                        until=midnight) == []


class TestPrices:

    def test_a_price_on_a_day_is_the_same_however_it_is_reached(self):
        forwards, backwards = Prices(INSTRUMENTS), Prices(INSTRUMENTS)
        days = [date(2026, 7, 1) + timedelta(days=offset) for offset in range(0, 100, 7)]

        up = [forwards.on(7, day) for day in days]
        down = [backwards.on(7, day) for day in reversed(days)]

        assert up == list(reversed(down))

    def test_prices_are_positive_cents_near_their_base_and_move(self):
        prices = Prices(INSTRUMENTS)
        series = [prices.on(1, date(2026, 7, 14) + timedelta(days=offset)) for offset in range(90)]

        assert all(price > 0 and price == price.quantize(Decimal('0.01')) for price in series)
        assert Decimal('60') < min(series) and max(series) < Decimal('800')
        assert len(set(series)) > 60

    def test_a_day_before_the_anchor_is_the_base_price(self):
        assert Prices(INSTRUMENTS).on(1, date(2025, 6, 1)) == Decimal('224.15')


class TestIdentities:

    def test_a_trader_has_the_same_id_every_run_and_no_two_share_one(self):
        ids = [seed.user_id(trader.slug) for trader in seed.TRADERS] + [seed.user_id(seed.SIGN_UP_ONLY[0])]

        assert ids == [seed.user_id(trader.slug) for trader in seed.TRADERS] + [seed.user_id(seed.SIGN_UP_ONLY[0])]
        assert len(set(ids)) == len(seed.TRADERS) + 1

    def test_demo_sign_ins_use_a_domain_that_can_never_be_real(self):
        assert seed.email('amara.okafor') == 'amara.okafor@demo.tradingseason.example'

    def test_every_level_is_represented_and_one_trader_is_locked(self):
        assert {trader.level for trader in seed.TRADERS} == {'BEGINNER', 'INTERMEDIATE', 'ADVANCED'}
        assert sum(1 for trader in seed.TRADERS if trader.locked) == 1

    def test_the_history_reaches_back_twice_the_longest_range_reporting_shows(self):
        assert seed.HISTORY_DAYS == 180
        joined = sorted(trader.joined_days_ago for trader in seed.TRADERS)
        assert joined[-1] == seed.HISTORY_DAYS, 'someone has been there from the start'
        assert sum(1 for days in joined if days > 90) >= 4, 'so the period before the last 90 days is not empty'
        assert joined[0] <= 30, 'and someone joined within the last month'


class TestCommandLine:

    def test_the_database_url_is_required(self, monkeypatch, capsys):
        monkeypatch.delenv('DATABASE_URL', raising=False)

        with pytest.raises(SystemExit):
            seed.parse_arguments([])

        assert '--database-url or DATABASE_URL is required' in capsys.readouterr().err

    def test_days_must_be_positive(self, capsys):
        with pytest.raises(SystemExit):
            seed.parse_arguments(['--database-url', 'postgresql://ignored', '--days', '0'])

        assert '--days must be at least 1' in capsys.readouterr().err
