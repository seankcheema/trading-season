import { createServer } from 'node:http';

// Import the production request handler without starting its main-module listener.
const { reqHandler } = await import(process.argv[2]);
const server = createServer(reqHandler);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
process.on('message', (message) => {
  if (message?.type === 'shutdown') shutdown();
});
process.on('disconnect', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.listen(Number(process.env['PORT'] ?? 4200), () => {
  process.send?.({ type: 'ready', port: server.address().port });
});
