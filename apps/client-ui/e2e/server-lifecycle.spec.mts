import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { test } from '@playwright/test';
import { runNode, startServer, stopChild } from '../scripts/playwright-setup.mjs';

const handler = 'data:text/javascript,' + encodeURIComponent(
  'export const reqHandler = (req, res) => { if (req.url === "/hang") return; res.end("ready"); };',
);

test('owned server closes active connections, exits and releases its port', async () => {
  const server = await startServer(handler, { port: 0 });
  const response = await fetch(`http://localhost:${server.port}`);
  assert.equal(await response.text(), 'ready');
  const socket = createConnection({ port: server.port });
  await new Promise((resolve) => socket.once('connect', resolve));
  socket.write('GET /hang HTTP/1.1\r\nHost: localhost\r\n\r\n');
  await server.close();
  socket.destroy();
  await assert.rejects(fetch(`http://localhost:${server.port}`));
  await server.close();
});

test('failed build and failed server startup fail the setup', async () => {
  await assert.rejects(runNode(['-e', 'process.exit(7)']), /build failed \(7\)/);
  await assert.rejects(startServer('data:text/javascript,throw new Error("startup failure")', { port: 0 }), /exited before ready/);
});

test('shutdown falls back to direct termination for an unresponsive child', async () => {
  const child = spawn(process.execPath, ['-e', 'process.on("message", () => {}); process.send("ready");'], {
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'], windowsHide: true,
  });
  const done = new Promise((resolve) => child.once('exit', resolve));
  await new Promise((resolve) => child.once('message', resolve));
  await stopChild({ child, done }, 50);
  assert.notEqual(child.signalCode, null);
});
