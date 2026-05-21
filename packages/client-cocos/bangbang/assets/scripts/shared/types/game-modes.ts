// ═══════════════════════════════════════════════════════════════════
// game-modes.ts — PVP game mode configs & runtime state
// GDD §4: Game Modes (PVP)
// ═══════════════════════════════════════════════════════════════════

import type { Seconds, EntityId, Vector2 } from './core';

// ─── Mode & Team Enums ──────────────────────────────────────────────

export enum GameMode {
  TeamDeathmatch = 'TeamDeathmatch',
  BaseDestruction = 'BaseDestruction',
  CaptureTheFlag = 'CaptureTheFlag',
  PVE = 'PVE',
}

export enum TeamId {
  Red = 'Red',
  Blue = 'Blue',
  Neutral = 'Neutral',
}

// ─── Team Deathmatch (GDD §4.1) ────────────────────────────────────
// Win: First team to 25 kills
// Respawn: 5s fixed, Safe Zone spawn, 3s Invulnerability
// Safe Zone: Invisible wall blocks enemies, allies heal 10% HP/s

export interface TDMConfig {
  readonly mode: GameMode.TeamDeathmatch;
  readonly killsToWin: 25;
  readonly respawnTimeSec: 5;
  readonly invulnDurationSec: 3;
  /** Allies in Safe Zone heal this fraction of HP per second */
  readonly safeZoneHealPerSec: 0.10;
  /** Enemies in Safe Zone take this True DPS (GDD §7.1) */
  readonly safeZoneEnemyDps: 2000;
}

// ─── Base Destruction (GDD §4.2) ────────────────────────────────────
// Main Base: 50,000 HP, 50% Damage Reduction vs Skills
// Airdrops: Random spawns with one-time active items

export enum AirdropType {
  Landmine = 'Landmine',
  /** 50% HP Repair Kit */
  RepairKit = 'RepairKit',
  /** 100% Armor Pen for 5s */
  ArmorPiercingRounds = 'ArmorPiercingRounds',
}

export interface AirdropDefinition {
  readonly type: AirdropType;
  readonly description: string;
  /** Duration in seconds (null = instant effect like RepairKit) */
  readonly durationSec: Seconds | null;
}

export interface BaseDestructionConfig {
  readonly mode: GameMode.BaseDestruction;
  readonly baseHp: 50_000;
  /** Skills deal 50% reduced damage to base — must use normal attacks */
  readonly skillDamageReduction: 0.50;
}

// ─── Capture the Flag (GDD §4.3) ────────────────────────────────────
// Touch enemy flag to pick up, carry to ally base to score
// Flag Carrier: Revealed, -20% SPD, Dash/Teleport disabled
// Drop: 10s timer, ally touch = resume, enemy touch = reset

export interface CTFConfig {
  readonly mode: GameMode.CaptureTheFlag;
  readonly scoresToWin: 3;
  readonly flagDropTimeSec: 15;
  /** Flag carrier SPD_M reduction */
  readonly carrierSpdReduction: 0.20;
  readonly carrierDisableDash: true;
  readonly carrierRevealed: true;
}

// ─── Discriminated Union ────────────────────────────────────────────

export type GameModeConfig = TDMConfig | BaseDestructionConfig | CTFConfig;

// ─── Runtime State Types ────────────────────────────────────────────

export interface FlagState {
  readonly team: TeamId;
  readonly position: Vector2;
  readonly carrierId: EntityId | null;
  /** Timestamp when flag was dropped (null = not dropped) */
  readonly droppedAtMs: number | null;
}

export interface BaseState {
  readonly team: TeamId;
  readonly position: Vector2;
  readonly hp: number;
  readonly maxHp: number;
}
