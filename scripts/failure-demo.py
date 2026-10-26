#!/usr/bin/env python3
"""Interactive console that triggers and recovers the six LEAP failure tests.

Run it beside start-local-no-order.sh, which starts every service except Order
and Sell. This console starts Order and Sell itself, so it can stop, crash,
restart and misdeploy that one service while everything else keeps running,
and it routes Order and Sell's market quotes through a proxy it controls, so a
quote outage can be switched on and off without a restart. Database faults are
injected with a temporary trigger that matches only the one order the demo
places, and are always removed on reset and on exit.

Type a scenario number to trigger it, then reset to recover:

  1  Execution step down (BR-06)
  2  Failure midway through a fill (BR-09)
  3  Service restart (BR-14, 9.1)
  4  Failed deployment (BR-14)
  5  Quote source unavailable (BR-12)
  6  Tampered or expired token (BR-02, BR-03)

Standard library only; needs psql, node, Maven and a JDK 21, as the stack does.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import json
import os
import re
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    import readline  # noqa: F401  (line editing and history for input())
except ImportError:
    pass

REPO_ROOT = Path(__file__).resolve().parent.parent
ORDER_DIR = REPO_ROOT / "apps" / "order-and-sell-service"
AUTH_ENV_FILE = REPO_ROOT / "apps" / "auth-service" / ".env"

AUTH_URL = "http://127.0.0.1:3001"
HOLDINGS_URL = "http://127.0.0.1:8082"
BROKER_PORT = 29092
REQUIRED_JAVA = 21
FIRST_START_TIMEOUT = 600
RESTART_TIMEOUT = 300
SNAPSHOT_PATH = "/api/market/snapshot"
# Names the trigger and function that inject database faults, so cleanup can
# always find them, including ones left by a run that was killed.
FAULT = "failure_demo_fault"
FIELD_SEP = "\x1f"
RECORD_SEP = "\x1e"
UUID_PATTERN = re.compile(r"^[0-9a-fA-F-]{36}$")

SCENARIOS = {
    "1": "Execution step down (BR-06)",
    "2": "Failure midway through a fill (BR-09)",
    "3": "Service restart (BR-14, 9.1)",
    "4": "Failed deployment (BR-14)",
    "5": "Quote source unavailable (BR-12)",
    "6": "Tampered or expired token (BR-02, BR-03)",
}


class DemoError(Exception):
    """A step could not run; the message says why and what to do."""


# --- Output ---------------------------------------------------------------

def say(message=""):
    print(message, flush=True)


def ok(message):
    say(f"  [OK]   {message}")


def bad(message):
    say(f"  [FAIL] {message}")


def note(message):
    say(f"         {message}")


def step(message):
    say(f"  ...    {message}")


def heading(number):
    say()
    say(f"=== {number}. {SCENARIOS[number]} ===")


# --- Environment ----------------------------------------------------------

def env_file_value(name, default=""):
    """Reads one value from apps/auth-service/.env, as start-local.sh does."""
    if not AUTH_ENV_FILE.is_file():
        return default
    value = default
    for line in AUTH_ENV_FILE.read_text().splitlines():
        if line.startswith(name + "="):
            value = line[len(name) + 1:]
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value


def port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def port_holder(port):
    result = subprocess.run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"], capture_output=True, text=True)
    lines = result.stdout.splitlines()
    if len(lines) < 2:
        return "another process"
    fields = lines[1].split()
    return f"{fields[0]} (pid {fields[1]})"


def java_major(home):
    try:
        result = subprocess.run([str(Path(home) / "bin" / "java"), "-version"], capture_output=True, text=True)
    except OSError:
        return 0
    match = re.search(r'"(\d+)', result.stderr)
    return int(match.group(1)) if match else 0


def find_java_home():
    """The same search order as start-local.sh: JAVA_HOME, then JDK 21, then any newer one."""
    def java_home_tool(version):
        try:
            return subprocess.run(["/usr/libexec/java_home", "-v", version],
                                  capture_output=True, text=True).stdout.strip()
        except OSError:
            return ""

    candidates = [
        os.environ.get("JAVA_HOME", ""),
        java_home_tool(str(REQUIRED_JAVA)),
        "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
        "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
        java_home_tool(f"{REQUIRED_JAVA}+"),
        "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home",
        "/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home",
        "/usr/lib/jvm/java-21-openjdk-amd64",
        "/usr/lib/jvm/java-21-openjdk-arm64",
    ]
    for candidate in candidates:
        if candidate and (Path(candidate) / "bin" / "java").exists() and java_major(candidate) >= REQUIRED_JAVA:
            return candidate
    raise DemoError(f"No JDK {REQUIRED_JAVA} or newer was found. Install one (brew install openjdk@21) or set JAVA_HOME.")


def require_command(name, hint):
    if subprocess.run(["which", name], capture_output=True).returncode != 0:
        raise DemoError(f"{name} was not found. {hint}")


# --- Database -------------------------------------------------------------

class Database:
    """Runs SQL through psql; the password travels by environment variable only."""

    def __init__(self, host, port, password):
        self.host, self.port = host, port
        self.env = dict(os.environ, PGPASSWORD=password)

    def _psql(self, sql, *extra):
        command = ["psql", "-h", self.host, "-p", str(self.port), "-U", "trading_season", "-d", "trading_season",
                   "-X", "-q", "-v", "ON_ERROR_STOP=1", *extra]
        result = subprocess.run(command, input=sql, capture_output=True, text=True, env=self.env)
        if result.returncode != 0:
            raise DemoError(f"Database error: {result.stderr.strip()}")
        return result.stdout

    def rows(self, sql):
        output = self._psql(sql, "-A", "-t", "-F", FIELD_SEP, "-R", RECORD_SEP)
        return [record.split(FIELD_SEP) for record in output.strip("\n").split(RECORD_SEP) if record.strip("\n")]

    def value(self, sql):
        rows = self.rows(sql)
        return rows[0][0] if rows else None

    def run(self, sql):
        self._psql(sql)


def checked_uuid(value):
    if not UUID_PATTERN.match(str(value)):
        raise DemoError(f"Expected a UUID, got {value!r}.")
    return str(value)


def install_fault(db, mode, client_reference):
    """Adds a trigger that affects only the order with this client reference.

    fail: the holding posting raises, after the fill and the cash posting were
    written in the same transaction, so the whole settlement must roll back.
    hold: the fill insert sleeps, so the settlement transaction is in flight,
    uncommitted, when Order and Sell is killed.
    """
    reference = checked_uuid(client_reference)
    if mode == "fail":
        table = "holding_movements"
        body = f"""
    IF EXISTS (SELECT 1 FROM fills f JOIN orders o ON o.order_id = f.order_id
               WHERE f.fill_id = NEW.fill_id AND o.client_reference = '{reference}') THEN
        RAISE EXCEPTION 'Injected database error (failure demo): the holding posting for fill % could not be written', NEW.fill_id;
    END IF;"""
    else:
        table = "fills"
        body = f"""
    IF EXISTS (SELECT 1 FROM orders o WHERE o.order_id = NEW.order_id AND o.client_reference = '{reference}') THEN
        PERFORM pg_sleep(600);
    END IF;"""
    remove_faults(db)
    db.run(f"""
