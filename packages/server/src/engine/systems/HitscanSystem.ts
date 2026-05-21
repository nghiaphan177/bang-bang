// ═══════════════════════════════════════════════════════════════════
// HitscanSystem.ts — Manage skill cast times and hitscan execution
// ═══════════════════════════════════════════════════════════════════

import { TankState, StatusEffectType, DamageChannel, type Vector2 } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { GameState } from '../GameState';
import { type GameEntity } from '../components';
import { CombatSystem } from './CombatSystem';
import { StatusEffectSystem } from './StatusEffectSystem';

export class HitscanSystem {
  update(
    entities: EntityManager,
    state: GameState,
    combatSystem: CombatSystem,
    dt: number
  ): void {
    const tanks = entities.getTanks();

    for (const tank of tanks) {
      if (!tank.health?.isAlive || !tank.castState) continue;

      const cs = tank.castState;
      cs.remainingMs -= dt;

      // Force velocity to 0 if rootSelf is active
      if (cs.rootSelf && tank.velocity) {
        tank.velocity.velocity = { x: 0, y: 0 };
        tank.velocity.speed = 0;
      }

      if (cs.remainingMs <= 0) {
        // Cast finishes: execute the hitscan skill!
        this.executeHitscanSkill(tank, cs.skillDef, entities, combatSystem);

        // Reset state
        delete tank.castState;
        if (tank.tankState) {
          tank.tankState.current = TankState.Idle;
          tank.tankState.enteredAt = Date.now() as any;
        }
      }
    }
  }

  public executeHitscanSkill(
    caster: GameEntity,
    skillDef: any,
    entities: EntityManager,
    combatSystem: CombatSystem
  ): void {
    const casterPos = caster.transform!.position;
    const aimAngle = caster.turret!.aimAngle;
    const rangeGrids = (skillDef.range ?? 999) / 32;

    const baseAtk = caster.combatStats?.atk ?? 0;
    const baseDamage = skillDef.damageFormula.baseDamage;
    const atkScaling = skillDef.damageFormula.atkScaling;
    const rawDamage = baseDamage + baseAtk * atkScaling;
    const channel = skillDef.damageFormula.channel as DamageChannel;

    // ─── Case A: IronMan Unibeam (Raycast Line) ──────────────────────
    if (skillDef.ignoresWalls) {
      const cos = Math.cos(aimAngle);
      const sin = Math.sin(aimAngle);

      for (const target of entities.getTanks()) {
        if (!target.health?.isAlive || target.id === caster.id) continue;
        if (target.tankIdentity?.team === caster.tankIdentity?.team) continue; // Skip allies

        const targetPos = target.transform!.position;
        const vx = targetPos.x - casterPos.x;
        const vy = targetPos.y - casterPos.y;

        // Project target position onto ray vector
        const proj = vx * cos + vy * sin;

        // Must be in front of the ray and within range
        if (proj < 0 || proj > rangeGrids) continue;

        // Calculate perpendicular distance to the ray
        const closestX = casterPos.x + proj * cos;
        const closestY = casterPos.y + proj * sin;
        const dx = targetPos.x - closestX;
        const dy = targetPos.y - closestY;
        const perpDist = Math.sqrt(dx * dx + dy * dy);

        // Hit if perpendicular distance is within target radius + beam width tolerance (e.g. 0.25 grids)
        const hitRadius = (target.collider?.radius ?? 0.5) + 0.25;
        if (perpDist <= hitRadius) {
          // Apply damage
          const finalDamage = combatSystem.calculateDamage(rawDamage, channel, target.combatStats!);
          target.health.hp = Math.max(0, target.health.hp - finalDamage);

          // Apply skill status effects (e.g. BURN)
          if (skillDef.effects) {
            for (const effect of skillDef.effects) {
              StatusEffectSystem.applyEffect(
                target,
                effect.effectType as StatusEffectType,
                effect.durationSec * 1000,
                effect.magnitude ?? 0,
                caster.id
              );
            }
          }
        }
      }
    } else {
      // ─── Case B: ThanhGiong Bamboo Sweep (Point-Blank AoE) ────────────
      // Sweep hits in an area around self
      const radiusGrids = skillDef.range / 32;

      for (const target of entities.getTanks()) {
        if (!target.health?.isAlive || target.id === caster.id) continue;
        if (target.tankIdentity?.team === caster.tankIdentity?.team) continue; // Skip allies

        const targetPos = target.transform!.position;
        const dx = targetPos.x - casterPos.x;
        const dy = targetPos.y - casterPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radiusGrids) {
          // Apply damage
          const finalDamage = combatSystem.calculateDamage(rawDamage, channel, target.combatStats!);
          target.health.hp = Math.max(0, target.health.hp - finalDamage);

          // Apply skill status effects (e.g. SLOW)
          if (skillDef.effects) {
            for (const effect of skillDef.effects) {
              StatusEffectSystem.applyEffect(
                target,
                effect.effectType as StatusEffectType,
                effect.durationSec * 1000,
                effect.magnitude ?? 0,
                caster.id
              );
            }
          }
        }
      }
    }
  }
}
