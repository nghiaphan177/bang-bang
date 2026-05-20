// ═══════════════════════════════════════════════════════════════════
// NetworkClient.ts — WebSocket client for Phaser game
// Connects to server, sends inputs, receives snapshots.
// ═══════════════════════════════════════════════════════════════════

import {
  type PlayerId,
  type TankId,
  type Milliseconds,
  ClientMessageType,
  type JoinMessage,
  type InputMessage,
  type ClientPingMessage,
  type PlayerInput,
  type ServerMessage,
  ServerMessageType,
  type SnapshotMessage,
  type GameEventMessage,
  type PongMessage,
  type GameSnapshot,
  type GameEvent,
} from '@bang-bang/shared';

export interface NetworkClientOptions {
  url: string;
  playerId: PlayerId;
  tankId: TankId;
  playerName: string;
}

export type SnapshotCallback = (snapshot: GameSnapshot) => void;
export type GameEventCallback = (event: GameEvent) => void;
export type ConnectionCallback = () => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private readonly options: NetworkClientOptions;
  private connected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private inputSeq = 0;

  // RTT measurement
  private lastPingTime = 0;
  private rtt = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  private onSnapshotCb: SnapshotCallback | null = null;
  private onGameEventCb: GameEventCallback | null = null;
  private onConnectCb: ConnectionCallback | null = null;
  private onDisconnectCb: ConnectionCallback | null = null;

  constructor(options: NetworkClientOptions) {
    this.options = options;
  }

  // ─── Connection ─────────────────────────────────────────────────

  connect(): void {
    if (this.ws) return;

    console.log(`[Net] Connecting to ${this.options.url}...`);
    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[Net] Connected');

      // Send join message
      const join: JoinMessage = {
        type: ClientMessageType.Join,
        playerId: this.options.playerId,
        tankId: this.options.tankId,
        playerName: this.options.playerName,
      };
      this.send(join);

      // Start ping loop
      this.startPingLoop();

      this.onConnectCb?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[Net] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.stopPingLoop();
      console.log('[Net] Disconnected');
      this.onDisconnectCb?.();
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[Net] WebSocket error:', err);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingLoop();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getRTT(): number {
    return this.rtt;
  }

  // ─── Input Sending ──────────────────────────────────────────────

  sendInput(input: Omit<PlayerInput, 'seq'>): void {
    if (!this.connected) return;

    const fullInput: PlayerInput = {
      ...input,
      seq: this.inputSeq++,
    };

    const msg: InputMessage = {
      type: ClientMessageType.Input,
      input: fullInput,
      timestamp: Date.now() as Milliseconds,
    };

    this.send(msg);
  }

  getNextSeq(): number {
    return this.inputSeq;
  }

  // ─── Message Handling ───────────────────────────────────────────

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case ServerMessageType.Snapshot:
        this.onSnapshotCb?.((msg as SnapshotMessage).snapshot);
        break;

      case ServerMessageType.GameEvent:
        this.onGameEventCb?.((msg as GameEventMessage).event);
        break;

      case ServerMessageType.Pong: {
        const pong = msg as PongMessage;
        this.rtt = Date.now() - (pong.clientTime as number);
        break;
      }

      case ServerMessageType.Error:
        console.error(`[Net] Server error: ${msg.code} — ${msg.message}`);
        break;

      case ServerMessageType.MatchStart:
        console.log('[Net] Match started');
        break;

      case ServerMessageType.MatchEnd:
        console.log('[Net] Match ended');
        break;
    }
  }

  // ─── Callbacks ──────────────────────────────────────────────────

  onSnapshot(cb: SnapshotCallback): void { this.onSnapshotCb = cb; }
  onGameEvent(cb: GameEventCallback): void { this.onGameEventCb = cb; }
  onConnect(cb: ConnectionCallback): void { this.onConnectCb = cb; }
  onDisconnect(cb: ConnectionCallback): void { this.onDisconnectCb = cb; }

  // ─── Ping ───────────────────────────────────────────────────────

  private startPingLoop(): void {
    this.pingInterval = setInterval(() => {
      this.lastPingTime = Date.now();
      const ping: ClientPingMessage = {
        type: ClientMessageType.Ping,
        clientTime: this.lastPingTime as Milliseconds,
      };
      this.send(ping);
    }, 2000); // Ping every 2s
  }

  private stopPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ─── Reconnect ──────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Net] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    this.reconnectAttempts++;
    console.log(`[Net] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // ─── Send ───────────────────────────────────────────────────────

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