CREATE FUNCTION {FAULT}() RETURNS trigger LANGUAGE plpgsql AS $fault$
BEGIN{body}
    RETURN NEW;
END
$fault$;
CREATE TRIGGER {FAULT} BEFORE INSERT ON {table} FOR EACH ROW EXECUTE FUNCTION {FAULT}();
""")


def release_held_fills(db):
    """Ends the database session left sleeping in the hold trigger, rolling its transaction back."""
    return db.value(
        "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity "
        "WHERE wait_event = 'PgSleep' AND datname = current_database() AND pid <> pg_backend_pid() "
        "AND query ILIKE '%fills%'")


def remove_faults(db):
    release_held_fills(db)
    db.run(f"""
SET lock_timeout = '10s';
DROP TRIGGER IF EXISTS {FAULT} ON holding_movements;
DROP TRIGGER IF EXISTS {FAULT} ON fills;
DROP FUNCTION IF EXISTS {FAULT}();
""")


# --- Quote proxy ----------------------------------------------------------

class QuoteProxy:
    """Sits between Order and Sell and Holdings and Trade, as quote-outage-proxy.py
    does, but the withheld symbol can be changed while it runs. With no symbol
    set it forwards every response unchanged."""

    def __init__(self, port, upstream):
        self.port, self.upstream = port, upstream.rstrip("/")
        self.withheld = None
        self.withheld_count = 0
        proxy = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            skipped = {"connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding"}

            def _forward(self):
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else None
                headers = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "accept-encoding")}
                request = urllib.request.Request(proxy.upstream + self.path, data=body, headers=headers,
                                                 method=self.command)
                try:
                    with urllib.request.urlopen(request, timeout=10) as response:
                        status, response_headers, payload = response.status, response.getheaders(), response.read()
                except urllib.error.HTTPError as error:
                    status, response_headers, payload = error.code, error.headers.items(), error.read()
                except (urllib.error.URLError, OSError) as error:
                    self._send(502, [("Content-Type", "text/plain")], f"Upstream unavailable: {error}".encode())
                    return
                if self.command == "GET" and self.path.split("?", 1)[0] == SNAPSHOT_PATH and status == 200:
                    payload = proxy.filter_snapshot(payload)
                self._send(status, response_headers, payload)

            def _send(self, status, headers, payload):
                self.send_response(status)
                for name, value in headers:
                    if name.lower() not in self.skipped:
                        self.send_header(name, value)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = _forward

            def log_message(self, format, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self.server.daemon_threads = True
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def filter_snapshot(self, payload):
        symbol = self.withheld
        if not symbol:
            return payload
        try:
            snapshot = json.loads(payload)
            stocks = snapshot.get("stocks") or []
            kept = [s for s in stocks if str(s.get("symbol", "")).upper() != symbol]
            if len(kept) != len(stocks):
                self.withheld_count += 1
            snapshot["stocks"] = kept
            return json.dumps(snapshot).encode()
        except (ValueError, AttributeError):
            return payload

    @property
    def url(self):
        return f"http://127.0.0.1:{self.port}"

    def close(self):
        self.server.shutdown()


# --- Order and Sell process -----------------------------------------------

class OrderAndSell:
    """Owns the Order and Sell process: one `mvn spring-boot:run` at a time, in
    its own process group so a stop reaches the forked JVM too."""

    def __init__(self, port, base_env, log_dir):
        self.port, self.base_env, self.log_dir = port, base_env, log_dir
        self.process = None
        self.log_path = None
        self.starts = 0

    @property
    def running(self):
        return self.process is not None and self.process.poll() is None

    def start(self, extra_env=None):
        if self.running:
            raise DemoError("Order and Sell is already running.")
        if port_open(self.port):
            raise DemoError(f"Port {self.port} is held by {port_holder(self.port)}.")
        self.starts += 1
        self.log_path = self.log_dir / f"order-and-sell-{self.starts}.log"
        env = dict(self.base_env, **(extra_env or {}))
        with open(self.log_path, "w") as log:
            self.process = subprocess.Popen(["mvn", "spring-boot:run"], cwd=ORDER_DIR, env=env, stdout=log,
                                            stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                            start_new_session=True)

    def wait_ready(self, timeout):
        """True once the port opens; False if the process exits first."""
        started = time.monotonic()
        next_report = 20
        while time.monotonic() - started < timeout:
            if port_open(self.port):
                return True
            if not self.running:
                return False
            elapsed = time.monotonic() - started
            if elapsed >= next_report:
                step(f"still starting ({int(elapsed)}s)")
                next_report += 20
            time.sleep(1)
        raise DemoError(f"Order and Sell did not open port {self.port} within {timeout}s. Log: {self.log_path}")

    def wait_exit(self, timeout):
        try:
            return self.process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            return None

    def stop(self, hard=False):
        """SIGKILL when hard, as a crash or a task killed outright; otherwise SIGTERM, as a normal stop."""
        if self.running:
            try:
                os.killpg(self.process.pid, signal.SIGKILL if hard else signal.SIGTERM)
            except ProcessLookupError:
                pass
            if self.wait_exit(30) is None:
                os.killpg(self.process.pid, signal.SIGKILL)
                self.process.wait()
        for _ in range(20):
            if not port_open(self.port):
                return
            time.sleep(0.5)

    def startup_failure(self):
        """The lines of the log that say why the application did not start."""
        if not self.log_path or not self.log_path.exists():
            return []
        lines = self.log_path.read_text(errors="replace").splitlines()
        for index, line in enumerate(lines):
            # Spring Boot's failure analyzer, when one recognises the cause.
            if "APPLICATION FAILED TO START" in line:
                return [l[:200] for l in lines[index + 1:index + 12] if l.strip() and not set(l.strip()) <= {"*"}]
        picked = [line.split(" : ", 1)[-1] for line in lines if "o.s.boot.SpringApplication" in line]
        causes = [line.strip() for line in lines if line.startswith("Caused by:")]
        # The first cause is the closest to what went wrong, the last is the root.
        picked += causes[:1] + causes[-1:] if len(causes) > 1 else causes
        if not picked:
            picked = [line for line in lines if "[ERROR] Failed to execute goal" in line]
        return [line[:200] for line in picked]


# --- HTTP -----------------------------------------------------------------

def http(method, url, token=None, body=None, timeout=15):
    """Returns (status, headers, parsed JSON or text); status 0 means the service could not be reached."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status, headers, payload = response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        status, headers, payload = error.code, error.headers, error.read()
    except (urllib.error.URLError, OSError) as error:
        return 0, {}, str(getattr(error, "reason", error))
    text = payload.decode(errors="replace")
    try:
        return status, headers, json.loads(text) if text else None
    except ValueError:
        return status, headers, text


