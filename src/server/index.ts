// ============================================
// Doubt Game - Server Entry Point
// Sprint 1: HTTP + Socket.IO Server
// ============================================

import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketServer } from './socket';

const PORT = 3001;

const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000', // Next.js dev server
    methods: ['GET', 'POST'],
  },
});

setupSocketServer(io);

httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     🎮 Doubt Game Server v0.1       ║');
  console.log('║     Sprint 1: State Machine MVP      ║');
  console.log(`║     Running on port ${PORT}              ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Waiting for connections...');
  console.log('');
});
