// ═══════════════════════════════════════════════════════════════════
// EntityManager.ts — Lightweight ECS: create, destroy, query entities
// ═══════════════════════════════════════════════════════════════════

import { EntityId } from '@bang-bang/shared';
import { GameEntity, EntityTag } from './components';

let nextEntityId = 0;

function generateEntityId(): EntityId {
  return `ent_${nextEntityId++}` as EntityId;
}

export class EntityManager {
  private readonly entities: Map<EntityId, GameEntity> = new Map();
  private readonly byTag: Map<EntityTag, Set<EntityId>> = new Map();

  constructor() {
    this.byTag.set('tank', new Set());
    this.byTag.set('projectile', new Set());
    this.byTag.set('pickup', new Set());
  }

  /**
   * Create a new entity with the given tag and return it for component attachment.
   */
  create(tag: EntityTag): GameEntity {
    const id = generateEntityId();
    const entity: GameEntity = { id, tag };
    this.entities.set(id, entity);
    this.byTag.get(tag)!.add(id);
    return entity;
  }

  /**
   * Destroy an entity and remove it from all indices.
   */
  destroy(id: EntityId): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    this.byTag.get(entity.tag)?.delete(id);
    this.entities.delete(id);
  }

  /**
   * Get an entity by ID. Returns undefined if not found.
   */
  get(id: EntityId): GameEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Get all entities with a specific tag.
   */
  getByTag(tag: EntityTag): GameEntity[] {
    const ids = this.byTag.get(tag);
    if (!ids) return [];
    const result: GameEntity[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) result.push(entity);
    }
    return result;
  }

  /**
   * Get all tanks (convenience).
   */
  getTanks(): GameEntity[] {
    return this.getByTag('tank');
  }

  /**
   * Get all projectiles (convenience).
   */
  getProjectiles(): GameEntity[] {
    return this.getByTag('projectile');
  }

  /**
   * Get all entities.
   */
  getAll(): GameEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Total entity count.
   */
  get count(): number {
    return this.entities.size;
  }

  /**
   * Clear all entities (for match reset).
   */
  clear(): void {
    this.entities.clear();
    for (const set of this.byTag.values()) {
      set.clear();
    }
    nextEntityId = 0;
  }
}
