// ═══════════════════════════════════════════════════════════════════
// WebSocketServer.ts — WebSocket server using 'ws' package
// Handles client connections, message routing, and room management.
// ═══════════════════════════════════════════════════════════════════

import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer as WSServer, type WebSocket } from 'ws';
import {
  type PlayerId,
  type Milliseconds,
  ClientMessageType,
  type ClientMessage,
  type JoinMessage,
  type InputMessage,
  type ClientPingMessage,
  ServerMessageType,
  type PongMessage,
  type ErrorMessage,
} from '@bang-bang/shared';
import { Room } from './Room';

const DEFAULT_PORT = 8080;

export class GameWebSocketServer {
  private readonly httpServer;
  private readonly wss: WSServer;
  private readonly rooms = new Map<string, Room>();
  private readonly connectionToRoom = new Map<WebSocket, Room>();

  /** Default room for auto-join */
  private defaultRoom: Room;

  constructor(port: number = DEFAULT_PORT) {
    this.httpServer = createServer((req, res) => {
      // CORS headers for dev (Vite on :5173 → server on :8080)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          rooms: this.rooms.size,
          totalPlayers: this.getTotalPlayers(),
        }));
        return;
      }

      // Info endpoint — client uses this to detect server availability
      if (req.url === '/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'bang-bang-server',
          version: '0.1.0',
          defaultRoom: this.defaultRoom.id,
          players: this.getTotalPlayers(),
        }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.wss = new WSServer({ server: this.httpServer });
    this.defaultRoom = this.createRoom('default');

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.httpServer.listen(port, () => {
      console.log(`[Server] WebSocket server listening on ws://localhost:${port}`);
      console.log(`[Server] Health check: http://localhost:${port}/health`);
    });
  }

  // ─── Connection Handling ────────────────────────────────────────

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const remoteAddr = req.socket.remoteAddress ?? 'unknown';
    console.log(`[Server] New connection from ${remoteAddr}`);

    ws.on('message', (data) => {
      try {
        const raw = typeof data === 'string' ? data : data.toString();
        const msg: ClientMessage = JSON.parse(raw);
        this.handleMessage(ws, msg);
      } catch (err) {
        console.error('[Server] Failed to parse message:', err);
        this.sendError(ws, 'PARSE_ERROR', 'Invalid JSON message');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('[Server] WebSocket error:', err.message);
    });
  }

  // ─── Message Dispatch ───────────────────────────────────────────

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case ClientMessageType.Join:
        this.handleJoin(ws, msg);
        break;

      case ClientMessageType.Input:
        this.handleInput(ws, msg);
        break;

      case ClientMessageType.Ping:
        this.handlePing(ws, msg);
        break;

      default:
        this.sendError(ws, 'UNKNOWN_TYPE', `Unknown message type`);
    }
  }

  // ─── Join ───────────────────────────────────────────────────────

  private handleJoin(ws: WebSocket, msg: JoinMessage): void {
    // Use default room for now
    const room = this.defaultRoom;

    if (room.isFull) {
      this.sendError(ws, 'ROOM_FULL', 'Room is full');
      return;
    }

    const entityId = room.addPlayer(msg.playerId, msg.tankId, ws, msg.playerName);
    if (!entityId) {
      this.sendError(ws, 'JOIN_FAILED', 'Failed to join room');
      return;
    }

    this.connectionToRoom.set(ws, room);
    console.log(`[Server] Player ${msg.playerId} joined room ${room.id}`);
  }

  // ─── Input ──────────────────────────────────────────────────────

  private handleInput(ws: WebSocket, msg: InputMessage): void {
    const room = this.connectionToRoom.get(ws);
    if (!room) return;

    const player = room.getPlayerByWs(ws);
    if (!player) return;

    room.bufferInput(player.playerId, msg.input);
  }

  // ─── Ping/Pong ──────────────────────────────────────────────────

  private handlePing(ws: WebSocket, msg: ClientPingMessage): void {
    const pong: PongMessage = {
      type: ServerMessageType.Pong,
      clientTime: msg.clientTime,
      serverTime: Date.now() as Milliseconds,
    };
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(pong));
    }
  }

  // ─── Disconnect ─────────────────────────────────────────────────

  private handleDisconnect(ws: WebSocket): void {
    const room = this.connectionToRoom.get(ws);
    if (room) {
      const player = room.getPlayerByWs(ws);
      if (player) {
        room.removePlayer(player.playerId);
      }
      this.connectionToRoom.delete(ws);
    }
    console.log('[Server] Client disconnected');
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private sendError(ws: WebSocket, code: string, message: string): void {
    const err: ErrorMessage = {
      type: ServerMessageType.Error,
      code,
      message,
    };
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(err));
    }
  }

  private createRoom(id: string): Room {
    const room = new Room(id);
    this.rooms.set(id, room);
    return room;
  }

  private getTotalPlayers(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.playerCount;
    }
    return total;
  }

  /**
   * Graceful shutdown.
   */
  close(): void {
    for (const room of this.rooms.values()) {
      room.stop();
    }
    this.wss.close();
    this.httpServer.close();
    console.log('[Server] Shut down');
  }
}
