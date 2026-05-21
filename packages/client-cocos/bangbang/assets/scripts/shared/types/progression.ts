// ═══════════════════════════════════════════════════════════════════
// progression.ts — In-match evolution: 5 levels, 5 visual tiers
// Each level = new visual tier. Hitbox grows with level.
// ═══════════════════════════════════════════════════════════════════

import type { TankId } from './tank';

// ─── Evolution Tiers (5 levels = 5 visual tiers) ────────────────────

export enum EvolutionTier {
  Tier1 = 1,
  Tier2 = 2,
  Tier3 = 3,
  Tier4 = 4,
  Tier5 = 5,
}

// ─── Level Stat Multipliers ─────────────────────────────────────────

export const LEVEL_STAT_MULTIPLIERS = {
  1: 1.0,
  2: 1.1,
  3: 1.25,
  4: 1.4,
  5: 1.6,
} as const;

export const MAX_LEVEL = 5;

// ─── Level → Tier Mapping (1:1 for 5 visual tiers) ─────────────────

export function getTierForLevel(level: number): EvolutionTier {
  return Math.min(Math.max(level, 1), 5) as EvolutionTier;
}

// ─── Hitbox Scale per Level ─────────────────────────────────────────
// Tank gets a bit bigger each level.

export const HITBOX_SCALE_PER_LEVEL = {
  1: 1.0,
  2: 1.05,
  3: 1.10,
  4: 1.15,
  5: 1.20,
} as const;

// ─── Hardware Slots (Out-of-Match Upgrades) ─────────────────────────

export enum HardwareSlot {
  Cannon = 'Cannon',
  Chassis = 'Chassis',
  Tracks = 'Tracks',
  CoolingEngine = 'CoolingEngine',
}

export interface HardwareStatBonuses {
  readonly atk?: number;
  readonly hp?: number;
  readonly defP?: number;
  readonly defE?: number;
  readonly speed?: number;
  readonly attackSpeed?: number;
  readonly range?: number;
}

export interface HardwareLv10Passive {
  readonly slot: HardwareSlot;
  readonly description: string;
}

export interface HardwareItem {
  readonly slot: HardwareSlot;
  readonly level: number;
  readonly statBonuses: HardwareStatBonuses;
  readonly lv10Passive?: HardwareLv10Passive;
}

export interface TankProgression {
  readonly tankId: TankId;
  readonly hardware: Record<HardwareSlot, HardwareItem>;
}
