"""Stands between Order and Sell and Holdings and Trade and hides one symbol's quote.

Demo support for the "quote source unavailable" case (BR-12), started by
start-local-quote-outage.sh. Order and Sell prices every order from
GET /api/market/snapshot on Holdings and Trade (ExecutionQuoteSource). This
proxy forwards every request unchanged, except that it removes the chosen
symbol from that snapshot, so Order and Sell cannot price that one instrument
and rejects its orders with QUOTE_UNAVAILABLE. Every other symbol trades
normally, and the Client UI, which reads Holdings and Trade directly, still
shows the price. Standard library only.

Usage: python3 quote-outage-proxy.py --symbol TSLA --port 8089 --upstream http://127.0.0.1:8082
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SNAPSHOT_PATH = "/api/market/snapshot"
# Hop-by-hop and length headers are recomputed for the forwarded response.
SKIPPED_HEADERS = {"connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding"}


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--symbol", required=True, help="symbol whose quote is withheld, for example TSLA")
    parser.add_argument("--port", type=int, default=8089)
    parser.add_argument("--upstream", default="http://127.0.0.1:8082")
    return parser.parse_args()


def make_handler(symbol, upstream):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def _forward(self):
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else None
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "accept-encoding")}
            request = urllib.request.Request(upstream + self.path, data=body, headers=headers, method=self.command)
            try:
                with urllib.request.urlopen(request, timeout=10) as response:
                    status, response_headers, payload = response.status, response.getheaders(), response.read()
            except urllib.error.HTTPError as error:
                status, response_headers, payload = error.code, error.headers.items(), error.read()
            except (urllib.error.URLError, OSError) as error:
                self._send(502, [("Content-Type", "text/plain")], f"Upstream unavailable: {error}".encode())
                return

            if self.command == "GET" and self.path.split("?", 1)[0] == SNAPSHOT_PATH and status == 200:
                payload = self._withhold(payload)
            self._send(status, response_headers, payload)

        def _withhold(self, payload):
            try:
                snapshot = json.loads(payload)
                stocks = snapshot.get("stocks") or []
                kept = [s for s in stocks if str(s.get("symbol", "")).upper() != symbol]
                if len(kept) != len(stocks):
                    print(f"[quote outage] withheld {symbol} from {SNAPSHOT_PATH}", flush=True)
                snapshot["stocks"] = kept
                return json.dumps(snapshot).encode()
            except (ValueError, AttributeError):
                return payload

        def _send(self, status, headers, payload):
            self.send_response(status)
            for name, value in headers:
                if name.lower() not in SKIPPED_HEADERS:
                    self.send_header(name, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = _forward

        def log_message(self, format, *args):
            pass

    return Handler


def main():
    args = parse_args()
    symbol = args.symbol.upper()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(symbol, args.upstream.rstrip("/")))
    print(f"[quote outage] 127.0.0.1:{args.port} -> {args.upstream}, withholding {symbol}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
