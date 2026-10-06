"""Verify V002 against disposable PostgreSQL, never a developer database.

Run directly with Python. PostgreSQL binaries must be on PATH.
"""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import tempfile
import unittest


class WatchlistMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        psql = shutil.which("psql")
        if not psql:
            raise unittest.SkipTest("PostgreSQL binaries are unavailable")
        cls.bin = Path(psql).parent
        cls.temp = tempfile.TemporaryDirectory(prefix="watchlist-postgres-")
        cls.cluster = Path(cls.temp.name) / "data"
        cls.addClassCleanup(cls.cleanup)
        cls.flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.run_binary("initdb", "-D", str(cls.cluster), "-U", "watchlist_test", "-A", "trust", "--no-locale", "-E", "UTF8")
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
        return cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "watchlist_test",
                              "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql).strip()

    @classmethod
    def migrate(cls, database, name):
        cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "watchlist_test",
                       "-d", database, "-v", "ON_ERROR_STOP=1", "-f", str(cls.migrations / name))

    @classmethod
    def cleanup(cls):
        try:
            if (cls.cluster / "postmaster.pid").exists():
                cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-w", "stop")
        finally:
            cls.temp.cleanup()

    def test_fresh_and_retained_database(self):
        for name in ("watchlist_fresh", "watchlist_retained"):
            self.sql("postgres", f"CREATE DATABASE {name}")
            self.migrate(name, "V001__Initialize_database.sql")
            if name == "watchlist_fresh":
                self.migrate(name, "V002__Add_watchlist.sql")
            owner = "00000000-0000-4000-8000-000000000001"
            self.sql(name, f"""
                INSERT INTO user_accounts(user_id,email,password_hash) VALUES ('{owner}','fixture@example.test','fixture');
                INSERT INTO users(user_id,first_name,last_name,ssn,address,date_of_birth,available_funds)
                VALUES ('{owner}','Test','Trader','fixture','fixture','2000-01-01',123.45);
                INSERT INTO stocks(symbol,company_name,starting_price,sector,average_volume,base_volatility)
                VALUES ('AAPL','Apple',100,'Technology',1000,0.01);
            """)
            self.migrate(name, "V002__Add_watchlist.sql")
            self.sql(name, f"INSERT INTO user_watchlist(user_id,symbol) VALUES ('{owner}','AAPL')")
            self.migrate(name, "V002__Add_watchlist.sql")
            self.assertEqual("123.45", self.sql(name, "SELECT available_funds FROM users"))
            self.assertEqual("1", self.sql(name, "SELECT count(*) FROM user_watchlist"))
            with self.assertRaises(subprocess.CalledProcessError):
                self.sql(name, f"INSERT INTO user_watchlist(user_id,symbol) VALUES ('{owner}','AAPL')")
            with self.assertRaises(subprocess.CalledProcessError):
                self.sql(name, f"INSERT INTO user_watchlist(user_id,symbol) VALUES ('{owner}','NOPE')")
            self.sql(name, "DELETE FROM stocks WHERE symbol='AAPL'")
            self.assertEqual("0", self.sql(name, "SELECT count(*) FROM user_watchlist"))


if __name__ == "__main__":
    unittest.main()
