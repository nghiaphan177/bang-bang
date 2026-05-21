// ═══════════════════════════════════════════════════════════════════
// CollisionSystem.ts — Circle-based collision resolution
// GDD §1.1: Brick/Steel block tanks+projectiles, Water blocks
//           non-hover tanks, Bush grants stealth
// ═══════════════════════════════════════════════════════════════════

import { GRID_SIZE_PX, TileType } from '@bang-bang/shared';
import { BushVisibilityState } from '@bang-bang/shared';
import { TankState } from '@bang-bang/shared';
import { EntityManager } from '../EntityManager';
import { GameState } from '../GameState';
import { type GameEntity, type TransformComponent, type ColliderComponent } from '../components';

const GRID_PX = GRID_SIZE_PX as number;

function worldToGrid(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x),
    row: Math.floor(y),
  };
}

export class CollisionSystem {
  update(entities: EntityManager, state: GameState, dt: number): void {
    const tanks = entities.getTanks();

    for (const tank of tanks) {
      if (!tank.transform || !tank.health?.isAlive) continue;
      this.resolveTankMapCollision(tank, state);
      this.updateBushStealth(tank, state);
    }
  }

  /**
   * Circle-based collision: prevent tanks from overlapping blocking tiles.
   */
  public resolveTankMapCollision(tank: GameEntity, state: GameState): void {
    const { transform, tankIdentity, collider } = tank;
    if (!transform || !collider) return;

    const pos = transform.position;
    const r = collider.radius;

    // Check all grid cells the tank's bounding box overlaps
    const minCol = Math.floor(pos.x - r);
    const maxCol = Math.floor(pos.x + r);
    const minRow = Math.floor(pos.y - r);
    const maxRow = Math.floor(pos.y + r);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = state.getTile(col, row);
        if (!tile) {
          this.pushCircleOutOfTile(transform, r, col, row);
          continue;
        }

        switch (tile.type) {
          case TileType.BrickWall:
            if (!tile.destroyed) {
              this.pushCircleOutOfTile(transform, r, col, row);
            }
            break;

          case TileType.SteelWall:
          case TileType.SteelBox:
            this.pushCircleOutOfTile(transform, r, col, row);
            break;

          case TileType.WoodBox:
            if (!tile.destroyed) {
              this.pushCircleOutOfTile(transform, r, col, row);
            }
            break;

          case TileType.Water:
          case TileType.Lava:
            if (!tankIdentity?.hover) {
              this.pushCircleOutOfTile(transform, r, col, row);
            }
            break;

          default:
            break;
        }
      }
    }
  }

  /**
   * Push circle out of an axis-aligned tile (1x1 grid cell).
   * Uses closest-point-on-AABB to circle-center distance.
   */
  private pushCircleOutOfTile(
    transform: TransformComponent,
    radius: number,
    tileCol: number,
    tileRow: number,
  ): void {
    const pos = transform.position;

    // Tile occupies [col, col+1) x [row, row+1) in grid space
    const clampedX = Math.max(tileCol, Math.min(pos.x, tileCol + 1));
    const clampedY = Math.max(tileRow, Math.min(pos.y, tileRow + 1));

    const dx = pos.x - clampedX;
    const dy = pos.y - clampedY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= radius * radius || distSq === 0) return;

    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    transform.position = {
      x: pos.x + nx * overlap,
      y: pos.y + ny * overlap,
    };
  }

  /**
   * Bush stealth: tank center inside bush + casting → visible for 2.5s
   */
  private updateBushStealth(tank: GameEntity, state: GameState): void {
    if (!tank.transform) return;
    const { col, row } = worldToGrid(
      tank.transform.position.x,
      tank.transform.position.y,
    );
    const tile = state.getTile(col, row);

    if (tile && tile.type === TileType.Bush) {
      if (tank.tankState?.current === TankState.Casting) {
        tile.visibility = BushVisibilityState.Visible;
        tile.visibleUntilMs = (Date.now() + 2500) as any;
      }
    }
  }
}
