"""Verify V013 against disposable PostgreSQL, never a developer database.

BR-10 and section 9.1: cash_transactions.client_reference lets a retried deposit
or withdrawal post once. Run directly with Python. PostgreSQL binaries must be
on PATH.
"""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import tempfile
import unittest

OWNER = "00000000-0000-4000-8000-000000000003"
FIXTURE = f"""
    INSERT INTO user_accounts(user_id,email,password_hash) VALUES ('{OWNER}','cash@example.test','fixture');
    INSERT INTO users(user_id,first_name,last_name,ssn,address,date_of_birth,available_funds)
    VALUES ('{OWNER}','Test','Trader','fixture','fixture','2000-01-01',5000);
    INSERT INTO accounts(account_id,user_id,name) VALUES (1,'{OWNER}','Main');
"""


class CashTransactionReferenceMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        psql = shutil.which("psql")
        if not psql:
            raise unittest.SkipTest("PostgreSQL binaries are unavailable")
        cls.bin = Path(psql).parent
        cls.temp = tempfile.TemporaryDirectory(prefix="cash-reference-postgres-")
        cls.cluster = Path(cls.temp.name) / "data"
        cls.addClassCleanup(cls.cleanup)
        cls.flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.run_binary("initdb", "-D", str(cls.cluster), "-U", "cash_test", "-A", "trust", "--no-locale", "-E", "UTF8")
        cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-l", str(Path(cls.temp.name) / "postgres.log"),
                       "-o", f"-h 127.0.0.1 -p {cls.port}", "-w", "start")
        cls.migrations = Path(__file__).resolve().parents[6] / "db" / "migrations"
        cls.database = "cash_reference"
        cls.sql("postgres", f"CREATE DATABASE {cls.database}")
        for path in sorted(cls.migrations.glob("V*.sql")):
            cls.migrate(path.name)
        cls.migrate("V013__Cash_transaction_client_reference.sql")  # safe to reapply
        cls.sql(cls.database, FIXTURE)

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
        return cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "cash_test",
                              "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql).strip()

    @classmethod
    def migrate(cls, name):
        cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "cash_test",
                       "-d", cls.database, "-v", "ON_ERROR_STOP=1", "-f", str(cls.migrations / name))

    @classmethod
    def cleanup(cls):
        try:
            if (cls.cluster / "postmaster.pid").exists():
                cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-w", "stop")
        finally:
            cls.temp.cleanup()

    def test_a_client_reference_posts_once_and_rows_without_one_stay_distinct(self):
        deposit = ("INSERT INTO cash_transactions(account_id,amount,reason,client_reference) "
                   "VALUES (1,100,'DEPOSIT','20000000-0000-4000-8000-000000000001')")
        self.sql(self.database, deposit)
        with self.assertRaises(subprocess.CalledProcessError) as raised:
            self.sql(self.database, deposit)
        self.assertIn("cash_transactions_client_reference_key", raised.exception.stderr)

        # Rows that carry no reference, such as order fills and history from before V013, never collide.
        self.sql(self.database, "INSERT INTO cash_transactions(account_id,amount,reason) VALUES (1,50,'DEPOSIT')")
        self.sql(self.database, "INSERT INTO cash_transactions(account_id,amount,reason) VALUES (1,-20,'WITHDRAWAL')")
        self.assertEqual("3", self.sql(self.database, "SELECT count(*) FROM cash_transactions"))
        self.assertEqual("1", self.sql(self.database, "SELECT count(*) FROM cash_transactions WHERE client_reference IS NOT NULL"))


if __name__ == "__main__":
    unittest.main()
