// ═══════════════════════════════════════════════════════════════════
// Engine barrel export
// ═══════════════════════════════════════════════════════════════════

export { GameLoop, TICK_RATE, TICK_INTERVAL_MS } from './engine/GameLoop';
export { GameState } from './engine/GameState';
export { EntityManager } from './engine/EntityManager';
export { MovementSystem } from './engine/systems/MovementSystem';
export { CollisionSystem } from './engine/systems/CollisionSystem';
export { ProjectileSystem } from './engine/systems/ProjectileSystem';
export { CombatSystem } from './engine/systems/CombatSystem';
export { StatusEffectSystem } from './engine/systems/StatusEffectSystem';
export { TANK_ROSTER } from './data/tank-roster';
export { TEST_MAP, TEST_MAP_SPAWNS } from './data/maps';
export type { SpawnPoint } from './data/maps';
export * from './engine/components';
