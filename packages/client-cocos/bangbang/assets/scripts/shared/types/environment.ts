// ═══════════════════════════════════════════════════════════════════
// environment.ts — Map tiles, collision states, game map, pickups
// GDD §6: Environment & Pickups
// ═══════════════════════════════════════════════════════════════════

import type { GridUnits, Milliseconds, Vector2 } from './core';

// ─── Tile Types (GDD §6.1) ─────────────────────────────────────────

export enum TileType {
  Ground = 'Ground',
  /** Indestructible. Blocks movement & projectiles. */
  SteelWall = 'SteelWall',
  /** Has HP. Blocks movement & projectiles. Destructible. */
  BrickWall = 'BrickWall',
  /** Stealth zone. Tanks inside are invisible to outsiders. */
  Bush = 'Bush',
  /** Blocks treaded tanks. Projectiles + vision pass through. */
  Water = 'Water',
  /** Like Water but deals damage. */
  Lava = 'Lava',
  /** Paired portals A↔B. Anti-loop cooldown per entity. */
  Teleporter = 'Teleporter',
  /** Indestructible box object. Rendered as sprite on top of map_bg. */
  SteelBox = 'SteelBox',
  /** Destructible box. Chance to drop pickup on break. Rendered as sprite. */
  WoodBox = 'WoodBox',
}

// ─── Bush Visibility State Machine (GDD §1.3) ──────────────────────

export enum BushVisibilityState {
  Stealth = 'Stealth',
  Visible = 'Visible',
}

export const BUSH_REVEAL_DURATION_SEC = 2.5 as const;

// ─── Tile State Definitions ─────────────────────────────────────────

export interface BrickWallState {
  readonly type: TileType.BrickWall;
  readonly maxHp: number;
  hp: number;
  destroyed: boolean;
}

export interface SteelWallState {
  readonly type: TileType.SteelWall;
}

export interface BushState {
  readonly type: TileType.Bush;
  visibility: BushVisibilityState;
  visibleUntilMs: Milliseconds | null;
}

export interface WaterState {
  readonly type: TileType.Water;
}

export interface LavaState {
  readonly type: TileType.Lava;
  /** DPS to entities standing on it */
  readonly damagePerSec?: number;
}

export interface TeleporterState {
  readonly type: TileType.Teleporter;
  /** Links portal A to portal B */
  readonly pairId: string;
}

export interface GroundState {
  readonly type: TileType.Ground;
}

export interface SteelBoxState {
  readonly type: TileType.SteelBox;
}

export interface WoodBoxState {
  readonly type: TileType.WoodBox;
  readonly maxHp: number;
  hp: number;
  destroyed: boolean;
}

// ─── Discriminated Union ────────────────────────────────────────────

export type TileDefinition =
  | BrickWallState
  | SteelWallState
  | BushState
  | WaterState
  | LavaState
  | TeleporterState
  | GroundState
  | SteelBoxState
  | WoodBoxState;

// ─── Game Map Schema ────────────────────────────────────────────────

export interface GameMap {
  readonly name: string;
  readonly widthGrids: GridUnits;
  readonly heightGrids: GridUnits;
  /** 2D array indexed as tiles[row][col] */
  readonly tiles: TileDefinition[][];
}

// ─── Pickup Types (GDD §6.2) ───────────────────────────────────────

export enum PickupType {
  /** Heal 35% Max HP instantly */
  RepairKit = 'RepairKit',
  /** Reset all cooldowns to 0 */
  ClockReset = 'ClockReset',
  /** +100% basic attack damage for 10 seconds */
  DamageAmplifier = 'DamageAmplifier',
  /** Grant shield = 30% Max HP (permanent until broken) */
  ShieldGenerator = 'ShieldGenerator',
}

export interface PickupEntity {
  readonly id: string;
  readonly type: PickupType;
  readonly position: Vector2;
  readonly isCollected: boolean;
  /** Respawn timer in ms (null = no respawn) */
  readonly respawnMs?: number;
}
