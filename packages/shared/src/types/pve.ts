// ═══════════════════════════════════════════════════════════════════
// pve.ts — Boss encounters, phases, attack patterns
// GDD §5: PVE Campaign & Boss Encounters (3-player Co-op)
// ═══════════════════════════════════════════════════════════════════

import type { Seconds } from './core';
import type { DamageFormula, SkillEffect } from './skills';

// ─── Boss Identifiers ───────────────────────────────────────────────

export enum BossId {
  MechaSpider = 'MechaSpider',
  AlienSpaceship = 'AlienSpaceship',
}

// ─── Boss Phase State Machine ───────────────────────────────────────

export enum BossPhase {
  Phase1 = 'Phase1',
  Phase2 = 'Phase2',
  Stunned = 'Stunned',
  Vulnerable = 'Vulnerable',
  Dead = 'Dead',
}

// ─── Weak Points ────────────────────────────────────────────────────
// GDD §5.1 Mecha Spider: Front = 50% Dmg, Rear = 200% Dmg (Crit)

export type WeakPointZone = 'front' | 'rear';

export interface BossWeakPoint {
  readonly zone: WeakPointZone;
  /** Damage multiplier for hits to this zone */
  readonly damageMultiplier: number;
}

// ─── Boss Attack Patterns ───────────────────────────────────────────

export interface BossAttackPattern {
  readonly name: string;
  readonly description: string;
  /** Phase(s) in which this attack is used */
  readonly phases: readonly BossPhase[];
  /** Warning duration before the attack lands (e.g., Toxic Rain 1.5s) */
  readonly warningDurationSec?: Seconds;
  readonly damageFormula?: DamageFormula;
  readonly effects: readonly SkillEffect[];
  readonly ignoresWalls?: boolean;
}

// ─── Boss Phase Definition ──────────────────────────────────────────

export interface BossPhaseDefinition {
  readonly phase: BossPhase;
  /** HP threshold to enter this phase (fraction, e.g., 0.50 = below 50% HP) */
  readonly hpThreshold?: number;
  readonly description: string;
  readonly attackPatterns: readonly BossAttackPattern[];
  /** Speed multiplier in this phase (e.g., Mecha Spider Phase 2: x2) */
  readonly speedMultiplier?: number;
}

// ─── Boss Definition ────────────────────────────────────────────────

export interface BossDefinition {
  readonly id: BossId;
  readonly name: string;
  readonly hp: number;
  readonly phases: readonly BossPhaseDefinition[];
  readonly weakPoints: readonly BossWeakPoint[];
  /** Co-op player count */
  readonly playerCount: 3;
}
