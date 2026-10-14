"""Verify V012 against disposable PostgreSQL, never a developer database.

BR-12: an instrument of any class (UK, US or Indian equity, FX, crypto) can
link to a simulated price series through instruments.simulated_stock_symbol.
Run directly with Python. PostgreSQL binaries must be on PATH.
"""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import tempfile
import unittest


class InstrumentPriceLinksMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        psql = shutil.which("psql")
        if not psql:
            raise unittest.SkipTest("PostgreSQL binaries are unavailable")
        cls.bin = Path(psql).parent
        cls.temp = tempfile.TemporaryDirectory(prefix="instrument-links-postgres-")
        cls.cluster = Path(cls.temp.name) / "data"
        cls.addClassCleanup(cls.cleanup)
        cls.flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.run_binary("initdb", "-D", str(cls.cluster), "-U", "links_test", "-A", "trust", "--no-locale", "-E", "UTF8")
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
        return cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "links_test",
                              "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql).strip()

    @classmethod
    def migrate(cls, database, name):
        cls.run_binary("psql", "-h", "127.0.0.1", "-p", str(cls.port), "-U", "links_test",
                       "-d", database, "-v", "ON_ERROR_STOP=1", "-f", str(cls.migrations / name))

    @classmethod
    def cleanup(cls):
        try:
            if (cls.cluster / "postmaster.pid").exists():
                cls.run_binary("pg_ctl", "-D", str(cls.cluster), "-w", "stop")
        finally:
            cls.temp.cleanup()

    def test_every_instrument_class_can_link_to_a_price_series(self):
        database = "instrument_links"
        self.sql("postgres", f"CREATE DATABASE {database}")
        for path in sorted(self.migrations.glob("V*.sql")):
            if path.name.startswith("V012"):
                continue
            self.migrate(database, path.name)
        self.sql(database, """
            INSERT INTO stocks(symbol,company_name,starting_price,sector,average_volume,base_volatility)
            VALUES ('AAPL','Apple',100,'Technology',1000,0.01),
                   ('EUR','Euro / US Dollar',1.08,'Foreign Exchange',1000,0.01),
                   ('BTC','Bitcoin / US Dollar',65000,'Crypto Assets',1000,0.01),
                   ('VOD','Vodafone Group',9.5,'Telecommunications',1000,0.01);
            INSERT INTO instruments(ticker,name,asset_class,market,currency,is_tradable,simulated_stock_symbol)
            VALUES ('AAPL','Apple','Equity','US','USD',TRUE,'AAPL');
        """)
        fx = ("INSERT INTO instruments(ticker,name,asset_class,market,currency,is_tradable,simulated_stock_symbol) "
              "VALUES ('EURUSD','Euro / US Dollar','FX',NULL,'USD',TRUE,'EUR')")
        with self.assertRaises(subprocess.CalledProcessError):
            self.sql(database, fx)
        self.migrate(database, "V012__Instrument_price_links.sql")
        self.sql(database, fx)
        self.sql(database, """
            INSERT INTO instruments(ticker,name,asset_class,market,currency,is_tradable,simulated_stock_symbol)
            VALUES ('BTCUSD','Bitcoin / US Dollar','Crypto',NULL,'USD',TRUE,'BTC'),
                   ('VOD','Vodafone Group','Equity','UK','USD',TRUE,'VOD');
        """)
        self.migrate(database, "V012__Instrument_price_links.sql")
        self.assertEqual("4", self.sql(database, "SELECT count(*) FROM instruments WHERE simulated_stock_symbol IS NOT NULL"))
        with self.assertRaises(subprocess.CalledProcessError):
            self.sql(database, "INSERT INTO instruments(ticker,name,asset_class,market,currency,is_tradable,simulated_stock_symbol) "
                               "VALUES ('ETHUSD','Ether','Crypto',NULL,'USD',TRUE,'NOPE')")


if __name__ == "__main__":
    unittest.main()
