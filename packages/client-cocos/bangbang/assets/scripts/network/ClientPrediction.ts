/**
 * ClientPrediction.ts — Optimistic input + server reconciliation
 * 
 * The local player applies input immediately. On snapshot receipt,
 * we reconcile by snapping to server state and re-applying unconfirmed inputs.
 * 
 * Pure TypeScript — no engine dependency.
 */

import type { PlayerInput, Vector2, GameSnapshot, TankSnapshot } from '../shared/types/network';

const MAX_PENDING_INPUTS = 120; // ~2s at 60fps

interface PendingInput {
  seq: number;
  input: PlayerInput;
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

    this.pendingInputs.push({
      seq: input.seq,
      input,
      predictedPosition: { ...this.position },
    });

    if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs = this.pendingInputs.slice(-MAX_PENDING_INPUTS);
    }
  }

  /**
   * Reconcile with an authoritative server snapshot.
   */
  reconcile(snapshot: GameSnapshot): void {
    const myTank = snapshot.tanks.find(
      t => (t.playerId as string) === this.localPlayerId
    );
    if (!myTank) return;

    const lastConfirmedSeq = snapshot.lastProcessedInput;

    this.pendingInputs = this.pendingInputs.filter(
      p => p.seq > lastConfirmedSeq
    );

    this.position = { ...myTank.position };
    this.hullRotation = myTank.hullRotation as number;

    const dtPerInput = 1000 / 60 / 1000;
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

  initFromSnapshot(tank: TankSnapshot): void {
    this.position = { ...tank.position };
    this.hullRotation = tank.hullRotation as number;
  }

  reset(): void {
    this.pendingInputs = [];
    this.position = { x: 0, y: 0 };
    this.hullRotation = 0;
  }
}
