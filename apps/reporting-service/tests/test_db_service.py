"""The two read-only lookups the reporting service keeps."""

import uuid

from db_service import AccountRepository, UserRepository


class TestUserRepository:

    def test_get_user(self, test_user):
        user = UserRepository.get_user(test_user.user_id)

        assert user is not None
        assert user.first_name == 'Joanna'

    def test_get_user_not_found(self, db_session):
        assert UserRepository.get_user(uuid.uuid4()) is None


class TestAccountRepository:

    def test_get_user_accounts(self, test_user, test_account):
        accounts = AccountRepository.get_user_accounts(test_user.user_id)

        assert [account.account_id for account in accounts] == [test_account.account_id]

    def test_get_account(self, test_account):
        account = AccountRepository.get_account(test_account.account_id)

        assert account is not None
        assert account.name == 'Growth Portfolio'

    def test_get_account_not_found(self, db_session):
        assert AccountRepository.get_account(99999) is None
