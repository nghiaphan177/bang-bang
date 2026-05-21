// ═══════════════════════════════════════════════════════════════════
// DashSystem.ts — Manage active dashes and clone decoys
// ═══════════════════════════════════════════════════════════════════

import { TankState, StatusEffectType, DamageChannel, type Vector2 } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { GameState } from '../GameState';
import { type GameEntity } from '../components';
import { CollisionSystem } from './CollisionSystem';
import { CombatSystem } from './CombatSystem';
import { StatusEffectSystem } from './StatusEffectSystem';

export class DashSystem {
  update(
    entities: EntityManager,
    state: GameState,
    collisionSystem: CollisionSystem,
    combatSystem: CombatSystem,
    dt: number
  ): void {
    const dtSec = dt / 1000;
    const tanks = entities.getTanks();

    for (const tank of tanks) {
      if (!tank.health?.isAlive) {
        if (tank.tankIdentity?.playerId.startsWith('clone_')) {
          entities.destroy(tank.id);
        }
        continue;
      }

      // ─── 1. Update Dashing Tanks ────────────────────────────────────
      if (tank.dashState) {
        const ds = tank.dashState;
        ds.remainingMs -= dt;

        if (ds.remainingMs <= 0) {
          // Dash complete
          delete tank.dashState;
          if (tank.tankState) {
            tank.tankState.current = TankState.Idle;
            tank.tankState.enteredAt = Date.now() as any;
          }
          if (tank.velocity) {
            tank.velocity.velocity = { x: 0, y: 0 };
            tank.velocity.speed = 0;
          }
          continue;
        }

        // Move the dashing tank
        const desiredX = tank.transform!.position.x + ds.direction.x * ds.speed * dtSec;
        const desiredY = tank.transform!.position.y + ds.direction.y * ds.speed * dtSec;
        tank.transform!.position = { x: desiredX, y: desiredY };

        // Resolve map collision
        collisionSystem.resolveTankMapCollision(tank, state);

        // If we hit a wall/obstacle and were pushed back
        const dx = tank.transform!.position.x - desiredX;
        const dy = tank.transform!.position.y - desiredY;
        if (dx * dx + dy * dy > 0.0001) {
          // Wall hit: terminate dash
          delete tank.dashState;
          if (tank.tankState) {
            tank.tankState.current = TankState.Idle;
            tank.tankState.enteredAt = Date.now() as any;
          }
          if (tank.velocity) {
            tank.velocity.velocity = { x: 0, y: 0 };
            tank.velocity.speed = 0;
          }
          continue;
        }

        // Check contact collision with enemy tanks
        for (const other of tanks) {
          if (!other.health?.isAlive || other.id === tank.id) continue;
          if (other.tankIdentity?.team === tank.tankIdentity?.team) continue; // Skip allies

          const ox = other.transform!.position.x;
          const oy = other.transform!.position.y;
          const tx = tank.transform!.position.x;
          const ty = tank.transform!.position.y;

          const dist = Math.sqrt((ox - tx) * (ox - tx) + (oy - ty) * (oy - ty));
          const hitRadius = (tank.collider?.radius ?? 0.5) + (other.collider?.radius ?? 0.5);

          if (dist <= hitRadius) {
            if (!ds.hitEntities.has(other.id as string)) {
              ds.hitEntities.add(other.id as string);

              // Apply damage on hit
              if (ds.damagePayload && ds.damagePayload > 0) {
                const finalDamage = combatSystem.calculateDamage(
                  ds.damagePayload,
                  ds.damageChannel ?? DamageChannel.Physical,
                  other.combatStats!
                );
                other.health.hp = Math.max(0, other.health.hp - finalDamage);
                if (finalDamage > 0) {
                  if (!other.recentDamage) other.recentDamage = [];
                  other.recentDamage.push({ attackerId: tank.id, timestamp: Date.now() });
                }
              }

              // Apply status effects on hit (e.g. STUN)
              if (ds.onHitEffects) {
                for (const effect of ds.onHitEffects) {
                  StatusEffectSystem.applyEffect(
                    other,
                    effect.effectType as StatusEffectType,
                    effect.durationSec * 1000,
                    effect.magnitude ?? 0,
                    tank.id
                  );
                }
              }

              // End dash immediately on contact
              delete tank.dashState;
              if (tank.tankState) {
                tank.tankState.current = TankState.Idle;
                tank.tankState.enteredAt = Date.now() as any;
              }
              if (tank.velocity) {
                tank.velocity.velocity = { x: 0, y: 0 };
                tank.velocity.speed = 0;
              }
              break;
            }
          }
        }
      }

      // ─── 2. Update Clone Decoys ─────────────────────────────────────
      if (tank.tankIdentity?.playerId.startsWith('clone_')) {
        if (tank.tankState) {
          tank.tankState.durationMs = (tank.tankState.durationMs - dt) as any;
          if (tank.tankState.durationMs <= 0) {
            // Destroy the clone entity!
            entities.destroy(tank.id);
            continue;
          }

          // Move slowly in its facing direction (hull rotation)
          const speed = 3.0; // grid units per second
          const angle = tank.transform!.rotation;
          const moveX = Math.cos(angle) * speed * dtSec;
          const moveY = Math.sin(angle) * speed * dtSec;
          tank.transform!.position = {
            x: tank.transform!.position.x + moveX,
            y: tank.transform!.position.y + moveY,
          };

          // Resolve map collision
          collisionSystem.resolveTankMapCollision(tank, state);
        }
      }
    }
  }
}
