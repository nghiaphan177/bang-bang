// ═══════════════════════════════════════════════════════════════════
// EvolutionSystem.ts — Manage exp tracking, passive exp, level ups
// ═══════════════════════════════════════════════════════════════════

import { EntityManager } from '../EntityManager';
import { type GameEntity } from '../components';
import { TANK_ROSTER } from '../../data/tank-roster';

const EXP_THRESHOLDS = [100, 250, 500, 900];
const STAT_SCALE = [1.0, 1.1, 1.25, 1.4, 1.6];
const HITBOX_SCALE = [1.0, 1.05, 1.10, 1.15, 1.20];

export class EvolutionSystem {
  update(entities: EntityManager, dt: number): void {
    const dtSec = dt / 1000;
    const tanks = entities.getTanks();

    for (const tank of tanks) {
      if (!tank.health?.isAlive || !tank.evolution || !tank.tankIdentity) {
        continue;
      }

      const evo = tank.evolution;

      // ─── 1. Tick Passive EXP ────────────────────────────────────────
      evo.currentExp += 2 * dtSec;

      // ─── 2. Handle Level-Up Logic ──────────────────────────────────
      let leveledUp = false;
      while (evo.level < 5 && evo.currentExp >= evo.expToNextLevel) {
        evo.level++;
        evo.expToNextLevel = EXP_THRESHOLDS[evo.level - 1] ?? Infinity;
        leveledUp = true;
      }

      if (leveledUp) {
        const tankId = tank.tankIdentity.tankId;
        const tankDef = TANK_ROSTER[tankId];

        if (tankDef) {
          const baseDef = tankDef.attributes;
          const scale = STAT_SCALE[evo.level - 1] ?? 1.0;

          // Scale HP and fully heal
          if (tank.health) {
            tank.health.maxHp = Math.floor(baseDef.hp * scale);
            tank.health.hp = tank.health.maxHp;
          }

          // Scale combat stats
          if (tank.combatStats) {
            tank.combatStats.atk = Math.floor(baseDef.atk * scale);
            tank.combatStats.range = Math.floor(baseDef.range * scale);
            tank.combatStats.defP = Math.floor(baseDef.defP * scale);
            tank.combatStats.defE = Math.floor(baseDef.defE * scale);
            tank.combatStats.attackSpeed = baseDef.attackSpeed * scale;
            tank.combatStats.speed = baseDef.speed * scale;
          }

          // Recalculate fire interval
          if (tank.attackTiming && tank.combatStats) {
            tank.attackTiming.attackSpeed = tank.combatStats.attackSpeed;
            tank.attackTiming.fireIntervalMs = 1000 / tank.combatStats.attackSpeed;
          }

          // Scale collider radius
          if (tank.collider) {
            tank.collider.radius = (tankDef.hitboxRadius / 32) * (HITBOX_SCALE[evo.level - 1] ?? 1.0);
          }

          console.log(`[Evolution] Player ${tank.tankIdentity.playerId} leveled up to Level ${evo.level}! Stats scaled.`);
        }
      }
    }
  }
}
