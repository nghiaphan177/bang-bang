// ═══════════════════════════════════════════════════════════════════
// GameState.ts — Authoritative world state + snapshot serialization
// ═══════════════════════════════════════════════════════════════════

import {
  type EntityId,
  type PlayerId,
  type Milliseconds,
  type Radians,
  type Vector2,
} from '@bang-bang/shared';
import {
  type GameSnapshot,
  type TankSnapshot,
  type MapDeltaEntry,
  type MatchState,
} from '@bang-bang/shared';
import { type TileDefinition, TileType, type GameMap } from '@bang-bang/shared';
import { type StatusEffect } from '@bang-bang/shared';
import { type ProjectileState } from '@bang-bang/shared';
import { type TeamId } from '@bang-bang/shared';
import { EntityManager } from './EntityManager';
import { type GameEntity } from './components';

export class GameState {
  public tick: number = 0;
  public readonly entityManager: EntityManager = new EntityManager();
  public map: GameMap;

  private tileDelta: MapDeltaEntry[] = [];

  constructor(map: GameMap) {
    this.map = map;
  }

  setTile(col: number, row: number, tile: TileDefinition): void {
    (this.map.tiles[row] as TileDefinition[])[col] = tile;
    this.tileDelta.push({ col, row, tile });
  }

  getTile(col: number, row: number): TileDefinition | undefined {
    if (
      row < 0 || row >= (this.map.heightGrids as number) ||
      col < 0 || col >= (this.map.widthGrids as number)
    ) {
      return undefined;
    }
    return this.map.tiles[row]?.[col];
  }

  createSnapshot(lastProcessedInputs: Map<PlayerId, number>, matchState: MatchState): GameSnapshot {
    const tanks: TankSnapshot[] = [];
    for (const entity of this.entityManager.getTanks()) {
      if (!entity.transform || !entity.tankIdentity || !entity.health || !entity.turret) {
        continue;
      }
      const effects: StatusEffect[] = (entity.statusEffects?.effects ?? []).map((e, i) => ({
        id: `${entity.id}_eff_${i}`,
        type: e.type,
        ...(e.magnitude ? { value: e.magnitude } : {}),
        durationLeft: e.remainingMs,
      }));

      tanks.push({
        entityId: entity.id,
        playerId: entity.tankIdentity.playerId,
        tankId: entity.tankIdentity.tankId,
        position: entity.transform.position,
        hullRotation: entity.transform.rotation,
        turretRotation: entity.turret.aimAngle,
        hp: entity.health.hp,
        maxHp: entity.health.maxHp,
        activeEffects: effects,
        isAlive: entity.health.isAlive,
        team: entity.tankIdentity.team,
      });
    }

    const projectiles: ProjectileState[] = [];
    for (const entity of this.entityManager.getProjectiles()) {
      if (!entity.transform || !entity.projectile || !entity.velocity) {
        continue;
      }
      const projState: ProjectileState = {
        id: entity.id as string,
        ownerId: entity.projectile.ownerId as string,
        archetype: entity.projectile.archetype,
        damagePayload: entity.projectile.damage,
        channel: entity.projectile.damageChannel,
        position: entity.transform.position,
        velocity: entity.velocity.velocity,
        distanceTraveled: entity.projectile.distanceTraveled,
        maxRange: entity.projectile.maxRange,
        ...(entity.projectile.maxBounces != null ? { maxBounces: entity.projectile.maxBounces } : {}),
        ...(entity.projectile.bouncesLeft != null ? { bouncesLeft: entity.projectile.bouncesLeft } : {}),
      };
      projectiles.push(projState);
    }

    const snapshot: GameSnapshot = {
      tick: this.tick,
      timestamp: Date.now() as Milliseconds,
      tanks,
      projectiles,
      mapDelta: [...this.tileDelta],
      lastProcessedInput: 0,
      matchState,
    };

    this.tileDelta = [];
    return snapshot;
  }

  advanceTick(): void {
    this.tick++;
  }
}
