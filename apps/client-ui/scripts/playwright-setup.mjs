import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { get } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const appDir = fileURLToPath(new URL('../', import.meta.url));
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

function launch(args, options) {
  // No shell or npm parent: shutdown only needs to address our own Node child.
  const child = spawn(process.execPath, args, {
    cwd: appDir,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    windowsHide: true,
    ...options,
  });
  const done = new Promise((resolveDone) => {
    child.once('error', (error) => resolveDone({ error }));
    child.once('exit', (code, signal) => resolveDone({ code, signal }));
  });
  const killOnExit = () => child.kill();
  process.once('exit', killOnExit);
  void done.then(() => process.off('exit', killOnExit));
  return { child, done };
}

export async function stopChild({ child, done }, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (child.connected) {
    child.send({ type: 'shutdown' }, () => {});
  }
  let timer;
  const graceful = await Promise.race([
    done.then(() => true),
    new Promise((resolveTimeout) => { timer = setTimeout(() => resolveTimeout(false), timeoutMs); }),
  ]);
  clearTimeout(timer);
  if (graceful) {
    return;
  }
  child.kill('SIGKILL');
  let killTimer;
  try {
    await Promise.race([
      done,
      new Promise((_, reject) => {
        killTimer = setTimeout(() => reject(new Error('Test server did not exit after direct termination')), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(killTimer);
  }
}

export async function runNode(args, timeoutMs = 300_000) {
  const managed = launch(args);
  let timer;
  try {
    const result = await Promise.race([
      managed.done,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Client UI build timed out')), timeoutMs);
      }),
    ]);
    if (result.error) {
      throw result.error;
    }
    if (result.code !== 0) {
      throw new Error(`Client UI build failed (${result.code ?? result.signal})`);
    }
  } finally {
    clearTimeout(timer);
    await stopChild(managed, 0);
  }
}

export async function startServer(moduleUrl, { port = 4200, timeoutMs = 30_000 } = {}) {
  const managed = launch([fileURLToPath(new URL('./playwright-ssr.mjs', import.meta.url)), moduleUrl], {
    env: { ...process.env, PORT: String(port), NG_ALLOWED_HOSTS: 'localhost' },
  });
  let timer;
  try {
    const ready = await Promise.race([
      new Promise((resolveReady) => {
        managed.child.on('message', (message) => {
          if (message?.type === 'ready') {
            resolveReady(message);
          }
        });
      }),
      managed.done.then((result) => { throw result.error ?? new Error(`Test server exited before ready (${result.code ?? result.signal})`); }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Client UI test server startup timed out')), timeoutMs);
      }),
    ]);
    return { port: ready.port, close: () => stopChild(managed) };
  } catch (error) {
    await stopChild(managed, 0);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function available(url) {
  return new Promise((resolveAvailable) => {
    const request = get(url, { agent: false, timeout: 2_000 }, (response) => {
      response.resume();
      resolveAvailable(response.statusCode >= 200 && response.statusCode < 400);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolveAvailable(false));
  });
}

export default async function setup() {
  const url = 'http://localhost:4200';
  if (await available(url)) {
    if (process.env['CI']) {
      throw new Error(`${url} is already in use; CI requires its own test server`);
    }
    return;
  }
  const serverEntry = resolve(appDir, 'dist/client-ui/server/server.mjs');
  if (process.env['E2E_SKIP_BUILD']) {
    // Serve the dist of an earlier build (Jenkins builds it once, in Build UI Bundles). Building
    // here instead would silently test something other than the build that was asked for.
    if (!existsSync(serverEntry)) {
      throw new Error(`E2E_SKIP_BUILD is set but ${serverEntry} does not exist; build the Client UI first`);
    }
  } else {
    await runNode([resolve(appDir, 'node_modules/@angular/cli/bin/ng.js'), 'build']);
  }
  const server = await startServer(pathToFileURL(serverEntry).href);
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await available(url)) {
        return server.close;
      }
      await delay(100);
    }
    throw new Error('Client UI test server did not answer HTTP requests');
  } catch (error) {
    await server.close();
    throw error;
  }
}
