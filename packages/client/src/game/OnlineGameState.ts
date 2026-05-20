// ═══════════════════════════════════════════════════════════════════
// OnlineGameState.ts — Online multiplayer state manager
//
// Wraps NetworkClient + ClientPrediction + EntityInterpolation
// into a clean interface that GameScene can swap in for LocalGameState.
// ═══════════════════════════════════════════════════════════════════

import {
  type PlayerId,
  type TankId,
  type GameMap,
  type TileDefinition,
  type GameSnapshot,
  type TankSnapshot,
  type ProjectileState,
  type MatchState,
  type Vector2,
  type Radians,
  type GridUnits,
  TileType,
  MatchPhase,
  BushVisibilityState,
  loadCollisionMap,
  ARCTIC_COLLISION,
} from '@bang-bang/shared';
import { NetworkClient, type NetworkClientOptions } from '../network/NetworkClient';
import { ClientPrediction } from '../network/ClientPrediction';
import {
  EntityInterpolation,
  type InterpolatedEntity,
} from '../network/EntityInterpolation';
import type { LocalInput } from '../input/InputManager';

// ─── Types for renderers ────────────────────────────────────────────

/** Matches the RenderableTank interface used by TankRenderer */
export interface OnlinePlayerTank {
  transform: { position: { x: number; y: number }; rotation: number };
  turret: { aimAngle: number };
  health: { hp: number; maxHp: number; isAlive: boolean };
  cooldowns: {
    skillE: { remainingMs: number; cooldownMs: number; isReady: boolean };
    skillSpace: { remainingMs: number; cooldownMs: number; isReady: boolean };
  };
}

/** Renderable remote tank (from interpolation) */
export interface RemoteTankData {
  entityId: string;
  position: { x: number; y: number };
  hullRotation: number;
  turretRotation: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  tankId: string;
  team: string;
}

/** Renderable projectile from server snapshot */
export interface OnlineProjectile {
  id: string;
  transform: { position: { x: number; y: number }; rotation: number };
  projectile: { phase: string };
}

// ═══════════════════════════════════════════════════════════════════

const SERVER_URL = 'ws://localhost:8080';
const SERVER_INFO_URL = 'http://localhost:8080/info';

export class OnlineGameState {
  private networkClient: NetworkClient;
  private prediction: ClientPrediction;
  private interpolation: EntityInterpolation;

  // Player identity
  public readonly playerId: PlayerId;
  public readonly tankId: TankId;

  // Snapshot state
  private latestSnapshot: GameSnapshot | null = null;
  private myTankSnapshot: TankSnapshot | null = null;
  private initialized = false;

  // Connection state
  private _connected = false;
  private _rtt = 0;
  private _playerCount = 0;

  // Map (default — same as server)
  private map: GameMap;

  // Current aim angle (for rendering turret locally)
  private currentAimAngle: number = 0;

  // Match state (from latest snapshot)
  private _matchState: MatchState = {
    phase: MatchPhase.WaitingForPlayers,
    countdownSec: 0,
    matchTimeSec: 0,
    matchTimeLimitSec: 300,
    scores: [],
    teamScores: {},
    winnerId: '',
    killTarget: 10,
  };

  constructor(playerId: PlayerId, tankId: TankId) {
    this.playerId = playerId;
    this.tankId = tankId;

    this.prediction = new ClientPrediction(playerId as string);
    this.interpolation = new EntityInterpolation(playerId as string);

    const options: NetworkClientOptions = {
      url: SERVER_URL,
      playerId,
      tankId,
      playerName: `Player_${(playerId as string).slice(-4)}`,
    };
    this.networkClient = new NetworkClient(options);

    // Create default map (must match server's createDefaultMap)
    this.map = this.createDefaultMap();

    // Wire callbacks
    this.networkClient.onSnapshot((snapshot) => this.handleSnapshot(snapshot));
    this.networkClient.onConnect(() => {
      this._connected = true;
      console.log('[Online] Connected to server');
    });
    this.networkClient.onDisconnect(() => {
      this._connected = false;
      console.log('[Online] Disconnected from server');
    });
  }

  // ─── Connection ─────────────────────────────────────────────────

  connect(): void {
    this.networkClient.connect();
  }

  disconnect(): void {
    this.networkClient.disconnect();
    this._connected = false;
  }

  get connected(): boolean { return this._connected; }
  get rtt(): number { return this.networkClient.getRTT(); }
  get playerCount(): number { return this._playerCount; }
  get isInitialized(): boolean { return this.initialized; }

