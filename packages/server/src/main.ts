// ═══════════════════════════════════════════════════════════════════
// main.ts — Server entry point
// ═══════════════════════════════════════════════════════════════════

import { GameWebSocketServer } from './network/WebSocketServer';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

console.log('═══════════════════════════════════════════════════════');
console.log('  BANG BANG CMM REMAKE — Game Server');
console.log('═══════════════════════════════════════════════════════');

const server = new GameWebSocketServer(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Received SIGINT, shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  server.close();
  process.exit(0);
});
