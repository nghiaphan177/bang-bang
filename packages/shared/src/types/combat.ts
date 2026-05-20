// ═══════════════════════════════════════════════════════════════════
// combat.ts — Status effects, damage instances, projectile state
// Damage: Raw = baseDmg + atk*atkScaling
// Mitigation: 100/(100 + EffDef) where EffDef = defP or defE
// ═══════════════════════════════════════════════════════════════════

import type { EntityId, Vector2, Milliseconds } from './core';
import type { ProjectileArchetype, DamageChannel } from './skills';
import type { TankId } from './tank';

// ─── Status Effect Types (6 core) ──────────────────────────────────

export enum StatusEffectType {
  Stun = 'STUN',
  Root = 'ROOT',
  Silence = 'SILENCE',
  Slow = 'SLOW',
  Burn = 'BURN',
  Invulnerable = 'INVULNERABLE',
}

// ─── Status Effect Instance ─────────────────────────────────────────

export interface StatusEffect {
  readonly id: string;
  readonly type: StatusEffectType;
  /** e.g., 0.30 for 30% slow, DPS for Burn */
  readonly value?: number;
  /** Milliseconds remaining */
  readonly durationLeft: number;
}

// ─── Damage Instance ────────────────────────────────────────────────

export interface DamageInstance {
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly rawDamage: number;
  readonly channel: DamageChannel;
  readonly isCrit: boolean;
  readonly finalDamage: number;
  readonly appliedEffects: readonly StatusEffect[];
  readonly timestamp: Milliseconds;
}

// ─── Projectile Runtime State ───────────────────────────────────────

export interface ProjectileState {
  readonly id: string;
  readonly ownerId: string;
  readonly tankId?: TankId;
  readonly archetype: ProjectileArchetype;
  readonly damagePayload: number;
  readonly channel: DamageChannel;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly distanceTraveled: number;
  readonly maxRange: number;
  readonly maxBounces?: number;
  readonly bouncesLeft?: number;
  readonly targetId?: string;
  readonly turnRate?: number;
  readonly airTime?: number;
}
