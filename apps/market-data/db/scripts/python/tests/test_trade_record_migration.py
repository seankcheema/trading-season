"""Verify V010 and V011 against disposable PostgreSQL, never a developer database.

Run directly with Python. PostgreSQL binaries must be on PATH.
"""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import tempfile
import unittest

OWNER = "00000000-0000-4000-8000-000000000001"
OTHER = "00000000-0000-4000-8000-000000000002"


class TradeRecordMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        psql = shutil.which("psql")
        if not psql:
            raise unittest.SkipTest("PostgreSQL binaries are unavailable")
        cls.bin = Path(psql).parent
        cls.temp = tempfile.TemporaryDirectory(prefix="trade-record-postgres-")
        cls.cluster = Path(cls.temp.name) / "data"
        cls.addClassCleanup(cls.cleanup)
        cls.flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.run_binary("initdb", "-D", str(cls.cluster), "-U", "trade_record_test", "-A", "trust", "--no-locale", "-E", "UTF8")
        cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-l", str(Path(cls.temp.name) / "postgres.log"),
                       "-o", f"-h 127.0.0.1 -p {cls.port}", "-w", "start")
        cls.migrations = Path(__file__).resolve().parents[6] / "db" / "migrations"

    @classmethod
    def run_binary(cls, name, *args):
        if name == "pg_ctl":
            # Windows background children can inherit pipe handles and prevent communicate() from ending.
            with tempfile.TemporaryFile(mode="w+") as output:
                result = subprocess.run([str(cls.bin / name), *args], stdout=output, stderr=output,
                                        text=True, creationflags=cls.flags, timeout=75)
                output.seek(0)
                message = output.read()
                if result.returncode:
                    raise RuntimeError(message)
                return message
        return subprocess.run([str(cls.bin / name), *args], check=True, capture_output=True,
                              text=True, creationflags=cls.flags, timeout=75).stdout

    @classmethod
    def sql(cls, database, sql):
        return cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "trade_record_test",
                              "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql).strip()

    @classmethod
    def migrate(cls, database, name):
        cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "trade_record_test",
                       "-d", database, "-v", "ON_ERROR_STOP=1", "-f", str(cls.migrations / name))

    @classmethod
    def cleanup(cls):
        try:
            if (cls.cluster / "postmaster.pid").exists():
                cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-w", "stop")
        finally:
            cls.temp.cleanup()

    def assertRejected(self, database, sql):
        with self.assertRaises(subprocess.CalledProcessError) as raised:
            self.sql(database, sql)
        return raised.exception.stderr

    def create_database(self, name):
        self.sql("postgres", f"CREATE DATABASE {name}")
        for migration in ("V001__Initialize_database.sql", "V002__Add_watchlist.sql",
                          "V009__Add_terms_acceptance_to_users.sql"):
            self.migrate(name, migration)
        self.sql(name, f"""
            INSERT INTO user_accounts(user_id,email,password_hash) VALUES
                ('{OWNER}','owner@example.test','fixture'), ('{OTHER}','other@example.test','fixture');
            INSERT INTO users(user_id,first_name,last_name,ssn,address,date_of_birth,available_funds) VALUES
                ('{OWNER}','Test','Trader','fixture','fixture','2000-01-01',1000),
                ('{OTHER}','Other','Trader','fixture','fixture','2000-01-01',1000);
            INSERT INTO accounts(account_id,user_id,name) VALUES (1,'{OWNER}','Main');
            INSERT INTO instruments(instrument_id,ticker,name,asset_class,market,currency)
                VALUES (900,'ZZZT','Fixture','Equity','US','USD');
        """)

    def place_order(self, database, order_id):
        self.sql(database, f"""
            INSERT INTO orders(order_id,account_id,instrument_id,client_reference,order_type,quantity,indicative_price)
            VALUES ({order_id},1,900,gen_random_uuid(),'BUY',2,10);
            INSERT INTO audit_trail(order_id,event_type) VALUES ({order_id},'PENDING');
        """)

    def test_fill_flow_is_allowed_and_then_final(self):
        db = "trade_record_flow"
        self.create_database(db)
        self.migrate(db, "V010__Protect_trade_records.sql")
        self.place_order(db, 1)

        self.sql(db, "UPDATE orders SET accepted_at = now() WHERE order_id = 1")
        self.sql(db, """
            INSERT INTO fills(fill_id,order_id,quote_price,quantity) VALUES (1,1,10,2);
            INSERT INTO cash_transactions(account_id,fill_id,amount,reason) VALUES (1,1,-20,'ORDER_FILL');
            INSERT INTO holding_movements(account_id,instrument_id,fill_id,quantity_delta) VALUES (1,900,1,2);
            UPDATE users SET available_funds = available_funds - 20;
            INSERT INTO holdings(account_id,instrument_id,quantity) VALUES (1,900,2);
            UPDATE orders SET status = 'FILLED', resolved_at = now() WHERE order_id = 1;
            INSERT INTO audit_trail(order_id,event_type,detail) VALUES (1,'FILLED','Filled 2 @ 10');
        """)

        self.assertIn("final", self.assertRejected(db, "UPDATE orders SET status = 'REJECTED' WHERE order_id = 1"))
        self.assertIn("permanent", self.assertRejected(db, "DELETE FROM orders WHERE order_id = 1"))
        for table in ("audit_trail", "fills", "cash_transactions", "holding_movements"):
            with self.subTest(table=table):
                self.assertIn("permanent", self.assertRejected(db, f"DELETE FROM {table}"))
                self.assertIn("permanent", self.assertRejected(db, f"TRUNCATE {table} CASCADE"))
        self.assertRejected(db, "UPDATE fills SET quote_price = 11")
        self.assertRejected(db, "UPDATE cash_transactions SET amount = 0")
        self.assertRejected(db, "UPDATE holding_movements SET quantity_delta = 0")
        self.assertRejected(db, "UPDATE audit_trail SET detail = 'rewritten'")

        # Cached balances stay writable; the ledgers above are the record.
        self.sql(db, "UPDATE holdings SET quantity = 2 WHERE account_id = 1")
        self.assertEqual("980.00", self.sql(db, f"SELECT available_funds FROM users WHERE user_id = '{OWNER}'"))
        self.assertEqual("2|1|1|1", self.sql(db, """
            SELECT (SELECT count(*) FROM audit_trail), (SELECT count(*) FROM fills),
                   (SELECT count(*) FROM cash_transactions), (SELECT count(*) FROM holding_movements)
        """))

    def test_pending_order_terms_and_acceptance_cannot_change(self):
        db = "trade_record_terms"
        self.create_database(db)
        self.migrate(db, "V010__Protect_trade_records.sql")
        self.place_order(db, 2)

        self.assertIn("submitted terms", self.assertRejected(db, "UPDATE orders SET quantity = 3 WHERE order_id = 2"))
        self.assertRejected(db, "UPDATE orders SET indicative_price = 9 WHERE order_id = 2")
        self.assertRejected(db, "UPDATE orders SET buffer_percent = 1 WHERE order_id = 2")
        self.sql(db, "UPDATE orders SET accepted_at = '2026-10-06T12:00:00Z' WHERE order_id = 2")
        self.assertIn("acceptance time",
                      self.assertRejected(db, "UPDATE orders SET accepted_at = now() WHERE order_id = 2"))
        self.sql(db, "UPDATE orders SET status = 'REJECTED', rejection_reason = 'BR-09', resolved_at = now() WHERE order_id = 2")
        self.assertEqual("REJECTED", self.sql(db, "SELECT status FROM orders WHERE order_id = 2"))

    def test_accounts_can_be_renamed_but_not_removed_or_reassigned(self):
        db = "trade_record_accounts"
        self.create_database(db)
        self.migrate(db, "V010__Protect_trade_records.sql")

        self.sql(db, "UPDATE accounts SET name = 'Renamed' WHERE account_id = 1")
        self.assertIn("another user",
                      self.assertRejected(db, f"UPDATE accounts SET user_id = '{OTHER}' WHERE account_id = 1"))
        self.assertRejected(db, "DELETE FROM accounts WHERE account_id = 1")
        self.assertRejected(db, "TRUNCATE accounts CASCADE")
        self.assertEqual("Renamed", self.sql(db, "SELECT name FROM accounts WHERE account_id = 1"))

    def test_retained_database_keeps_history_and_migration_reruns(self):
        db = "trade_record_retained"
        self.create_database(db)
        self.place_order(db, 3)
        self.migrate(db, "V010__Protect_trade_records.sql")
        self.migrate(db, "V010__Protect_trade_records.sql")

        self.assertEqual("1|1", self.sql(db, "SELECT (SELECT count(*) FROM orders), (SELECT count(*) FROM audit_trail)"))
        self.assertRejected(db, "DELETE FROM audit_trail")
        self.assertEqual("14", self.sql(db, """
            SELECT count(*) FROM pg_trigger
            WHERE NOT tgisinternal AND tgname LIKE ANY (ARRAY['%append_only','%no_truncate','%no_delete','%guard%'])
        """))


    def test_client_identity_is_fixed_and_users_are_never_removed(self):
        db = "trade_record_identity"
        self.create_database(db)
        self.migrate(db, "V010__Protect_trade_records.sql")
        self.migrate(db, "V011__Protect_client_identity.sql")
        self.migrate(db, "V011__Protect_client_identity.sql")

        # Profile details, settings and the cached balance stay writable.
        self.sql(db, f"UPDATE users SET address = 'Moved', available_funds = 5 WHERE user_id = '{OWNER}'")
        for change in ("first_name = 'Changed'", "middle_name = 'Changed'", "last_name = 'Changed'",
                       "ssn = 'changed'", "date_of_birth = '1999-01-01'", f"user_id = '{OTHER}'"):
            with self.subTest(change=change):
                self.assertIn("identity",
                              self.assertRejected(db, f"UPDATE users SET {change} WHERE user_id = '{OWNER}'"))

        self.sql(db, f"UPDATE users SET terms_accepted_at = '2026-10-08T12:00:00Z' WHERE user_id = '{OWNER}'")
        self.assertIn("terms acceptance",
                      self.assertRejected(db, f"UPDATE users SET terms_accepted_at = now() WHERE user_id = '{OWNER}'"))
        self.assertRejected(db, f"UPDATE users SET terms_accepted_at = NULL WHERE user_id = '{OWNER}'")

        # OTHER owns no account, so only the trigger stands between it and removal.
        self.assertIn("permanent", self.assertRejected(db, f"DELETE FROM users WHERE user_id = '{OTHER}'"))
        self.assertIn("permanent", self.assertRejected(db, "TRUNCATE users CASCADE"))

        self.sql(db, f"UPDATE user_accounts SET failed_login_attempts = 1, password_hash = 'rotated' WHERE user_id = '{OWNER}'")
        self.assertIn("sign-in identity", self.assertRejected(
            db, f"UPDATE user_accounts SET email = 'changed@example.test' WHERE user_id = '{OWNER}'"))
        self.assertIn("permanent", self.assertRejected(db, f"DELETE FROM user_accounts WHERE user_id = '{OTHER}'"))
        self.assertIn("permanent", self.assertRejected(db, "TRUNCATE user_accounts CASCADE"))

        self.assertEqual("Test|Trader|Moved|owner@example.test|2", self.sql(db, f"""
            SELECT first_name, last_name, address,
                   (SELECT email FROM user_accounts WHERE user_id = '{OWNER}'), (SELECT count(*) FROM users)
            FROM users WHERE user_id = '{OWNER}'
        """))


if __name__ == "__main__":
    unittest.main()
