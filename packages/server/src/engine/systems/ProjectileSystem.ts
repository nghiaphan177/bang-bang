// ═══════════════════════════════════════════════════════════════════
// ProjectileSystem.ts — Spawn, move, range check, wall/hit detection
// Uses ProjectileArchetype for behavior: LINEAR, PIERCING, BOUNCING, etc.
// ═══════════════════════════════════════════════════════════════════

import { TileType, ProjectilePhase, ProjectileArchetype } from '@bang-bang/shared';
import { type DamageChannel } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { GameState } from '../GameState';
import { type GameEntity } from '../components';

export class ProjectileSystem {
  /** Pending hits for CombatSystem */
  public readonly pendingHits: Array<{
    projectileId: string;
    targetId: string;
    damage: number;
    damageChannel: DamageChannel;
  }> = [];

  update(entities: EntityManager, state: GameState, dt: number): void {
    const dtSec = dt / 1000;
    this.pendingHits.length = 0;

    const projectiles = entities.getProjectiles();
    const tanks = entities.getTanks();

    for (const proj of projectiles) {
      if (!proj.transform || !proj.velocity || !proj.projectile) continue;

      const pc = proj.projectile;

      // Skip resolved
      if (pc.phase === ProjectilePhase.Expired || pc.phase === ProjectilePhase.Hit) {
        entities.destroy(proj.id);
        continue;
      }

      // ─── Move Projectile ────────────────────────────────────
      const vx = proj.velocity.velocity.x;
      const vy = proj.velocity.velocity.y;
      const moveX = vx * dtSec;
      const moveY = vy * dtSec;
      const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);

      proj.transform.position = {
        x: proj.transform.position.x + moveX,
        y: proj.transform.position.y + moveY,
      };
      pc.distanceTraveled += moveDist;

      // ─── Range Check ────────────────────────────────────────
      if (pc.distanceTraveled >= pc.maxRange) {
        if (pc.originPosition && pc.phase === ProjectilePhase.Active) {
          // Boomerang return
          pc.phase = ProjectilePhase.Returning;
          const dx = pc.originPosition.x - proj.transform.position.x;
          const dy = pc.originPosition.y - proj.transform.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const speed = Math.sqrt(vx * vx + vy * vy);
            proj.velocity.velocity = {
              x: (dx / dist) * speed,
              y: (dy / dist) * speed,
            };
          }
        } else {
          pc.phase = ProjectilePhase.Expired;
          continue;
        }
      }

      // ─── Boomerang Return ───────────────────────────────────
      if (pc.phase === ProjectilePhase.Returning && pc.originPosition) {
        const dx = pc.originPosition.x - proj.transform.position.x;
        const dy = pc.originPosition.y - proj.transform.position.y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
          pc.phase = ProjectilePhase.Expired;
          continue;
        }
      }

      // ─── Wall Collision ─────────────────────────────────────
      // PIERCING ignores walls. BOUNCING reflects. Others stop.
      const isPiercing = pc.archetype === ProjectileArchetype.Piercing;
      const isBouncing = pc.archetype === ProjectileArchetype.Bouncing;

      if (!isPiercing) {
        const col = Math.floor(proj.transform.position.x);
        const row = Math.floor(proj.transform.position.y);
        const tile = state.getTile(col, row);

        if (tile) {
          const isBlocking =
            tile.type === TileType.SteelWall ||
            tile.type === TileType.SteelBox ||
            (tile.type === TileType.BrickWall && !tile.destroyed) ||
            (tile.type === TileType.WoodBox && !tile.destroyed);

          if (isBlocking) {
            if (isBouncing && pc.bouncesLeft !== undefined && pc.bouncesLeft > 0) {
              // Bounce: reflect velocity
              pc.bouncesLeft--;
              // Simple reflection (negate velocity component based on entry axis)
              const prevX = proj.transform.position.x - moveX;
              const prevY = proj.transform.position.y - moveY;
              const prevCol = Math.floor(prevX);
              const prevRow = Math.floor(prevY);

              if (prevCol !== col) {
                proj.velocity.velocity = { x: -vx, y: vy };
              } else {
                proj.velocity.velocity = { x: vx, y: -vy };
              }
              // Push back out
              proj.transform.position = { x: prevX, y: prevY };
            } else {
              // Damage destructible walls/boxes
              if (tile.type === TileType.BrickWall && !tile.destroyed) {
                tile.hp -= pc.damage;
                if (tile.hp <= 0) {
                  tile.destroyed = true;
                  tile.hp = 0;
                  state.setTile(col, row, { type: TileType.Ground });
                }
              }
              if (tile.type === TileType.WoodBox && !tile.destroyed) {
                tile.hp -= pc.damage;
                if (tile.hp <= 0) {
                  tile.destroyed = true;
                  tile.hp = 0;
                  state.setTile(col, row, { type: TileType.Ground });
                }
              }
              pc.phase = ProjectilePhase.Hit;
              continue;
            }
          }
        }
      }

      // ─── Tank Hit Detection (circle) ────────────────────────
      for (const tank of tanks) {
        if (!tank.transform || !tank.health?.isAlive || !tank.collider) continue;
        if (tank.id === pc.ownerId) continue;

        const dx = proj.transform.position.x - tank.transform.position.x;
        const dy = proj.transform.position.y - tank.transform.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = tank.collider.radius;

        if (dist < hitRadius + 0.15) {
          const dmgMultiplier = pc.phase === ProjectilePhase.Returning
            ? (pc.returnDamageMultiplier ?? 0.5)
            : 1.0;

          this.pendingHits.push({
            projectileId: proj.id as string,
            targetId: tank.id as string,
            damage: pc.damage * dmgMultiplier,
            damageChannel: pc.damageChannel,
          });

          // PIERCING passes through; others stop on hit
          if (!isPiercing) {
            pc.phase = ProjectilePhase.Hit;
            break;
          }
        }
      }
    }
  }
}
