/**
 * TankController.ts — 3D Tank rendering component for Cocos Creator
 *
 * Controls hull rotation and turret aiming on a 3D tank prefab.
 * 
 * Coordinate mapping: game (x, y) → 3D (x * 32, 0, y * 32)
 * Game origin is top-left; Cocos Z increases away from camera.
 */

import { _decorator, Component, Node, Quat, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

const TILE_PX = 32;
const _tempQuat = new Quat();

export interface RenderableTank {
  transform: { position: { x: number; y: number }; rotation: number };
  turret: { aimAngle: number };
  health: { hp: number; maxHp: number; isAlive: boolean };
}

@ccclass('TankController')
export class TankController extends Component {
  @property(Node)
  hullNode: Node | null = null;

  @property(Node)
  turretPivot: Node | null = null;

  private displayHullAngle = 0;
  private lastAlive = true;

  updateFromState(data: RenderableTank): void {
    const worldX = data.transform.position.x * TILE_PX;
    const worldZ = data.transform.position.y * TILE_PX;

    // ── Position ───────────────────────────────────────────────
    this.node.setPosition(worldX, 0, worldZ);

    // ── Hull Rotation (Y-axis, smooth lerp) ────────────────────
    // Game rotation: 0 = right (+X), π/2 = down (+Y/+Z)
    // 3D Y rotation: 0 = -Z (forward), 90 = -X (left)
    // Convert: 3D_angle = -(game_angle * 180/π) + 90
    const targetAngle = -(data.transform.rotation * (180 / Math.PI)) - 90;
    this.displayHullAngle = this.lerpAngleDeg(this.displayHullAngle, targetAngle, 0.2);

    if (this.hullNode) {
      Quat.fromEuler(_tempQuat, 0, this.displayHullAngle, 0);
      this.hullNode.setRotation(_tempQuat);
    }

    // ── Turret Rotation (instant, follows mouse) ───────────────
    if (this.turretPivot) {
      const turretDeg = -(data.turret.aimAngle * (180 / Math.PI)) - 90;
      Quat.fromEuler(_tempQuat, 0, turretDeg, 0);
      this.turretPivot.setRotation(_tempQuat);
    }

    // ── Alive / Dead ───────────────────────────────────────────
    const alive = data.health.isAlive;
    if (!alive && this.lastAlive) {
      this.node.setScale(0.01, 0.01, 0.01);
    } else if (alive && !this.lastAlive) {
      tween(this.node)
        .to(0.3, { scale: new Vec3(1, 1, 1) })
        .start();
    }
    this.node.active = alive;
    this.lastAlive = alive;
  }

  private lerpAngleDeg(current: number, target: number, speed: number): number {
    let diff = target - current;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return current + diff * speed;
  }
}
