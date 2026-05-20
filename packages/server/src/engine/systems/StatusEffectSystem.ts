// ═══════════════════════════════════════════════════════════════════
// StatusEffectSystem.ts — Apply, tick, and expire status effects
// 6 types: STUN, ROOT, SILENCE, SLOW, BURN, INVULNERABLE
// STUN → forces TankState.Stunned
// ROOT/SILENCE → handled as effects (don't change TankState)
// SLOW → only highest % applies
// BURN → DoT True Damage
// INVULNERABLE → blocks all incoming damage
// ═══════════════════════════════════════════════════════════════════

import { TankState, type Milliseconds } from '@bang-bang/shared';
import { StatusEffectType } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { type GameEntity, type ActiveStatusEffect } from '../components';

/** Only Stun forces a TankState change */
const EFFECT_TO_STATE: Partial<Record<StatusEffectType, TankState>> = {
  [StatusEffectType.Stun]: TankState.Stunned,
};

const DOT_EFFECTS = new Set<StatusEffectType>([
  StatusEffectType.Burn,
]);

export class StatusEffectSystem {
  update(entities: EntityManager, dt: number): void {
    for (const tank of entities.getTanks()) {
      if (!tank.statusEffects || !tank.health?.isAlive) continue;

      const effects = tank.statusEffects.effects;
      const toRemove: number[] = [];

      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i]!;

        effect.remainingMs -= dt;

        // Apply DoT
        if (DOT_EFFECTS.has(effect.type) && tank.health) {
          this.applyDotDamage(tank, effect, dt);
        }

        // Check expiry
        if (effect.remainingMs <= 0) {
          toRemove.push(i);

          // Release state lock if Stun was controlling
          const forcedState = EFFECT_TO_STATE[effect.type];
          if (forcedState && tank.tankState?.current === forcedState) {
            tank.tankState.current = TankState.Idle;
            tank.tankState.enteredAt = Date.now() as Milliseconds;
          }
        }
      }

      // Remove expired (reverse order)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        effects.splice(toRemove[i]!, 1);
      }
    }
  }

  /**
   * Burn DoT: magnitude = damage fraction of maxHP per second
   */
  private applyDotDamage(
    tank: GameEntity,
    effect: ActiveStatusEffect,
    dt: number,
  ): void {
    if (!tank.health) return;

    // Check if target has Invulnerable — skip damage
    const isInvuln = tank.statusEffects?.effects.some(
      e => e.type === StatusEffectType.Invulnerable
    ) ?? false;
    if (isInvuln) return;

    const dtSec = dt / 1000;
    const damageThisTick = tank.health.maxHp * effect.magnitude * dtSec;
    tank.health.hp = Math.max(0, tank.health.hp - damageThisTick);
  }

  /**
   * Apply a new status effect to a tank entity.
   */
  static applyEffect(
    tank: GameEntity,
    type: StatusEffectType,
    durationMs: number,
    magnitude: number,
    sourceId: string,
  ): void {
    if (!tank.statusEffects) return;

    // Invulnerable blocks new debuffs
    const isInvuln = tank.statusEffects.effects.some(
      e => e.type === StatusEffectType.Invulnerable
    );
    const isDebuff = type === StatusEffectType.Stun ||
                     type === StatusEffectType.Root ||
                     type === StatusEffectType.Silence ||
                     type === StatusEffectType.Slow ||
                     type === StatusEffectType.Burn;
    if (isInvuln && isDebuff) return;

    // For Slow: only keep highest magnitude
    if (type === StatusEffectType.Slow) {
      const existingSlow = tank.statusEffects.effects.find(
        e => e.type === StatusEffectType.Slow
      );
      if (existingSlow && existingSlow.magnitude >= magnitude) return;
      // Remove old slow to replace with stronger
      if (existingSlow) {
        const idx = tank.statusEffects.effects.indexOf(existingSlow);
        if (idx >= 0) tank.statusEffects.effects.splice(idx, 1);
      }
    }

    tank.statusEffects.effects.push({
      type,
      magnitude,
      remainingMs: durationMs,
      sourceId: sourceId as any,
    });

    // Force state for Stun only
    const forcedState = EFFECT_TO_STATE[type];
    if (forcedState && tank.tankState) {
      tank.tankState.current = forcedState;
      tank.tankState.enteredAt = Date.now() as Milliseconds;
      tank.tankState.durationMs = durationMs as Milliseconds;

      if (tank.velocity) {
        tank.velocity.velocity = { x: 0, y: 0 };
        tank.velocity.speed = 0;
      }
    }
  }
}
