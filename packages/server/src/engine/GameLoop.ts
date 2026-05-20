// ═══════════════════════════════════════════════════════════════════
// GameLoop.ts — Fixed-timestep game loop (60Hz server tick)
// ═══════════════════════════════════════════════════════════════════

import { GameState } from './GameState';
import { MovementSystem } from './systems/MovementSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { CombatSystem } from './systems/CombatSystem';
import { StatusEffectSystem } from './systems/StatusEffectSystem';

/** Server tick rate: 60 ticks per second */
export const TICK_RATE = 60;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE;

export class GameLoop {
  private readonly state: GameState;
  private readonly movementSystem: MovementSystem;
  private readonly collisionSystem: CollisionSystem;
  private readonly projectileSystem: ProjectileSystem;
  private readonly combatSystem: CombatSystem;
  private readonly statusEffectSystem: StatusEffectSystem;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /** Callback invoked after each tick with the latest state */
  public onTick: ((state: GameState) => void) | null = null;

  constructor(state: GameState) {
    this.state = state;
    this.movementSystem = new MovementSystem();
    this.collisionSystem = new CollisionSystem();
    this.projectileSystem = new ProjectileSystem();
    this.combatSystem = new CombatSystem();
    this.statusEffectSystem = new StatusEffectSystem();

    // Wire cross-system references
    this.combatSystem.projectileSystem = this.projectileSystem;
  }

  /**
   * Start the game loop.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.intervalHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    this.running = false;
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Execute a single game tick. Can be called manually for testing.
   */
  tick(): void {
    const dt = TICK_INTERVAL_MS;
    const entities = this.state.entityManager;

    // 1. Process status effects (tick durations, expire, apply per-tick damage)
    this.statusEffectSystem.update(entities, dt);

    // 2. Apply movement from inputs (respects root/stun states)
    this.movementSystem.update(entities, dt);

    // 3. Resolve collisions against map and other entities
    this.collisionSystem.update(entities, this.state, dt);

    // 4. Update projectiles (move, check range, detect hits)
    this.projectileSystem.update(entities, this.state, dt);

    // 5. Process combat (damage application, death checks)
    this.combatSystem.update(entities, this.state, dt);

    // 6. Advance tick
    this.state.advanceTick();

    // 7. Notify listeners
    if (this.onTick) {
      this.onTick(this.state);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentState(): GameState {
    return this.state;
  }
}
