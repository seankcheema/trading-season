"""The ORM models mirror the real users and accounts tables."""

from datetime import date
from decimal import Decimal

from sqlalchemy import inspect


class TestUserModel:

    def test_user_round_trips(self, db_session, test_user):
        from models import User

        user = db_session.get(User, test_user.user_id)

        assert user.first_name == 'Joanna'
        assert user.date_of_birth == date(1990, 1, 1)
        assert user.available_funds == Decimal('50000.00')
        assert user.session_timeout_minutes == 10
        assert user.execution_buffer_percent == Decimal('0')
        assert user.created_at is not None
        assert repr(user) == f'<User {user.user_id}>'

    def test_user_columns_match_the_migration(self):
        from models import User

        columns = {column.name for column in inspect(User).columns}

        assert columns == {
            'user_id', 'first_name', 'middle_name', 'last_name', 'ssn', 'address', 'date_of_birth',
            'trader_level', 'available_funds', 'session_timeout_minutes', 'execution_buffer_percent',
            'last_activity_at', 'created_at',
        }


class TestAccountModel:

    def test_account_round_trips_and_links_to_its_user(self, db_session, test_user, test_account):
        from models import Account

        account = db_session.get(Account, test_account.account_id)

        assert account.name == 'Growth Portfolio'
        assert account.currency == 'USD'
        assert account.opened_date == date(2026, 1, 15)
        assert account.user.user_id == test_user.user_id
        assert test_user.accounts == [account]
        assert repr(account) == f'<Account {account.account_id} Growth Portfolio>'

    def test_account_columns_match_the_migration(self):
        from models import Account

        columns = {column.name for column in inspect(Account).columns}

        assert columns == {'account_id', 'user_id', 'name', 'cash_balance', 'opened_date', 'currency'}
