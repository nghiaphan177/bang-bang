// ═══════════════════════════════════════════════════════════════════
// tank.ts — Tank attributes, roster IDs, definitions
// Stats: atk, range, defP, defE, attackSpeed, speed, hp
// Crit rate/damage are on specific tank passives, NOT base stats.
// hitboxRadius per tank (grows with level)
// ═══════════════════════════════════════════════════════════════════

import type { GridUnits, Seconds, Percentage } from './core';
import type { AttackDefinition, SkillDefinition, PassiveDefinition } from './skills';

// ─── Tank Identifiers ───────────────────────────────────────────────

export enum TankId {
  IronMan = 'IronMan',
  Naruto = 'Naruto',
  SpiderMan = 'SpiderMan',
  ThanhGiong = 'ThanhGiong',
}

// ─── Tank Roles ─────────────────────────────────────────────────────

export enum TankRole {
  HoverADC = 'HoverADC',
  Assassin = 'Assassin',
  SupportCC = 'SupportCC',
  TankerBruiser = 'TankerBruiser',
}

// ─── Tank Attributes (7 Base Stats) ────────────────────────────────
// Crit rate & crit damage are NOT here — they come from tank passives.

export interface TankAttributes {
  /** Max Hit Points */
  readonly hp: number;
  /** Attack power (single stat — skill formula uses atkScaling) */
  readonly atk: number;
  /** Attack range in pixels */
  readonly range: number;
  /** Physical defense — mitigates Physical channel damage */
  readonly defP: number;
  /** Energy defense — mitigates Energy channel damage */
  readonly defE: number;
  /** Attacks per second. Basic Attack CD = 1.0 / attackSpeed */
  readonly attackSpeed: number;
  /** Movement speed (Grid Units per second) */
  readonly speed: GridUnits;
  /** Projectile speed (Grid Units per second) */
  readonly projectileSpeed: number;
}

// ─── CDR Cap (from gear/buffs, not base stat) ───────────────────────

export const MAX_CDR: Percentage = 0.40 as Percentage;

// ─── Tank Definition ────────────────────────────────────────────────
// 3 Skill Slots: Attack (LMB), E, Space

export interface TankDefinition {
  readonly id: TankId;
  readonly name: string;
  readonly role: TankRole;
  /** Whether this tank can traverse Water tiles */
  readonly hover: boolean;
  /** Base circle hitbox radius (grows with level) */
  readonly hitboxRadius: number;
  readonly attributes: TankAttributes;
  readonly passive: PassiveDefinition;
  /** LMB — Basic Attack */
  readonly attack: AttackDefinition;
  /** E — Active Skill */
  readonly skillE: SkillDefinition;
  /** Space — Ultimate */
  readonly skillSpace: SkillDefinition;
}

// ─── Roster Map ─────────────────────────────────────────────────────

export type TankRosterMap = Record<TankId, TankDefinition>;