  // ─── Static server probe ────────────────────────────────────────

  static async isServerAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(SERVER_INFO_URL, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) return false;
      const data = await resp.json();
      return data.name === 'bang-bang-server';
    } catch {
      return false;
    }
  }

  // ─── Input Processing ───────────────────────────────────────────

  processInput(input: LocalInput, dt: number): void {
    if (!this._connected) return;

    this.currentAimAngle = input.aimAngle as number;

    // Build PlayerInput with seq
    const seq = this.networkClient.getNextSeq();
    const playerInput = {
      moveDir: input.moveDir,
      aimAngle: input.aimAngle,
      fire: input.fire,
      skillE: input.skillE,
      skillSpace: input.skillSpace,
      seq,
    };

    // Apply locally for prediction
    this.prediction.applyInput(playerInput, dt);

    // Send to server (this increments the seq internally)
    this.networkClient.sendInput(input);
  }

  // ─── Snapshot Handling ──────────────────────────────────────────

  private handleSnapshot(snapshot: GameSnapshot): void {
    this.latestSnapshot = snapshot;
    this._playerCount = snapshot.tanks.length;
    if (snapshot.matchState) {
      this._matchState = snapshot.matchState;
    }

    // Find our tank
    const myTank = snapshot.tanks.find(
      t => (t.playerId as string) === (this.playerId as string)
    );

    if (myTank) {
      this.myTankSnapshot = myTank;

      // Initialize prediction on first snapshot
      if (!this.initialized) {
        this.prediction.initFromSnapshot(myTank);
        this.prediction.speed = 3.5; // Will be overridden by server data
        this.initialized = true;
        console.log('[Online] Initialized from first snapshot');
      }

      // Reconcile prediction with server
      this.prediction.reconcile(snapshot);
    }

    // Push to interpolation for remote entities
    this.interpolation.pushSnapshot(snapshot.timestamp as number, snapshot.tanks);

    // Apply map deltas
    for (const delta of snapshot.mapDelta) {
      if (
        delta.row >= 0 && delta.row < (this.map.heightGrids as number) &&
        delta.col >= 0 && delta.col < (this.map.widthGrids as number)
      ) {
        (this.map.tiles[delta.row] as TileDefinition[])[delta.col] = delta.tile;
      }
    }
  }

  // ─── Data Accessors (for renderers) ─────────────────────────────

  getMap(): GameMap {
    return this.map;
  }

  /** Returns the current match state */
  getMatchState(): MatchState {
    return this._matchState;
  }

  /** Returns renderable local player tank data (from prediction) */
  getPlayerEntity(): OnlinePlayerTank {
    const tank = this.myTankSnapshot;
    return {
      transform: {
        position: { ...this.prediction.position },
        rotation: this.prediction.hullRotation,
      },
      turret: { aimAngle: this.currentAimAngle },
      health: {
        hp: tank?.hp ?? 100,
        maxHp: tank?.maxHp ?? 100,
        isAlive: tank?.isAlive ?? true,
      },
      cooldowns: {
        skillE: { remainingMs: 0, cooldownMs: 9000, isReady: true },
        skillSpace: { remainingMs: 0, cooldownMs: 42000, isReady: true },
      },
    };
  }

  /** Returns all remote tanks (interpolated) */
  getRemoteTanks(): RemoteTankData[] {
    const interpolated = this.interpolation.getInterpolatedEntities(Date.now());
    return interpolated.map(e => ({
      entityId: e.entityId,
      position: e.position,
      hullRotation: e.hullRotation,
      turretRotation: e.turretRotation,
      hp: e.hp,
      maxHp: e.maxHp,
      isAlive: e.isAlive,
      tankId: e.tankId,
      team: e.team,
    }));
  }

  /** Returns renderable projectiles from latest snapshot */
  getProjectiles(): OnlineProjectile[] {
    if (!this.latestSnapshot) return [];
    return this.latestSnapshot.projectiles.map(p => {
      const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y);
      const rotation = speed > 0 ? Math.atan2(p.velocity.y, p.velocity.x) : 0;
      return {
        id: p.id,
        transform: {
          position: { x: p.position.x, y: p.position.y },
          rotation,
        },
        projectile: { phase: 'Active' },
      };
    });
  }

  // ─── Default Map (must match server) ────────────────────────────

  private createDefaultMap(): GameMap {
    return loadCollisionMap(ARCTIC_COLLISION);
  }
}
