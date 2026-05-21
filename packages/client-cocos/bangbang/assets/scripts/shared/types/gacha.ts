// ═══════════════════════════════════════════════════════════════════
// gacha.ts — Pull rates, pity system, player gacha state
// GDD §7: Gacha System
// ═══════════════════════════════════════════════════════════════════

import type { TankId } from './tank';

// ─── Rarity Tiers ───────────────────────────────────────────────────

export enum GachaRarity {
  Shards = 'Shards',
  BRank = 'BRank',
  ARank = 'ARank',
  SRank = 'SRank',
  SSRank = 'SSRank',
}

// ─── Pull Rates (GDD §7) ───────────────────────────────────────────

export const GACHA_RATES = {
  [GachaRarity.Shards]: 0.700,
  [GachaRarity.BRank]: 0.185,
  [GachaRarity.ARank]: 0.090,
  [GachaRarity.SRank]: 0.022,
  [GachaRarity.SSRank]: 0.003,
} as const;

// ─── Currency Costs (GDD §7) ────────────────────────────────────────
// Currency: Gold Coins (Premium)

export const GACHA_COSTS = {
  /** 1 Pull = 100 Gold Coins */
  singlePull: 100,
  /** 10 Pulls = 900 Gold Coins (10% discount) */
  tenPull: 900,
} as const;

// ─── Pity Configuration (GDD §7) ────────────────────────────────────
// B+: guaranteed every 5 pulls
// A+: guaranteed every 15 pulls
// S:  hard pity at 50 pulls -> 100% S-Rank drop
// SS: no pity, seasonal banners only

export interface PityConfig {
  readonly bRankEvery: 5;
  readonly aRankEvery: 15;
  readonly sRankHardPity: 50;
  readonly ssRankPity: null;
}

// ─── Pull Result ────────────────────────────────────────────────────

export interface GachaPullResult {
  readonly rarity: GachaRarity;
  readonly itemId: string;
  readonly tankId?: TankId;
  readonly isPity: boolean;
}

// ─── Player Pity Counters ───────────────────────────────────────────

export interface PlayerGachaState {
  readonly pullsSinceLastBRank: number;
  readonly pullsSinceLastARank: number;
  readonly pullsSinceLastSRank: number;
  readonly totalPulls: number;
}
