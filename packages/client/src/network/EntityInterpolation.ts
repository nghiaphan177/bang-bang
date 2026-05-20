// ═══════════════════════════════════════════════════════════════════
// EntityInterpolation.ts — Smooth rendering for remote entities
// Buffers server snapshots and interpolates between them.
// Remote entities render at (serverTime - interpolationDelay).
// ═══════════════════════════════════════════════════════════════════

import type { TankSnapshot, Vector2, Radians } from '@bang-bang/shared';

const INTERPOLATION_DELAY_MS = 100; // Render 100ms behind server
const MAX_BUFFER_SIZE = 10;

interface SnapshotFrame {
  timestamp: number;
  tanks: Map<string, TankSnapshot>;
}

export interface InterpolatedEntity {
  entityId: string;
  position: Vector2;
  hullRotation: number;
  turretRotation: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  tankId: string;
  team: string;
}

export class EntityInterpolation {
  private buffer: SnapshotFrame[] = [];
  private localPlayerId: string;

  constructor(localPlayerId: string) {
    this.localPlayerId = localPlayerId;
  }

  /**
   * Push a new server snapshot into the buffer.
   */
  pushSnapshot(timestamp: number, tanks: readonly TankSnapshot[]): void {
    const tankMap = new Map<string, TankSnapshot>();
    for (const tank of tanks) {
      // Skip local player — they use ClientPrediction
      if ((tank.playerId as string) === this.localPlayerId) continue;
      tankMap.set(tank.entityId as string, tank);
    }

    this.buffer.push({ timestamp, tanks: tankMap });

    // Trim old snapshots
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  /**
   * Get interpolated positions for all remote entities.
   * @param renderTime The current client render time (usually Date.now())
   */
  getInterpolatedEntities(renderTime: number): InterpolatedEntity[] {
    const targetTime = renderTime - INTERPOLATION_DELAY_MS;

    // Need at least 2 frames to interpolate
    if (this.buffer.length < 2) {
      // Return latest frame raw
      const latest = this.buffer[this.buffer.length - 1];
      if (!latest) return [];
      return this.frameTankList(latest);
    }

    // Find the two frames surrounding targetTime
    let prevFrame: SnapshotFrame | null = null;
    let nextFrame: SnapshotFrame | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i]!;
      const b = this.buffer[i + 1]!;
      if (a.timestamp <= targetTime && b.timestamp >= targetTime) {
        prevFrame = a;
        nextFrame = b;
        break;
      }
    }

    // If target is before all frames, use earliest
    if (!prevFrame || !nextFrame) {
      if (targetTime < (this.buffer[0]?.timestamp ?? 0)) {
        return this.frameTankList(this.buffer[0]!);
      }
      // If target is after all frames, use latest
      return this.frameTankList(this.buffer[this.buffer.length - 1]!);
    }

    // Interpolation factor
    const range = nextFrame.timestamp - prevFrame.timestamp;
    const t = range > 0 ? (targetTime - prevFrame.timestamp) / range : 0;
    const clampedT = Math.max(0, Math.min(1, t));

    const result: InterpolatedEntity[] = [];

    // Iterate next frame's entities (they're the "current" ones)
    for (const [entityId, nextTank] of nextFrame.tanks) {
      const prevTank = prevFrame.tanks.get(entityId);

      if (!prevTank) {
        // New entity — no interpolation, use as-is
        result.push(this.tankToInterpolated(entityId, nextTank));
        continue;
      }

      // Lerp position
      const pos: Vector2 = {
        x: prevTank.position.x + (nextTank.position.x - prevTank.position.x) * clampedT,
        y: prevTank.position.y + (nextTank.position.y - prevTank.position.y) * clampedT,
      };

      // Lerp rotation (use angle interpolation)
      const hullRot = this.lerpAngle(
        prevTank.hullRotation as number,
        nextTank.hullRotation as number,
        clampedT
      );
      const turretRot = this.lerpAngle(
        prevTank.turretRotation as number,
        nextTank.turretRotation as number,
        clampedT
      );

      result.push({
        entityId,
        position: pos,
        hullRotation: hullRot,
        turretRotation: turretRot,
        hp: nextTank.hp,
        maxHp: nextTank.maxHp,
        isAlive: nextTank.isAlive,
        tankId: nextTank.tankId as string,
        team: nextTank.team as string,
      });
    }

    return result;
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private frameTankList(frame: SnapshotFrame): InterpolatedEntity[] {
    const result: InterpolatedEntity[] = [];
    for (const [entityId, tank] of frame.tanks) {
      result.push(this.tankToInterpolated(entityId, tank));
    }
    return result;
  }

  private tankToInterpolated(entityId: string, tank: TankSnapshot): InterpolatedEntity {
    return {
      entityId,
      position: { ...tank.position },
      hullRotation: tank.hullRotation as number,
      turretRotation: tank.turretRotation as number,
      hp: tank.hp,
      maxHp: tank.maxHp,
      isAlive: tank.isAlive,
      tankId: tank.tankId as string,
      team: tank.team as string,
    };
  }

  /**
   * Shortest-path angle interpolation.
   */
  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  /**
   * Clear buffer (for match reset).
   */
  reset(): void {
    this.buffer = [];
  }
}
