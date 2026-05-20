// ═══════════════════════════════════════════════════════════════════
// components.ts — Runtime component data attached to entities
// These are MUTABLE game state, unlike the readonly type definitions
// ═══════════════════════════════════════════════════════════════════

import {
  type EntityId,
  type PlayerId,
  type Vector2,
  type Radians,
  type Milliseconds,
} from '@bang-bang/shared';
import { type TankId } from '@bang-bang/shared';
import { TankState, ProjectilePhase } from '@bang-bang/shared';
import { type StatusEffectType } from '@bang-bang/shared';
import { ProjectileArchetype, DamageChannel, SkillSlot } from '@bang-bang/shared';
import { type TileType, type BushVisibilityState } from '@bang-bang/shared';
import { type TeamId } from '@bang-bang/shared';

// ─── Transform ──────────────────────────────────────────────────────

export interface TransformComponent {
  position: Vector2;
  rotation: Radians;
}

// ─── Velocity ───────────────────────────────────────────────────────

export interface VelocityComponent {
  velocity: Vector2;
  speed: number;
}

// ─── Tank Identity ──────────────────────────────────────────────────

export interface TankIdentityComponent {
  readonly tankId: TankId;
  readonly playerId: PlayerId;
  readonly team: TeamId;
  readonly hover: boolean;
  readonly hitboxRadius: number;
}

// ─── Health ─────────────────────────────────────────────────────────

export interface HealthComponent {
  hp: number;
  maxHp: number;
  isAlive: boolean;
}

// ─── Tank State Machine ─────────────────────────────────────────────

export interface TankStateComponent {
  current: TankState;
  enteredAt: Milliseconds;
  durationMs: Milliseconds;
}

// ─── Turret ─────────────────────────────────────────────────────────

export interface TurretComponent {
  aimAngle: Radians;
  rotationSpeed: number;
}

// ─── Attack Timing (replaces Ammo) ──────────────────────────────────
// No ammo/reload. Attacks are infinite, gated by attackSpeed.

export interface AttackTimingComponent {
  /** Attacks per second */
  attackSpeed: number;
  /** Minimum ms between shots: 1000 / attackSpeed */
  fireIntervalMs: number;
  /** Time since last shot in ms */
  lastFireElapsedMs: number;
}

// ─── Cooldowns (E and Space skills) ─────────────────────────────────

export interface CooldownComponent {
  skillE: {
    cooldownMs: number;
    remainingMs: number;
    isReady: boolean;
  };
  skillSpace: {
    cooldownMs: number;
    remainingMs: number;
    isReady: boolean;
  };
}

// ─── Active Status Effects ──────────────────────────────────────────

export interface ActiveStatusEffect {
  type: StatusEffectType;
  magnitude: number;
  remainingMs: number;
  sourceId: EntityId;
}

export interface StatusEffectsComponent {
  effects: ActiveStatusEffect[];
}

// ─── Projectile ─────────────────────────────────────────────────────

export interface ProjectileComponent {
  archetype: ProjectileArchetype;
  ownerId: EntityId;
  tankId?: string;
  damage: number;
  damageChannel: DamageChannel;
  maxRange: number;
  distanceTraveled: number;
  phase: ProjectilePhase;
  /** For bouncing projectiles */
  maxBounces?: number;
  bouncesLeft?: number;
  /** For boomerang-type: origin position to return to */
  originPosition?: Vector2;
  returnDamageMultiplier?: number;
}

// ─── Combat Stats (computed from base + tier + hardware) ────────────
// 7 base stats. Crit comes from passives, not here.

export interface CombatStatsComponent {
  atk: number;
  range: number;
  defP: number;
  defE: number;
  attackSpeed: number;
  speed: number;
}

// ─── Input Buffer ───────────────────────────────────────────────────

export interface InputComponent {
  moveDir: Vector2 | null;
  aimAngle: Radians;
  fire: boolean;
  skillE: boolean;
  skillSpace: boolean;
  seq: number;
}

// ─── Collision (Circle hitbox) ──────────────────────────────────────

export interface ColliderComponent {
  /** Circle hitbox radius in pixels */
  radius: number;
  isStatic: boolean;
}

// ─── Entity Archetype Tags ──────────────────────────────────────────

export type EntityTag = 'tank' | 'projectile' | 'pickup';

// ─── Full Entity (component bag) ────────────────────────────────────

export interface GameEntity {
  readonly id: EntityId;
  readonly tag: EntityTag;

  transform?: TransformComponent;
  velocity?: VelocityComponent;
  tankIdentity?: TankIdentityComponent;
  health?: HealthComponent;
  tankState?: TankStateComponent;
  turret?: TurretComponent;
  attackTiming?: AttackTimingComponent;
  cooldowns?: CooldownComponent;
  statusEffects?: StatusEffectsComponent;
  projectile?: ProjectileComponent;
  combatStats?: CombatStatsComponent;
  input?: InputComponent;
  collider?: ColliderComponent;
}
