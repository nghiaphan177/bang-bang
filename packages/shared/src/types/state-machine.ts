// ═══════════════════════════════════════════════════════════════════
// state-machine.ts — Strict state enums & transition documentation
// GDD §3.1: Exactly 6 Core States
// ═══════════════════════════════════════════════════════════════════

// ─── Tank State Machine (GDD §3.1 — ONE state at a time) ───────────

export enum TankState {
  /** Standing still. Accepts all input. */
  Idle = 'IDLE',
  /** Velocity > 0. Accepts all attack/aim input. */
  Moving = 'MOVING',
  /** Cast-time delay. Locks other skills. May lock movement. */
  Casting = 'CASTING',
  /** Dashing/flying. Locks movement + turret rotation. Immune to Slow. */
  Dashing = 'DASHING',
  /** Stunned. Locks ALL input. Interrupts Casting. */
  Stunned = 'STUNNED',
  /** HP = 0. Hitbox off. Respawn countdown. */
  Dead = 'DEAD',
}

// ─── Projectile Phase Machine ───────────────────────────────────────

export enum ProjectilePhase {
  /** Traveling toward target / max range */
  Active = 'Active',
  /** Boomerang returning to sender */
  Returning = 'Returning',
  /** Reached max range or lifetime */
  Expired = 'Expired',
  /** Hit a target or wall */
  Hit = 'Hit',
}

// ─── Match Phase ────────────────────────────────────────────────────

export enum MatchPhase {
  WaitingForPlayers = 'WaitingForPlayers',
  Countdown = 'Countdown',
  Playing = 'Playing',
  MatchEnd = 'MatchEnd',
}

// ─── State Transition Documentation ─────────────────────────────────

export interface StateTransition<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly condition: string;
}

// ─── Documented Tank State Transitions (GDD §3.1) ──────────────────
//
// Idle     → Moving    : WASD pressed
// Idle     → Casting   : Skill pressed, cooldown ready
// Moving   → Idle      : WASD released
// Moving   → Dashing   : Dash skill activated
// Casting  → Idle      : Cast complete
// Any      → Stunned   : Hit by Stun effect
// Any      → Dead      : HP <= 0
// Dead     → Idle      : Respawn complete + invuln buff applied
// Stunned  → Idle      : Stun duration expires
// Dashing  → Idle      : Dash complete or hit wall
//
// NOTE: Root and Silence are STATUS EFFECTS (in Active_Effects array),
// not core states. Root sets velocity=0 but state stays Idle/Moving.
// Silence blocks skill input but state stays current.
