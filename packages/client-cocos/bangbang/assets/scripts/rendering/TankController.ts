/**
 * TankController.ts — 3D Tank rendering component for Cocos Creator
 *
 * Controls hull rotation and turret aiming on a 3D tank prefab.
 * 
 * Coordinate mapping: game (x, y) → 3D (x * 32, 0, y * 32)
 * Game origin is top-left; Cocos Z increases away from camera.
 */

import {
  _decorator, Component, Node, Quat, Vec3, tween, utils, primitives,
  MeshRenderer, Material, Color,
} from 'cc';

const { ccclass, property } = _decorator;

const TILE_PX = 32;
const _tempQuat = new Quat();

export interface RenderableTank {
  transform: { position: { x: number; y: number }; rotation: number };
  turret: { aimAngle: number };
  health: { hp: number; maxHp: number; isAlive: boolean };
  isPlayer?: boolean;
  isAlly?: boolean;
}

@ccclass('TankController')
export class TankController extends Component {
  @property(Node)
  hullNode: Node | null = null;

  @property(Node)
  turretPivot: Node | null = null;

  private displayHullAngle = 0;
  private lastAlive = true;

  private hpBarNode: Node | null = null;
  private hpBarBg: Node | null = null;
  private hpBarFill: Node | null = null;
  private hpBarDividers: Node[] = [];
  private currentMaxHp = 0;

  updateFromState(data: RenderableTank): void {
    const worldX = data.transform.position.x * TILE_PX;
    const worldZ = data.transform.position.y * TILE_PX;

    // ── Position ───────────────────────────────────────────────
    this.node.setPosition(worldX, 0, worldZ);

    // ── HP Bar ─────────────────────────────────────────────────
    const isPlayer = data.isPlayer ?? false;
    const isAlly = data.isAlly ?? false;
    const maxHp = data.health.maxHp;
    const hp = data.health.hp;

    this.initHPBar(isPlayer, isAlly, maxHp);

    const ratio = maxHp > 0 ? hp / maxHp : 0;
    if (this.hpBarFill) {
      const fillWidth = 30 * ratio;
      this.hpBarFill.setScale(fillWidth, 1.1, 2.6);
      this.hpBarFill.setPosition(-15 + fillWidth / 2, 0.05, 0);
    }

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

  private initHPBar(isPlayer: boolean, isAlly: boolean, maxHp: number): void {
    if (this.hpBarNode) {
      if (this.currentMaxHp !== maxHp) {
        this.rebuildDividers(maxHp);
      }
      return;
    }

    this.currentMaxHp = maxHp;

    // HP Bar container
    this.hpBarNode = new Node('HPBar3D');
    this.node.addChild(this.hpBarNode);
    // Position it float 24 units above center: Y=18, Z=-24
    this.hpBarNode.setPosition(0, 18, -24);

    const boxMesh = utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));

    // 1. Background
    this.hpBarBg = new Node('HPBarBg');
    this.hpBarNode.addChild(this.hpBarBg);
    const bgMR = this.hpBarBg.addComponent(MeshRenderer);
    bgMR.mesh = boxMesh;
    bgMR.material = this.makeMat(new Color(40, 40, 40, 255));
    this.hpBarBg.setScale(30, 1, 2.5);

    // 2. Fill
    this.hpBarFill = new Node('HPBarFill');
    this.hpBarNode.addChild(this.hpBarFill);
    const fillMR = this.hpBarFill.addComponent(MeshRenderer);
    fillMR.mesh = boxMesh;

    let fillColor = new Color(231, 76, 60, 255); // Red (default/enemy)
    if (isPlayer) {
      fillColor = new Color(46, 204, 113, 255); // Green
    } else if (isAlly) {
      fillColor = new Color(52, 152, 219, 255); // Blue
    }
    fillMR.material = this.makeMat(fillColor);
    this.hpBarFill.setScale(0, 1.1, 2.6);

    // 3. Dividers
    this.rebuildDividers(maxHp);
  }

  private rebuildDividers(maxHp: number): void {
    for (const d of this.hpBarDividers) {
      d.destroy();
    }
    this.hpBarDividers = [];

    this.currentMaxHp = maxHp;

    if (!this.hpBarNode || maxHp > 10000 || maxHp <= 0) return;

    const boxMesh = utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
    const dividerMat = this.makeMat(new Color(0, 0, 0, 255)); // Black dividers

    const numIntervals = Math.floor((maxHp - 1) / 100);
    for (let i = 1; i <= numIntervals; i++) {
      const ratio = (i * 100) / maxHp;
      const x = -15 + 30 * ratio;

      const divider = new Node(`HPDivider_${i * 100}`);
      this.hpBarNode.addChild(divider);
      const mr = divider.addComponent(MeshRenderer);
      mr.mesh = boxMesh;
      mr.material = dividerMat;
      divider.setScale(0.3, 1.2, 2.7);
      divider.setPosition(x, 0.1, 0);
      this.hpBarDividers.push(divider);
    }
  }

  private makeMat(color: Color): Material {
    const mat = new Material();
    mat.initialize({ effectName: 'builtin-unlit' });
    mat.setProperty('mainColor', color);
    return mat;
  }

  private lerpAngleDeg(current: number, target: number, speed: number): number {
    let diff = target - current;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return current + diff * speed;
  }
}
