// ═══════════════════════════════════════════════════════════════════
// MovementSystem.ts — 8-dir hull movement + turret aim tracking
// GDD §1: WASD 8 directions, turret follows mouse cursor
// ═══════════════════════════════════════════════════════════════════

import { TankState, StatusEffectType } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { type GameEntity } from '../components';

/** States that prevent movement */
const MOVEMENT_BLOCKED_STATES = new Set<TankState>([
  TankState.Stunned,
  TankState.Dead,
  TankState.Dashing,
]);

/** States that prevent turret aiming */
const AIM_BLOCKED_STATES = new Set<TankState>([
  TankState.Stunned,
  TankState.Dead,
  TankState.Dashing,
]);

export class MovementSystem {
  update(entities: EntityManager, dt: number): void {
    const dtSec = dt / 1000;
    const tanks = entities.getTanks();

    for (const tank of tanks) {
      if (!tank.transform || !tank.input || !tank.combatStats || !tank.tankState) {
        continue;
      }
      if (!tank.health?.isAlive) continue;

      this.updateMovement(tank, dtSec);
      this.updateTurretAim(tank);
    }
  }

  private updateMovement(tank: GameEntity, dtSec: number): void {
    const { transform, input, combatStats, tankState, velocity } = tank;
    if (!transform || !input || !combatStats || !tankState || !velocity) return;

    // Check if movement is blocked by state
    if (MOVEMENT_BLOCKED_STATES.has(tankState.current)) {
      velocity.velocity = { x: 0, y: 0 };
      velocity.speed = 0;
      return;
    }

    // Check if casting roots the tank
    if (tankState.current === TankState.Casting && tank.castState?.rootSelf) {
      velocity.velocity = { x: 0, y: 0 };
      velocity.speed = 0;
      return;
    }

    // Check if Root status effect blocks movement
    const isRooted = tank.statusEffects?.effects.some(
      e => e.type === StatusEffectType.Root
    ) ?? false;

    if (isRooted) {
      velocity.velocity = { x: 0, y: 0 };
      velocity.speed = 0;
      return;
    }

    if (!input.moveDir) {
      velocity.velocity = { x: 0, y: 0 };
      velocity.speed = 0;

      if (tankState.current === TankState.Moving) {
        tankState.current = TankState.Idle;
        tankState.enteredAt = Date.now() as any;
      }
      return;
    }

    // Calculate effective speed
    let effectiveSpeed = combatStats.speed;

    // Apply slow effects (only highest slow applies per GDD)
    if (tank.statusEffects) {
      let maxSlow = 0;
      for (const effect of tank.statusEffects.effects) {
        if (effect.type === StatusEffectType.Slow) {
          maxSlow = Math.max(maxSlow, effect.magnitude);
        }
      }
      effectiveSpeed *= (1 - maxSlow);
    }

    // Normalize direction and apply speed
    const dir = input.moveDir;
    const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    if (mag === 0) return;

    const nx = dir.x / mag;
    const ny = dir.y / mag;

    velocity.velocity = {
      x: nx * effectiveSpeed,
      y: ny * effectiveSpeed,
    };
    velocity.speed = effectiveSpeed;

    // Apply position
    transform.position = {
      x: transform.position.x + velocity.velocity.x * dtSec,
      y: transform.position.y + velocity.velocity.y * dtSec,
    };

    // Update hull rotation
    transform.rotation = Math.atan2(ny, nx) as any;

    // Update state
    if (tankState.current === TankState.Idle) {
      tankState.current = TankState.Moving;
      tankState.enteredAt = Date.now() as any;
    }
  }

  private updateTurretAim(tank: GameEntity): void {
    const { turret, input, tankState } = tank;
    if (!turret || !input || !tankState) return;
    if (AIM_BLOCKED_STATES.has(tankState.current)) return;
    turret.aimAngle = input.aimAngle;
  }
}
