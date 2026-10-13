// Serves the built Reporting UI the way nginx.conf does, for the integration suite.
//
// Files come from dist/reporting-ui/browser, any other path falls back to
// index.html, /api/reporting/ goes to the Reporting Service and /auth/ to the
// Auth Service, so the browser sees one origin as it does in Compose and under
// `ng serve`. The dev server is not used: a production build is closer to what
// ships, and Vite's dev server drops connections under a parallel run on Windows.
//
// Environment: PORT (default 4390), REPORTING_URL, AUTH_URL.

import { createServer, request as httpRequest } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? 4390);
const reporting = new URL(process.env.REPORTING_URL ?? 'http://127.0.0.1:8390');
const auth = new URL(process.env.AUTH_URL ?? 'http://127.0.0.1:3390');
const root = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'dist',
  'reporting-ui',
  'browser',
);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function proxy(request, response, target) {
  const upstream = httpRequest(
    {
      hostname: target.hostname,
      port: target.port,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host: request.headers.host },
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    },
  );
  upstream.on('error', () => {
    response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
}

createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname.startsWith('/api/reporting/')) {
    return proxy(request, response, reporting);
  }
  if (pathname.startsWith('/auth/')) {
    return proxy(request, response, auth);
  }
  let file = normalize(join(root, decodeURIComponent(pathname)));
  const inside = file === root || file.startsWith(root + sep);
  if (!inside || !existsSync(file) || !statSync(file).isFile()) {
    file = join(root, 'index.html');
  }
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Reporting UI listening on ${port}`);
});
