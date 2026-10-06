"""
Read-only lookups against the two trading tables the reporting service uses.
"""

from models import Account, User


class UserRepository:
    """Reads trader profiles."""

    @staticmethod
    def get_user(user_id):
        """Return the user with this id, or None."""
        return User.query.filter_by(user_id=user_id).first()


class AccountRepository:
    """Reads accounts, for ownership checks and for naming accounts in reports."""

    @staticmethod
    def get_user_accounts(user_id):
        """Return every account owned by this user."""
        return Account.query.filter_by(user_id=user_id).all()

    @staticmethod
    def get_account(account_id):
        """Return the account with this id, or None."""
        return Account.query.filter_by(account_id=account_id).first()
