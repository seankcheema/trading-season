"""Verify V009 against disposable PostgreSQL, never a developer database.

Run directly with Python. PostgreSQL binaries must be on PATH.
"""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import tempfile
import unittest


class TermsAcceptancesMigrationTest(unittest.TestCase):
    EARLIER = ("V001__Initialize_database.sql", "V002__Add_watchlist.sql",
               "V003__Order_status_accepted.sql", "V008__Drop_account_status.sql")
    V009 = "V009__Add_terms_acceptances.sql"

    @classmethod
    def setUpClass(cls):
        psql = shutil.which("psql")
        if not psql:
            raise unittest.SkipTest("PostgreSQL binaries are unavailable")
        cls.bin = Path(psql).parent
        cls.temp = tempfile.TemporaryDirectory(prefix="terms-postgres-")
        cls.cluster = Path(cls.temp.name) / "data"
        cls.addClassCleanup(cls.cleanup)
        cls.flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.run_binary("initdb", "-D", str(cls.cluster), "-U", "terms_test", "-A", "trust", "--no-locale", "-E", "UTF8")
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
        return cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "terms_test",
                              "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql).strip()

    @classmethod
    def migrate(cls, database, name):
        cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "terms_test",
                       "-d", database, "-v", "ON_ERROR_STOP=1", "-f", str(cls.migrations / name))

    @classmethod
    def cleanup(cls):
        try:
            if (cls.cluster / "postmaster.pid").exists():
                cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-w", "stop")
        finally:
            cls.temp.cleanup()

    def test_fresh_and_retained_database(self):
        for name in ("terms_fresh", "terms_retained"):
            self.sql("postgres", f"CREATE DATABASE {name}")
            for earlier in self.EARLIER:
                self.migrate(name, earlier)
            if name == "terms_fresh":
                self.migrate(name, self.V009)
            client = "00000000-0000-4000-8000-000000000001"
            stranger = "00000000-0000-4000-8000-000000000002"
            self.sql(name, f"""
                INSERT INTO user_accounts(user_id,email,password_hash) VALUES ('{client}','fixture@example.test','fixture');
                INSERT INTO users(user_id,first_name,last_name,ssn,address,date_of_birth,available_funds)
                VALUES ('{client}','Test','Trader','fixture','fixture','2000-01-01',123.45);
            """)
            self.migrate(name, self.V009)
            self.sql(name, f"INSERT INTO terms_acceptances(user_id,terms_version) VALUES ('{client}','2026-10-08')")
            accepted_at = self.sql(name, "SELECT accepted_at FROM terms_acceptances")
            self.assertTrue(accepted_at)

            # Reapplying keeps the recorded acceptance and leaves the client row alone.
            self.migrate(name, self.V009)
            self.assertEqual(accepted_at, self.sql(name, "SELECT accepted_at FROM terms_acceptances"))
            self.assertEqual("123.45", self.sql(name, "SELECT available_funds FROM users"))

            # One row per client and version; a later version is a new row.
            with self.assertRaises(subprocess.CalledProcessError):
                self.sql(name, f"INSERT INTO terms_acceptances(user_id,terms_version) VALUES ('{client}','2026-10-08')")
            self.sql(name, f"INSERT INTO terms_acceptances(user_id,terms_version) VALUES ('{client}','2027-01-01')")
            self.assertEqual("2", self.sql(name, "SELECT count(*) FROM terms_acceptances"))

            with self.assertRaises(subprocess.CalledProcessError):
                self.sql(name, f"INSERT INTO terms_acceptances(user_id,terms_version) VALUES ('{client}','')")
            with self.assertRaises(subprocess.CalledProcessError):
                self.sql(name, f"INSERT INTO terms_acceptances(user_id,terms_version) VALUES ('{stranger}','2026-10-08')")

            # An acceptance is a record: removing the client must not silently remove it.
            with self.assertRaises(subprocess.CalledProcessError):
                self.sql(name, f"DELETE FROM users WHERE user_id='{client}'")
            self.assertEqual("2", self.sql(name, "SELECT count(*) FROM terms_acceptances"))


if __name__ == "__main__":
    unittest.main()