def b64url_decode(segment):
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


def b64url_encode(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


SIGN_SCRIPT = """
const crypto = require('crypto');
let input = '';
process.stdin.on('data', chunk => input += chunk).on('end', () => {
  const { key, data } = JSON.parse(input);
  process.stdout.write(crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url'));
});
"""


def sign_rs256(header, payload, private_key_pem):
    """Signs a token with the Auth Service's development key, passed to node on stdin."""
    data = b64url_encode(json.dumps(header, separators=(",", ":")).encode()) + "." + \
        b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    result = subprocess.run(["node", "-e", SIGN_SCRIPT], input=json.dumps({"key": private_key_pem, "data": data}),
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise DemoError(f"Could not sign the expired token: {result.stderr.strip()}")
    return data + "." + result.stdout.strip()


# --- The demo -------------------------------------------------------------

class Demo:
    def __init__(self, args, db, proxy, order_service):
        self.args, self.db, self.proxy, self.oas = args, db, proxy, order_service
        self.order_url = f"http://127.0.0.1:{args.order_port}"
        self.active = None
        self.context = {}
        self.user_id = None
        self.account_id = None

    # -- Trader and market --

    def login(self):
        status, _, body = http("POST", f"{AUTH_URL}/auth/login",
                               body={"email": self.args.email, "password": self.args.password})
        if status not in (200, 201) or not isinstance(body, dict) or "accessToken" not in body:
            raise DemoError(f"Signing in as {self.args.email} failed (HTTP {status}): {body}")
        token = body["accessToken"]
        self.user_id = checked_uuid(json.loads(b64url_decode(token.split(".")[1]))["sub"])
        return token

    def resolve_account(self):
        self.login()
        if self.args.account_id:
            owner = self.db.value(f"SELECT user_id FROM accounts WHERE account_id = {int(self.args.account_id)}")
            if owner != self.user_id:
                raise DemoError(f"Account {self.args.account_id} does not belong to {self.args.email}.")
            self.account_id = int(self.args.account_id)
        else:
            found = self.db.value(f"SELECT account_id FROM accounts WHERE user_id = '{self.user_id}' "
                                  "AND status = 'ACTIVE' ORDER BY account_id LIMIT 1")
            if not found:
                raise DemoError(f"{self.args.email} has no active trading account. Pass --account-id.")
            self.account_id = int(found)

    def market(self):
        status, _, snapshot = http("GET", f"{HOLDINGS_URL}{SNAPSHOT_PATH}")
        if status != 200 or not isinstance(snapshot, dict):
            raise DemoError(f"Holdings and Trade did not return the market snapshot (HTTP {status}).")
        return snapshot

    def require_open_market(self):
        snapshot = self.market()
        if snapshot.get("status") != "OPEN":
            raise DemoError(f"The replay market is {snapshot.get('status')} at {snapshot.get('marketTimestamp')}, "
                            "so every order is rejected by the market hours rule (BR-05). Move the replay clock "
                            "into market hours in the Client UI, then try again.")
        return snapshot

    def place_market_buy(self, token, symbol, client_reference, timeout=30):
        instrument = self.db.value(f"SELECT instrument_id FROM instruments WHERE upper(ticker) = '{symbol}'")
        if not instrument:
            raise DemoError(f"No instrument with ticker {symbol}.")
        prices = {s["symbol"].upper(): s.get("price") for s in self.market().get("stocks", [])}
        body = {"accountId": self.account_id, "instrumentId": int(instrument), "orderType": "BUY", "quantity": 1,
                "indicativePrice": prices.get(symbol) or 1, "clientReference": client_reference,
                "executionType": "MARKET"}
        return http("POST", f"{self.order_url}/api/orders", token=token, body=body, timeout=timeout)

    def order_row(self, client_reference):
        rows = self.db.rows(
            "SELECT order_id, status, coalesce(rejection_code, ''), coalesce(rejection_reason, ''), "
            "coalesce(execution_price::text, ''), execution_attempts "
            f"FROM orders WHERE client_reference = '{checked_uuid(client_reference)}'")
        if not rows:
            return None
        order_id, status, code, reason, price, attempts = rows[0]
        return {"id": int(order_id), "status": status, "code": code, "reason": reason, "price": price,
                "attempts": int(attempts)}

    def show_audit(self, order_id):
        for event, detail in self.db.rows(
                f"SELECT event_type, detail FROM audit_trail WHERE order_id = {int(order_id)} ORDER BY audit_id"):
            note(f"  audit {event:<16} {detail[:150]}")

    def wait_for_resolution(self, client_reference, timeout):
        """Polls until the order leaves ACCEPTED. Ctrl+C stops waiting, not the demo."""
        started = time.monotonic()
        next_report = 10
        try:
            while time.monotonic() - started < timeout:
                order = self.order_row(client_reference)
                if order and order["status"] != "ACCEPTED":
                    return order
                elapsed = time.monotonic() - started
                if elapsed >= next_report:
                    step(f"order still ACCEPTED after {int(elapsed)}s (execution attempts so far: "
                         f"{order['attempts'] if order else 0})")
                    next_report += 10
                time.sleep(1)
        except KeyboardInterrupt:
            say()
            note("Stopped waiting.")
        return self.order_row(client_reference)

    # -- Snapshots --

    def snapshot(self, token=None):
        uid, account = self.user_id, self.account_id
        row = self.db.rows(f"""
SELECT (SELECT available_funds FROM users WHERE user_id = '{uid}'),
       (SELECT count(*) FROM orders o JOIN accounts a USING (account_id) WHERE a.user_id = '{uid}'),
       (SELECT count(*) FROM fills f JOIN orders o USING (order_id) JOIN accounts a USING (account_id)
         WHERE a.user_id = '{uid}'),
       (SELECT count(*) FROM cash_transactions c JOIN accounts a USING (account_id) WHERE a.user_id = '{uid}'),
       (SELECT count(*) FROM holding_movements m JOIN accounts a USING (account_id) WHERE a.user_id = '{uid}'),
       (SELECT count(*) FROM orders),
       (SELECT count(*) FROM fills)""")[0]
        values = {
            "Cash (available funds)": row[0],
            "Orders (this trader)": row[1],
            "Fills (this trader)": row[2],
            "Cash postings (this trader)": row[3],
            "Holding postings (this trader)": row[4],
        }
        for ticker, quantity in self.db.rows(
                "SELECT i.ticker, h.quantity::numeric FROM holdings h JOIN instruments i USING (instrument_id) "
                f"WHERE h.account_id = {account} AND h.quantity <> 0 ORDER BY i.ticker"):
            values[f"Holding {ticker} (account {account})"] = str(Decimal(quantity).normalize())
        values["Orders (all traders)"] = row[5]
        values["Fills (all traders)"] = row[6]
        if token:
            status, headers, _ = http("GET", f"{self.order_url}/api/orders?page=0&size=1", token=token)
            values["Orders served by the API"] = headers.get("X-Total-Count", "?") if status == 200 else \
                ("down" if status == 0 else f"HTTP {status}")
        return values

    def compare(self, before, after, title_before="before", title_after="after"):
        """Prints both snapshots side by side and returns the labels that changed."""
        labels = list(before) + [label for label in after if label not in before]
        width = max(len(label) for label in labels) + 2
        say(f"    {'':<{width}}{title_before:>16}{title_after:>16}")
        changed = []
        for label in labels:
            old, new = before.get(label, "-"), after.get(label, "-")
            same = old == new
            if not same:
                changed.append(label)
                try:
                    delta = Decimal(new if new != "-" else 0) - Decimal(old if old != "-" else 0)
                    verdict = f"changed ({'+' if delta > 0 else ''}{delta.normalize()})"
                except ArithmeticError:
                    verdict = "changed"
            else:
                verdict = "same"
            say(f"    {label:<{width}}{old:>16}{new:>16}   {verdict}")
        return changed

    def status(self):
        say()
        say("Services")
        for label, port in (("Auth Service", 3001), ("Holdings and Trade", 8082),
                            ("Order and Sell", self.args.order_port)):
            say(f"  {label:<20} {'up' if port_open(port) else 'DOWN':<5} :{port}")
        mode = f"withholding {self.proxy.withheld}" if self.proxy.withheld else "passing every quote through"
        say(f"  {'Quote proxy':<20} {'up':<5} :{self.proxy.port}  ({mode})")
        fault = self.db.value(f"SELECT string_agg(event_object_table, ', ') FROM information_schema.triggers "
                              f"WHERE trigger_name = '{FAULT}'")
        say(f"  {'Database fault':<20} {('on ' + fault) if fault else 'none'}")
        say(f"  Active scenario: {self.active + '. ' + SCENARIOS[self.active] if self.active else 'none'}")
        say()
        say(f"Trader {self.args.email}, account {self.account_id}")
        for label, value in self.snapshot().items():
            say(f"  {label:<34}{value:>14}")

    def ensure_order_service(self):
        if not self.oas.running:
            raise DemoError("Order and Sell is not running. Type reset, or restart this console.")

    def start_order_service(self, what="Starting Order and Sell"):
        step(what)
        self.oas.start()
        if not self.oas.wait_ready(RESTART_TIMEOUT):
            for line in self.oas.startup_failure():
                note(line)
            raise DemoError(f"Order and Sell exited during startup. Log: {self.oas.log_path}")
        ok(f"Order and Sell is up on {self.order_url} (log: {self.oas.log_path})")

    # -- 1. Execution step down --

    def trigger_1(self):
        self.ensure_order_service()
        say("  Trigger: crash Order and Sell, the component that executes orders, while an order it")
        say("  accepted is still being settled. Recover: start it again and the pending order completes.")
        self.require_open_market()
        token = self.login()
        before = self.snapshot()
        reference = str(uuid.uuid4())
        install_fault(self.db, "hold", reference)
        step(f"Placing a market BUY of 1 {self.args.trade_symbol}; its settlement is held in the database "
             "so it is in flight when the service dies")
        threading.Thread(target=self.place_market_buy, args=(token, self.args.trade_symbol, reference, 700),
                         daemon=True).start()

        order = None
        for _ in range(30):
            order = self.order_row(reference)
            held = self.db.value("SELECT count(*) FROM pg_stat_activity WHERE wait_event = 'PgSleep' "
                                 "AND query ILIKE '%fills%'")
            if order and order["status"] == "ACCEPTED" and held != "0":
                break
            if order and order["status"] not in ("PENDING", "ACCEPTED"):
                remove_faults(self.db)
                raise DemoError(f"Order {order['id']} was {order['status']} before execution: {order['reason']}")
            time.sleep(1)
        else:
            remove_faults(self.db)
            raise DemoError("The order did not reach execution within 30 seconds.")
        ok(f"Order {order['id']} is committed as ACCEPTED and its fill is being written")

        step("Killing Order and Sell (SIGKILL), as when the task is stopped or scaled to zero")
        self.oas.stop(hard=True)
        release_held_fills(self.db)
        remove_faults(self.db)
        status, _, _ = http("GET", f"{self.order_url}/api/orders", timeout=3)
        if status == 0:
            ok(f"Order and Sell is down: {self.order_url} refuses connections, so no order can be placed")
        else:
            bad(f"Order and Sell still answered with HTTP {status}")
        order = self.order_row(reference)
        fills = self.db.value(f"SELECT count(*) FROM fills WHERE order_id = {order['id']}")
        ok(f"Order {order['id']} is still on record as {order['status']} with {fills} fills: the half-written "
           "settlement was rolled back and the accepted order survived")
        self.compare(before, self.snapshot(token), "before", "while down")
        self.context = {"reference": reference, "before": before}
        say()
        say("  Type reset to start Order and Sell again and watch the pending order complete.")

    def reset_1(self):
        reference, before = self.context["reference"], self.context["before"]
        self.start_order_service("Starting Order and Sell again")
        step("Waiting for the pending order evaluator to pick up the accepted order")
        order = self.wait_for_resolution(reference, 120)
        if order["status"] == "FILLED":
            ok(f"Order {order['id']} completed after the restart: FILLED at {order['price']}")
        elif order["status"] == "ACCEPTED":
            bad(f"Order {order['id']} is still ACCEPTED")
        else:
            ok(f"Order {order['id']} completed after the restart: {order['status']} ({order['reason']})")
        self.show_audit(order["id"])
        self.compare(before, self.snapshot(), "before", "after")

    # -- 2. Failure midway through a fill --

    def trigger_2(self):
        self.ensure_order_service()
        say("  Trigger: a database error between the steps of a fill. The fill row and the cash posting")
        say("  are written, then the holding posting fails. Recover: show holdings, cash and the trade")
        say("  record are all unchanged.")
        self.require_open_market()
        token = self.login()
        before = self.snapshot()
        reference = str(uuid.uuid4())
        install_fault(self.db, "fail", reference)
        ok("Fault injected: the holding posting for this one order will fail (no other order is affected)")
        step(f"Placing a market BUY of 1 {self.args.trade_symbol}")
        status, _, body = self.place_market_buy(token, self.args.trade_symbol, reference)
        if status != 201 or not isinstance(body, dict):
            remove_faults(self.db)
            raise DemoError(f"The order was not accepted (HTTP {status}): {body}")
        say(f"    Order and Sell answered HTTP {status}: order {body.get('orderId')} is {body.get('status')}")
        order = self.order_row(reference)
        failure = self.db.value(f"SELECT detail FROM audit_trail WHERE order_id = {order['id']} "
                                "AND event_type = 'EXECUTION_FAILED' ORDER BY audit_id LIMIT 1")
        if failure:
            ok(f"Execution failed midway and was rolled back: {failure.splitlines()[0][:160]}")
        after = self.snapshot()
        changed = self.compare(before, after)
        unchanged = [label for label in changed if label.startswith(("Cash", "Fills", "Holding"))]
        if not unchanged:
            ok("Cash, holdings, fills and both ledgers are unchanged. The only new row is the order itself,")
            note(f"on record as {order['status']} (the accepted intent, BR-06); it is retried with backoff.")
        else:
            bad(f"Changed: {', '.join(unchanged)}")
        self.context = {"reference": reference, "before": before}
        say()
        say("  Type reset to remove the fault; the next retry settles the order in one transaction.")

    def reset_2(self):
        reference, before = self.context["reference"], self.context["before"]
        remove_faults(self.db)
        ok("Fault removed")
        step("Waiting for the next retry (backoff doubles per attempt, at most 60s; Ctrl+C stops waiting)")
        order = self.wait_for_resolution(reference, 75)
        if order["status"] == "ACCEPTED":
            note(f"Order {order['id']} is still ACCEPTED; it settles on its next retry.")
            return
        ok(f"Order {order['id']} is now {order['status']}"
           + (f" at {order['price']}" if order["price"] else f" ({order['reason']})"))
        self.compare(before, self.snapshot(), "before", "after")
        if order["status"] == "FILLED":
            ok("The fill, the cash posting, the holding posting and the balance moved together")

    # -- 3. Service restart --

    def trigger_3(self):
        self.ensure_order_service()
        say("  Trigger: restart Order and Sell. Recover: show balances and trade counts are the same.")
        token = self.login()
        before = self.snapshot(token)
        step("Stopping Order and Sell (SIGTERM, a normal restart or redeploy)")
        self.oas.stop()
        ok("Order and Sell stopped")
        self.start_order_service("Starting Order and Sell again")
        after = self.snapshot(self.login())
        changed = self.compare(before, after, "before", "after restart")
        if not changed:
            ok("Every balance and count is the same after the restart")
        else:
            bad(f"Changed: {', '.join(changed)} (other traders may have traded during the restart)")
        say()
        say("  Nothing to recover. Type reset to continue.")

    def reset_3(self):
        ok("Nothing to recover: Order and Sell is already back")

    # -- 4. Failed deployment --

    def trigger_4(self):
        self.ensure_order_service()
        say("  Trigger: deploy Order and Sell with a broken task definition (its database URL names a")
        say("  database that does not exist), so it fails to start. Recover: roll back, show data intact.")
        token = self.login()
        before = self.snapshot(token)
        self.context = {"before": before}
        step("Stopping the running version")
        self.oas.stop()
        broken = f"jdbc:postgresql://{self.db.host}:{self.db.port}/trading_season_broken_release"
        step(f"Deploying the new version with SPRING_DATASOURCE_URL={broken}")
        self.oas.start({"SPRING_DATASOURCE_URL": broken})
        if self.oas.wait_ready(RESTART_TIMEOUT):
            bad("The broken deployment started anyway")
            return
        ok(f"The deployment failed to start (exit code {self.oas.process.returncode}). From its log:")
        for line in self.oas.startup_failure():
            note(f"  {line}")
        status, _, _ = http("GET", f"{self.order_url}/api/orders", timeout=3)
        if status == 0:
            ok(f"Order and Sell is down: {self.order_url} refuses connections")
        self.compare(before, self.snapshot(token), "before", "after failure")
        say()
        say("  Type reset to roll back to the last good configuration.")

    def reset_4(self):
        before = self.context["before"]
        self.start_order_service("Rolling back: starting Order and Sell with the last good configuration")
        after = self.snapshot(self.login())
        changed = self.compare(before, after, "before", "after rollback")
        if not changed:
            ok("Rolled back with every balance and count intact")
        else:
            bad(f"Changed: {', '.join(changed)}")

    # -- 5. Quote source unavailable --

    def trigger_5(self):
        self.ensure_order_service()
        symbol = self.args.symbol
        say(f"  Trigger: block the price lookup for {symbol} only. Recover: show the order is rejected")
        say("  with a clear reason.")
        self.proxy.withheld = symbol
        direct = {s["symbol"].upper(): s.get("price") for s in self.market().get("stocks", [])}
        _, _, proxied = http("GET", f"{self.proxy.url}{SNAPSHOT_PATH}")
        proxied = {s["symbol"].upper() for s in (proxied or {}).get("stocks", [])}
        ok(f"Quote source blocked for {symbol}: Holdings and Trade prices it at {direct.get(symbol)}, but the "
           f"snapshot Order and Sell receives has no {symbol} ({len(proxied)} other symbols still priced)")
        token = self.login()
        before = self.snapshot()
        step(f"Placing a market BUY of 1 {symbol}")
        status, _, body = self.place_market_buy(token, symbol, str(uuid.uuid4()))
        if status == 201 and isinstance(body, dict) and body.get("status") == "REJECTED":
            ok(f"Order {body.get('orderId')} REJECTED, code {body.get('rejectionCode')}: "
               f"\"{body.get('rejectionReason')}\"")
        else:
            bad(f"Unexpected answer (HTTP {status}): {body}")
        changed = [label for label in self.compare(before, self.snapshot()) if not label.startswith("Orders")]
        if not changed:
            ok("No cash or holdings moved")
        say()
        say(f"  Try it in the Client UI too: any {symbol} order is rejected with that reason, while")
        say(f"  {self.args.trade_symbol} and the other symbols still fill. Type reset to restore the quote.")

    def reset_5(self):
        symbol = self.proxy.withheld
        self.proxy.withheld = None
        _, _, proxied = http("GET", f"{self.proxy.url}{SNAPSHOT_PATH}")
        priced = any(s["symbol"].upper() == symbol for s in (proxied or {}).get("stocks", []))
        if priced:
            ok(f"Quote source restored: Order and Sell receives a {symbol} price again "
               f"(it was withheld from {self.proxy.withheld_count} snapshot requests)")
        else:
            bad(f"The snapshot still has no {symbol} price")
        self.proxy.withheld_count = 0

    # -- 6. Tampered or expired token --

    def call_with(self, label, token):
        results = []
        for service, url in (("Order and Sell", f"{self.order_url}/api/orders?page=0&size=1"),
                             ("Holdings and Trade", f"{HOLDINGS_URL}/api/users/me")):
            status, headers, body = http("GET", url, token=token)
            challenge = headers.get("WWW-Authenticate", "") if status else ""
            match = re.search(r'error_description="([^"]*)"', challenge)
            reason = match.group(1) if match else (body.get("error") if isinstance(body, dict) else "")
            say(f"    {service:<20} HTTP {status}  {reason if status != 200 else 'OK'}")
            results.append(status)
        return results

    def trigger_6(self):
        self.ensure_order_service()
        say("  Trigger: edit one character of a real token, and present an expired one.")
        say("  Recover: nothing to recover; each is rejected with a clear reason.")
        token = self.login()
        header_segment, payload_segment, signature = token.split(".")

        say(f"  A valid token for {self.args.email}:")
        valid = self.call_with("valid", token)

        index = len(signature) // 2
        original = signature[index]
        replacement = "A" if original != "A" else "B"
        tampered = f"{header_segment}.{payload_segment}.{signature[:index]}{replacement}{signature[index + 1:]}"
        say(f"  The same token with character {len(header_segment) + len(payload_segment) + 2 + index + 1} "
            f"changed from '{original}' to '{replacement}':")
        tampered_results = self.call_with("tampered", tampered)

        private_key = env_file_value("JWT_PRIVATE_KEY").replace("\\n", "\n")
        if not private_key:
            raise DemoError("apps/auth-service/.env has no JWT_PRIVATE_KEY to sign the expired token with.")
        claims = json.loads(b64url_decode(payload_segment))
        now = int(time.time())
        claims["iat"], claims["exp"] = now - 3600, now - 1800
        expired = sign_rs256(json.loads(b64url_decode(header_segment)), claims, private_key)
        say("  The same claims, correctly signed with the Auth Service key, but expired 30 minutes ago:")
        expired_results = self.call_with("expired", expired)

        if valid == [200, 200] and tampered_results == [401, 401] and expired_results == [401, 401]:
            ok("The valid token is accepted; the tampered and expired tokens are rejected with HTTP 401")
        else:
            bad("Unexpected results above")
        say()
        say("  Nothing to recover. Type reset to continue.")

    def reset_6(self):
        ok("Nothing to recover: the rejected tokens changed nothing")

    # -- Loop --

    def menu(self):
        say()
        say("Failure scenarios")
        for number, title in SCENARIOS.items():
            say(f"  {number}      {title}")
        say("  reset  recover from the active scenario")
        say("  status show the services, any injected fault, and the trader's balances")
        say("  help   show this list")
        say("  quit   remove any fault, stop Order and Sell and exit")

    def handle(self, command):
        if command in SCENARIOS:
            if self.active:
                say(f"Scenario {self.active} is still active. Type reset first.")
                return
            heading(command)
            self.context = {}
            getattr(self, f"trigger_{command}")()
            self.active = command
        elif command == "reset":
            if not self.active:
                say("No scenario is active.")
                return
            say()
            say(f"=== Reset {self.active}. {SCENARIOS[self.active]} ===")
            getattr(self, f"reset_{self.active}")()
            self.active = None
            self.context = {}
            say()
            say("Ready for the next scenario.")
        elif command == "status":
            self.status()
        elif command in ("help", "?", ""):
            self.menu()
        else:
            say(f"Unknown command {command!r}. Type help for the list.")

    def recover_after_error(self):
        """A scenario that failed halfway must not leave a fault or a stopped service behind."""
        remove_faults(self.db)
        self.proxy.withheld = None
        self.active = None
        if not self.oas.running:
            try:
                self.start_order_service("Starting Order and Sell again")
            except DemoError as error:
                bad(str(error))


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0],
                                     formatter_class=argparse.RawDescriptionHelpFormatter,
                                     epilog="Start the rest of the stack first: ./scripts/start-local-no-order.sh")
    parser.add_argument("--email", default="johndoe@gmail.com", help="trader the demo signs in as (default: %(default)s)")
    parser.add_argument("--password", help="that trader's password (default: the seeded demo password, "
                                           "or FAILURE_DEMO_PASSWORD)")
    parser.add_argument("--account-id", type=int, help="account to trade on (default: the trader's first active one)")
    parser.add_argument("--symbol", default="TSLA", help="instrument whose quote scenario 5 blocks (default: %(default)s)")
    parser.add_argument("--trade-symbol", default="AAPL",
                        help="instrument scenarios 1 and 2 buy one share of (default: %(default)s)")
    parser.add_argument("--order-port", type=int, default=8081, help="port for Order and Sell (default: %(default)s)")
    parser.add_argument("--proxy-port", type=int, default=8089, help="port for the quote proxy (default: %(default)s)")
    args = parser.parse_args()
    args.symbol, args.trade_symbol = args.symbol.upper(), args.trade_symbol.upper()
    for symbol in (args.symbol, args.trade_symbol):
        if not re.match(r"^[A-Z.]{1,10}$", symbol):
            parser.error(f"{symbol} is not a ticker")
    if args.symbol == args.trade_symbol:
        parser.error("--symbol and --trade-symbol must differ, so trades still work while the quote is blocked")
    args.password = args.password or os.environ.get("FAILURE_DEMO_PASSWORD") or "#Password12345"
    return args


