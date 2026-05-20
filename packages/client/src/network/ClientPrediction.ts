// ═══════════════════════════════════════════════════════════════════
// ClientPrediction.ts — Optimistic input + server reconciliation
// The local player applies input immediately. On snapshot receipt,
// we reconcile by snapping to server state and re-applying unconfirmed
// inputs.
// ═══════════════════════════════════════════════════════════════════

import type { PlayerInput, Vector2, Radians, GameSnapshot, TankSnapshot } from '@bang-bang/shared';

const MAX_PENDING_INPUTS = 120; // ~2s at 60fps

interface PendingInput {
  seq: number;
  input: PlayerInput;
  /** Position AFTER this input was applied locally */
  predictedPosition: Vector2;
}

export class ClientPrediction {
  private pendingInputs: PendingInput[] = [];
  private localPlayerId: string;

  /** Local predicted position */
  public position: Vector2 = { x: 0, y: 0 };
  /** Local predicted hull rotation */
  public hullRotation: number = 0;
  /** Speed for local prediction */
  public speed: number = 3.5;

  constructor(playerId: string) {
    this.localPlayerId = playerId;
  }

  /**
   * Apply an input locally (optimistic prediction).
   * Call this every frame BEFORE sending to server.
   */
  applyInput(input: PlayerInput, dt: number): void {
    const dtSec = dt / 1000;

    if (input.moveDir) {
      const dir = input.moveDir;
      const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
      if (mag > 0) {
        const nx = dir.x / mag;
        const ny = dir.y / mag;
        this.position = {
          x: this.position.x + nx * this.speed * dtSec,
          y: this.position.y + ny * this.speed * dtSec,
        };
        this.hullRotation = Math.atan2(ny, nx);
      }
    }

    // Store the pending input
    this.pendingInputs.push({
      seq: input.seq,
      input,
      predictedPosition: { ...this.position },
    });

    // Trim old inputs
    if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs = this.pendingInputs.slice(-MAX_PENDING_INPUTS);
    }
  }

  /**
   * Reconcile with an authoritative server snapshot.
   * 1. Find our tank in the snapshot
   * 2. Discard all inputs up to lastProcessedInput
   * 3. Set position to server's authoritative position
   * 4. Re-apply remaining unconfirmed inputs
   */
  reconcile(snapshot: GameSnapshot): void {
    const myTank = snapshot.tanks.find(
      t => (t.playerId as string) === this.localPlayerId
    );
    if (!myTank) return;

    const lastConfirmedSeq = snapshot.lastProcessedInput;

    // Discard confirmed inputs
    this.pendingInputs = this.pendingInputs.filter(
      p => p.seq > lastConfirmedSeq
    );

    // Snap to server position
    this.position = { ...myTank.position };
    this.hullRotation = myTank.hullRotation as number;

    // Re-apply unconfirmed inputs
    // NOTE: We use a fixed dt approximation since we don't store exact dt per input
    const dtPerInput = 1000 / 60 / 1000; // ~16.67ms in seconds
    for (const pending of this.pendingInputs) {
      if (pending.input.moveDir) {
        const dir = pending.input.moveDir;
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (mag > 0) {
          const nx = dir.x / mag;
          const ny = dir.y / mag;
          this.position = {
            x: this.position.x + nx * this.speed * dtPerInput,
            y: this.position.y + ny * this.speed * dtPerInput,
          };
          this.hullRotation = Math.atan2(ny, nx);
        }
      }
    }
  }

  /**
   * Initialize from a server snapshot (first frame).
   */
  initFromSnapshot(tank: TankSnapshot): void {
    this.position = { ...tank.position };
    this.hullRotation = tank.hullRotation as number;
  }

  /**
   * Reset for new match.
   */
  reset(): void {
    this.pendingInputs = [];
    this.position = { x: 0, y: 0 };
    this.hullRotation = 0;
  }
}
