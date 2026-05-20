// ═══════════════════════════════════════════════════════════════════
// skills.ts — Skill definitions, projectile archetypes, damage formulas
// GDD §4: Skills & Projectiles (NO ENERGY/MANA — cooldown only)
// Keybinds: LMB = Attack, E = Skill, SPACE = Ultimate
// 3 Skill Slots only.
// ═══════════════════════════════════════════════════════════════════

import type { Seconds, Degrees } from './core';

// ─── Skill Slot Keybindings (3 Slots) ───────────────────────────────

export enum SkillSlot {
  /** LMB — Basic Attack. Infinite, gated by Attack_Speed */
  Attack = 'Attack',
  /** E — Active Skill */
  E = 'E',
  /** Space — Ultimate Skill */
  Space = 'Space',
}

// ─── Targeting Systems ──────────────────────────────────────────────

export enum TargetingType {
  Linear = 'Linear',
  Cone = 'Cone',
  Parabolic = 'Parabolic',
  PointBlank = 'PointBlank',
  Self = 'Self',
  Homing = 'Homing',
  Hold = 'Hold',
  Dash = 'Dash',
}

// ─── Projectile Archetypes (GDD §4.2) ──────────────────────────────

export enum ProjectileArchetype {
  /** Raycast instant hit — no travel time */
  Hitscan = 'HITSCAN',
  /** Straight-line projectile — destroys on hit or wall */
  Linear = 'LINEAR',
  /** Passes through enemies — only stops on walls or max range */
  Piercing = 'PIERCING',
  /** Reflects off walls */
  Bouncing = 'BOUNCING',
  /** Parabolic arc — ignores obstacles, AoE on landing */
  Lob = 'LOB',
  /** Locks target — Turn_Rate limited steering */
  Homing = 'HOMING',
  /** Dash skill — moves the caster */
  Dash = 'DASH',
}

// ─── Damage Channel ─────────────────────────────────────────────────
// Determines which DEF stat mitigates the damage.

export enum DamageChannel {
  /** Mitigated by target.defP */
  Physical = 'Physical',
  /** Mitigated by target.defE */
  Energy = 'Energy',
  /** Bypasses all defense */
  True = 'True',
}

// ─── Damage Formula ─────────────────────────────────────────────────
// Raw = baseDamage + (attacker.atk * atkScaling)
// EffDef = (Physical → target.defP) | (Energy → target.defE) | (True → 0)
// Mitigation = 100 / (100 + EffDef)
// Final = floor(Raw * Mitigation). Min 1 if Raw > 0.

export interface DamageFormula {
  readonly baseDamage: number;
  /** Scaling coefficient applied to tank.atk */
  readonly atkScaling: number;
  /** Which defense stat mitigates this damage */
  readonly channel: DamageChannel;
}

// ─── Skill Effect ───────────────────────────────────────────────────

export interface SkillEffect {
  readonly effectType: string;
  readonly durationSec: Seconds;
  readonly magnitude?: number;
}

// ─── Passive Definition ─────────────────────────────────────────────

export interface PassiveDefinition {
  readonly name: string;
  readonly description: string;
}

// ─── Skill Definition ───────────────────────────────────────────────

export interface SkillDefinition {
  readonly slot: SkillSlot;
  readonly name: string;
  readonly cooldownSec: Seconds;
  readonly archetype: ProjectileArchetype;
  readonly targetingType: TargetingType;
  readonly damageFormula: DamageFormula;
  readonly effects: readonly SkillEffect[];
  readonly range?: number;
  readonly projectileSpeed?: number;
  readonly maxRange?: number;
  readonly maxBounces?: number;
  readonly turnRate?: Degrees;
  readonly airTime?: Seconds;
  readonly castTimeSec?: Seconds;
  readonly ignoresWalls?: boolean;
  readonly rootSelfDuringCast?: boolean;
}

// ─── Basic Attack Definition ────────────────────────────────────────
// Cooldown = 1.0 / TankAttributes.attackSpeed. Infinite ammo.

export interface AttackDefinition extends SkillDefinition {
  readonly slot: SkillSlot.Attack;
}