def main():
    args = parse_args()
    say("Trading Season failure demo")
    for name, hint in (("psql", "Install the PostgreSQL client tools."), ("mvn", "Install Maven 3.9 or newer."),
                       ("node", "Install Node.js 24."), ("lsof", "Install lsof.")):
        require_command(name, hint)
    java_home = find_java_home()

    for label, port in (("Auth Service", 3001), ("Holdings and Trade", 8082)):
        if not port_open(port):
            raise DemoError(f"{label} is not running on port {port}. Start the stack first with "
                            "./scripts/start-local-no-order.sh, then run this again.")
    ok("Auth Service :3001 and Holdings and Trade :8082 are up")
    if port_open(args.order_port):
        raise DemoError(f"Port {args.order_port} is held by {port_holder(args.order_port)}. This console runs Order "
                        "and Sell itself: start the stack with ./scripts/start-local-no-order.sh instead of "
                        "start-local.sh.")
    if port_open(args.proxy_port):
        raise DemoError(f"Port {args.proxy_port} is held by {port_holder(args.proxy_port)}. Pass --proxy-port.")

    db_host = os.environ.get("DB_HOST") or env_file_value("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT") or env_file_value("DB_PORT", "5432")
    password = os.environ.get("SPRING_DATASOURCE_PASSWORD")
    if not password:
        password = getpass.getpass("Database password for trading_season: ")
    db = Database(db_host, db_port, password)
    db.value("SELECT 1")
    remove_faults(db)
    ok(f"PostgreSQL {db_host}:{db_port}, database trading_season")

    proxy = QuoteProxy(args.proxy_port, HOLDINGS_URL)
    ok(f"Quote proxy {proxy.url} -> {HOLDINGS_URL} (passing every quote through)")

    env = dict(os.environ, JAVA_HOME=java_home, PATH=f"{java_home}/bin:{os.environ.get('PATH', '')}",
               SPRING_DATASOURCE_PASSWORD=password,
               SPRING_DATASOURCE_URL=f"jdbc:postgresql://{db_host}:{db_port}/trading_season",
               EXECUTION_MARKET_URL=proxy.url, SERVER_PORT=str(args.order_port))
    if port_open(BROKER_PORT):
        env["KAFKA_BOOTSTRAP_SERVERS"] = f"127.0.0.1:{BROKER_PORT}"
        ok(f"Kafka 127.0.0.1:{BROKER_PORT} (events on)")
    else:
        env.setdefault("APP_EVENTS_ENABLED", "false")
        note(f"No Kafka broker on 127.0.0.1:{BROKER_PORT}; Order and Sell runs with events off")

    log_dir = Path(tempfile.mkdtemp(prefix="trading-season-failure-demo."))
    order_service = OrderAndSell(args.order_port, env, log_dir)
    demo = Demo(args, db, proxy, order_service)

    def shutdown(*_):
        raise SystemExit(130)
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGHUP, shutdown)

    try:
        demo.resolve_account()
        ok(f"Trader {args.email}, account {demo.account_id}")
        step(f"Starting Order and Sell on :{args.order_port} (the first start compiles it; logs in {log_dir})")
        order_service.start()
        if not order_service.wait_ready(FIRST_START_TIMEOUT):
            for line in order_service.startup_failure():
                note(line)
            raise DemoError(f"Order and Sell exited during startup. Log: {order_service.log_path}")
        ok(f"Order and Sell is up on http://127.0.0.1:{args.order_port}, reading quotes through the proxy")
        demo.menu()
        while True:
            try:
                command = input("\nfailure-demo> ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                say()
                break
            if command in ("quit", "exit", "q"):
                break
            try:
                demo.handle(command)
            except KeyboardInterrupt:
                say()
                bad("Interrupted")
                demo.recover_after_error()
            except DemoError as error:
                bad(str(error))
                if command in SCENARIOS:
                    demo.recover_after_error()
    finally:
        say("Cleaning up: removing any injected fault and stopping Order and Sell...")
        try:
            remove_faults(db)
        except DemoError as error:
            bad(str(error))
        proxy.close()
        order_service.stop()
        say(f"Done. Order and Sell logs are in {log_dir}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except DemoError as error:
        bad(str(error))
        sys.exit(1)
