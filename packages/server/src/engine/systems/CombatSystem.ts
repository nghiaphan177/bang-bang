// ═══════════════════════════════════════════════════════════════════
// CombatSystem.ts — Damage formulas, HP reduction, death checks
// Damage: Raw = baseDmg + atk * atkScaling
// Physical: Mitigation = 100/(100+defP)
// Energy:   Mitigation = 100/(100+defE)
// True:     Mitigation = 1.0 (bypasses defense)
// Final = floor(Raw * Mitigation). Min 1 if Raw > 0.
// ═══════════════════════════════════════════════════════════════════

import { TankState } from '@bang-bang/shared';
import { StatusEffectType } from '@bang-bang/shared';
import { DamageChannel } from '@bang-bang/shared';
import { type Milliseconds } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { GameState } from '../GameState';
import { type GameEntity, type CombatStatsComponent } from '../components';
import { ProjectileSystem } from './ProjectileSystem';
import { StatusEffectSystem } from './StatusEffectSystem';

export class CombatSystem {
  public projectileSystem: ProjectileSystem | null = null;

  update(entities: EntityManager, state: GameState, dt: number): void {
    this.processAttackTiming(entities, dt);
    this.processCooldowns(entities, dt);
    this.processPendingHits(entities);
    this.checkDeaths(entities, state);
  }

  /**
   * Update attack timing (no ammo — attackSpeed-gated).
   */
  private processAttackTiming(entities: EntityManager, dt: number): void {
    for (const tank of entities.getTanks()) {
      if (!tank.attackTiming || !tank.health?.isAlive) continue;
      tank.attackTiming.lastFireElapsedMs += dt;
    }
  }

  /**
   * Tick down skill cooldowns.
   */
  private processCooldowns(entities: EntityManager, dt: number): void {
    for (const tank of entities.getTanks()) {
      if (!tank.cooldowns || !tank.health?.isAlive) continue;
      const cd = tank.cooldowns;

      if (cd.skillE.remainingMs > 0) {
        cd.skillE.remainingMs = Math.max(0, cd.skillE.remainingMs - dt);
        cd.skillE.isReady = cd.skillE.remainingMs <= 0;
      }
      if (cd.skillSpace.remainingMs > 0) {
        cd.skillSpace.remainingMs = Math.max(0, cd.skillSpace.remainingMs - dt);
        cd.skillSpace.isReady = cd.skillSpace.remainingMs <= 0;
      }
    }
  }

  /**
   * Process projectile hits from ProjectileSystem.
   */
  private processPendingHits(entities: EntityManager): void {
    if (!this.projectileSystem) return;

    for (const hit of this.projectileSystem.pendingHits) {
      const target = entities.get(hit.targetId as any);
      if (!target || !target.health?.isAlive || !target.combatStats) continue;

      // Check Invulnerable status effect
      const isInvuln = target.statusEffects?.effects.some(
        e => e.type === StatusEffectType.Invulnerable
      ) ?? false;
      if (isInvuln) continue;

      // Check spawn protection (3s invulnerability on respawn)
      if (target.spawnProtectionMs != null && target.spawnProtectionMs > 0) continue;

      const actualDamage = this.calculateDamage(
        hit.damage,
        hit.damageChannel,
        target.combatStats,
      );

      target.health.hp = Math.max(0, target.health.hp - actualDamage);

      const projEntity = entities.get(hit.projectileId as any);
      if (projEntity?.projectile?.ownerId && actualDamage > 0) {
        if (!target.recentDamage) target.recentDamage = [];
        target.recentDamage.push({ attackerId: projEntity.projectile.ownerId, timestamp: Date.now() });
      }

      // Apply status effects from projectile if any
      if (projEntity?.projectile?.effects) {
        for (const effect of projEntity.projectile.effects) {
          StatusEffectSystem.applyEffect(
            target,
            effect.effectType as StatusEffectType,
            effect.durationSec * 1000,
            effect.magnitude ?? 0,
            projEntity.projectile.ownerId
          );
        }
      }
    }
  }

  /**
   * New damage formula:
   *   Physical → Mitigation = 100 / (100 + target.defP)
   *   Energy   → Mitigation = 100 / (100 + target.defE)
   *   True     → No mitigation
   *   Final = floor(Raw * Mitigation). Min 1.
   */
  calculateDamage(
    rawDamage: number,
    channel: DamageChannel,
    targetStats: CombatStatsComponent,
  ): number {
    if (rawDamage <= 0) return 0;

    let mitigation: number;

    switch (channel) {
      case DamageChannel.Physical:
        mitigation = 100 / (100 + targetStats.defP);
        break;
      case DamageChannel.Energy:
        mitigation = 100 / (100 + targetStats.defE);
        break;
      case DamageChannel.True:
        mitigation = 1.0;
        break;
      default:
        mitigation = 1.0;
    }

    return Math.max(1, Math.floor(rawDamage * mitigation));
  }

  /**
   * Check for dead tanks.
   */
  private checkDeaths(entities: EntityManager, state: GameState): void {
    for (const tank of entities.getTanks()) {
      if (!tank.health || !tank.tankState) continue;
      if (!tank.health.isAlive) continue;

      if (tank.health.hp <= 0) {
        tank.health.isAlive = false;
        tank.health.hp = 0;
        tank.tankState.current = TankState.Dead;
        tank.tankState.enteredAt = Date.now() as Milliseconds;
        tank.tankState.durationMs = 0 as Milliseconds;

        if (tank.velocity) {
          tank.velocity.velocity = { x: 0, y: 0 };
          tank.velocity.speed = 0;
        }
      }
    }
  }
}
