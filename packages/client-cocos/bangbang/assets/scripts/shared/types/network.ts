// ═══════════════════════════════════════════════════════════════════
// network.ts — WebSocket message schemas (Client ↔ Server)
// 3 Skill Slots: Attack(LMB), E, Space
// TankSnapshot is minimal — no shield/level/exp/isStealth for now
// ═══════════════════════════════════════════════════════════════════

import type { EntityId, PlayerId, Vector2, Radians, Milliseconds } from './core';
import type { TankId } from './tank';
export type { EntityId, PlayerId, Vector2, Radians, Milliseconds, TankId };
import type { StatusEffect, ProjectileState } from './combat';
import type { GameModeConfig, TeamId } from './game-modes';
import type { TileDefinition } from './environment';
import { MatchPhase } from './state-machine';

// ═══════════════════════════════════════════════════════════════════
// CLIENT → SERVER
// ═══════════════════════════════════════════════════════════════════

export enum ClientMessageType {
  Join = 'Join',
  Input = 'Input',
  Ping = 'Ping',
}

/** Per-tick player input sent to server */
export interface PlayerInput {
  readonly moveDir: Vector2 | null;
  readonly aimAngle: Radians;
  /** LMB held = fire basic attack */
  readonly fire: boolean;
  /** E key pressed */
  readonly skillE: boolean;
  /** Space key pressed */
  readonly skillSpace: boolean;
  /** Client-side sequence number for reconciliation */
  readonly seq: number;
}

export interface JoinMessage {
  readonly type: ClientMessageType.Join;
  readonly playerId: PlayerId;
  readonly tankId: TankId;
  readonly playerName: string;
}

export interface InputMessage {
  readonly type: ClientMessageType.Input;
  readonly input: PlayerInput;
  readonly timestamp: Milliseconds;
}

export interface ClientPingMessage {
  readonly type: ClientMessageType.Ping;
  readonly clientTime: Milliseconds;
}

export type ClientMessage =
  | JoinMessage
  | InputMessage
  | ClientPingMessage;

// ═══════════════════════════════════════════════════════════════════
// SERVER → CLIENT
// ═══════════════════════════════════════════════════════════════════

export enum ServerMessageType {
  Snapshot = 'Snapshot',
  GameEvent = 'GameEvent',
  Pong = 'Pong',
  Error = 'Error',
  MatchStart = 'MatchStart',
  MatchEnd = 'MatchEnd',
}

/** Per-tank snapshot — minimal for now */
export interface TankSnapshot {
  readonly entityId: EntityId;
  readonly playerId: PlayerId;
  readonly tankId: TankId;
  readonly position: Vector2;
  readonly hullRotation: Radians;
  readonly turretRotation: Radians;
  readonly hp: number;
  readonly maxHp: number;
  readonly activeEffects: readonly StatusEffect[];
  readonly isAlive: boolean;
  readonly team: TeamId;
}

/** Full authoritative game state for a tick */
export interface GameSnapshot {
  readonly tick: number;
  readonly timestamp: Milliseconds;
  readonly tanks: readonly TankSnapshot[];
  readonly projectiles: readonly ProjectileState[];
  readonly mapDelta: readonly MapDeltaEntry[];
  readonly lastProcessedInput: number;
  readonly matchState: MatchState;
}

export interface MapDeltaEntry {
  readonly col: number;
  readonly row: number;
  readonly tile: TileDefinition;
}

// ─── Match State (uses MatchPhase from state-machine.ts) ────────────

export interface PlayerScore {
  readonly playerId: PlayerId;
  readonly tankId: TankId;
  readonly team: TeamId;
  readonly kills: number;
  readonly deaths: number;
}

export interface MatchState {
  readonly phase: MatchPhase;
  /** Countdown seconds remaining (during Countdown phase) */
  readonly countdownSec: number;
  /** Match elapsed time in seconds (during Playing phase) */
  readonly matchTimeSec: number;
  /** Total match time limit in seconds */
  readonly matchTimeLimitSec: number;
  /** Per-player scores */
  readonly scores: readonly PlayerScore[];
  /** Per-team total kills: { Red: N, Blue: M } */
  readonly teamScores: Record<string, number>;
  /** Winning team ID (set during MatchEnd) */
  readonly winnerId: string;
  /** Kill target for win condition */
  readonly killTarget: number;
}

// ─── Game Events ────────────────────────────────────────────────────

export enum GameEventType {
  Kill = 'Kill',
  Respawn = 'Respawn',
  FlagPickup = 'FlagPickup',
  FlagDrop = 'FlagDrop',
  FlagScore = 'FlagScore',
  PickupSpawn = 'PickupSpawn',
  PickupCollect = 'PickupCollect',
  BossPhaseChange = 'BossPhaseChange',
  BaseDestroyed = 'BaseDestroyed',
}

export interface GameEvent {
  readonly eventType: GameEventType;
  readonly timestamp: Milliseconds;
  readonly data: Record<string, unknown>;
}

// ─── Server Message Types ───────────────────────────────────────────

export interface SnapshotMessage {
  readonly type: ServerMessageType.Snapshot;
  readonly snapshot: GameSnapshot;
}

export interface GameEventMessage {
  readonly type: ServerMessageType.GameEvent;
  readonly event: GameEvent;
}

export interface PongMessage {
  readonly type: ServerMessageType.Pong;
  readonly clientTime: Milliseconds;
  readonly serverTime: Milliseconds;
}

export interface ErrorMessage {
  readonly type: ServerMessageType.Error;
  readonly code: string;
  readonly message: string;
}

export interface MatchStartMessage {
  readonly type: ServerMessageType.MatchStart;
  readonly modeConfig: GameModeConfig;
  readonly players: readonly MatchPlayer[];
}

export interface MatchPlayer {
  readonly playerId: PlayerId;
  readonly tankId: TankId;
  readonly team: TeamId;
}

export interface MatchEndMessage {
  readonly type: ServerMessageType.MatchEnd;
  readonly winnerTeam: TeamId;
  readonly scores: readonly PlayerScore[];
  readonly matchDurationSec: number;
}

export type ServerMessage =
  | SnapshotMessage
  | GameEventMessage
  | PongMessage
  | ErrorMessage
  | MatchStartMessage
  | MatchEndMessage;
