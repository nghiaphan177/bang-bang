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

const COL_PLAYER_H = new Color(60, 140, 70, 255);
const COL_PLAYER_T = new Color(45, 110, 55, 255);
const COL_ENEMY_H  = new Color(180, 50, 50, 255);
const COL_ENEMY_T  = new Color(140, 40, 40, 255);
const COL_ALLY_H   = new Color(52, 152, 219, 255);
const COL_ALLY_T   = new Color(41, 128, 185, 255);

export interface RenderableTank {
  transform: { position: { x: number; y: number }; rotation: number };
  turret: { aimAngle: number };
  health: { hp: number; maxHp: number; isAlive: boolean };
  isPlayer?: boolean;
  isAlly?: boolean;
  level?: number;
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
  private currentColorState: 'player' | 'ally' | 'enemy' | null = null;

  private lastKnownHp = 0;
  private redMat: Material | null = null;
  private isFlashing = false;
  private shimmerCount = 30;

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

    // ── Damage Flash ───────────────────────────────────────────
    if (this.lastKnownHp > 0 && hp < this.lastKnownHp && data.health.isAlive) {
      this.triggerDamageFlash();
    }
    this.lastKnownHp = hp;

    // ── Team Coloring ──────────────────────────────────────────
    const targetColorState = isPlayer ? 'player' : (isAlly ? 'ally' : 'enemy');
    if (this.currentColorState !== targetColorState) {
      this.currentColorState = targetColorState;
      if (!this.isFlashing) {
        this.restoreMaterials();
      }
    }

    const ratio = maxHp > 0 ? hp / maxHp : 0;
    if (this.hpBarFill) {
      const fillWidth = 30 * ratio;
      this.hpBarFill.setScale(fillWidth, 1.1, 2.6);
      this.hpBarFill.setPosition(-15 + fillWidth / 2, 0.2, 0);
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

    // ── Visual Scale based on Level ────────────────────────────
    const level = data.level ?? 1;
    const HITBOX_SCALE = [1.0, 1.05, 1.10, 1.15, 1.20];
    const scaleFactor = HITBOX_SCALE[level - 1] ?? 1.0;

    // ── Alive / Dead ───────────────────────────────────────────
    const alive = data.health.isAlive;
    if (!alive && this.lastAlive) {
      this.playDeathExplosion();
      tween(this.node)
        .to(0.3, { scale: new Vec3(0.01, 0.01, 0.01) })
        .call(() => {
          this.node.active = false;
        })
        .start();
    } else if (alive && !this.lastAlive) {
      this.node.active = true;
      this.node.setScale(0.01, 0.01, 0.01);
      this.unschedule(this.toggleShimmer);
      if (this.hullNode && this.turretPivot) {
        this.hullNode.active = true;
        this.turretPivot.active = true;
      }
      tween(this.node)
        .to(0.4, { scale: new Vec3(scaleFactor, scaleFactor, scaleFactor) })
        .start();

      this.shimmerCount = 0;
      this.schedule(this.toggleShimmer, 0.1, 30);
    } else if (alive) {
      if (this.shimmerCount >= 30) {
        this.node.setScale(scaleFactor, scaleFactor, scaleFactor);
        this.node.active = true;
      }
    } else {
      this.node.active = false;
    }
    this.lastAlive = alive;
  }

  fireEffect(): void {
    if (!this.turretPivot) return;

    const flashNode = new Node('MuzzleFlash');
    this.turretPivot.addChild(flashNode);
    flashNode.setPosition(0, 0, -37);

    const sphereMesh = utils.createMesh(primitives.sphere(2));
    const mr = flashNode.addComponent(MeshRenderer);
    mr.mesh = sphereMesh;
    mr.material = this.makeMat(new Color(255, 200, 50, 255));

    flashNode.setScale(0, 0, 0);
    tween(flashNode)
      .to(0.05, { scale: new Vec3(3, 3, 3) })
      .to(0.05, { scale: new Vec3(0, 0, 0) })
      .call(() => {
        flashNode.destroy();
      })
      .start();
  }

  private triggerDamageFlash(): void {
    if (!this.redMat) {
      this.redMat = this.makeMat(new Color(255, 0, 0, 255));
    }

    if (this.hullNode) {
      const hullMR = this.hullNode.getComponent(MeshRenderer);
      if (hullMR) hullMR.material = this.redMat;
      const slopeNode = this.hullNode.getChildByName('HullSlope');
      if (slopeNode) {
        const slopeMR = slopeNode.getComponent(MeshRenderer);
        if (slopeMR) slopeMR.material = this.redMat;
      }
    }
    if (this.turretPivot) {
      const domeNode = this.turretPivot.getChildByName('TurretDome');
      if (domeNode) {
        const domeMR = domeNode.getComponent(MeshRenderer);
        if (domeMR) domeMR.material = this.redMat;
      }
    }

    this.isFlashing = true;
    this.unschedule(this.restoreMaterials);
    this.scheduleOnce(this.restoreMaterials, 0.1);
  }

  private restoreMaterials(): void {
    this.isFlashing = false;
    if (this.currentColorState === 'player') {
      this.setTeamColor(COL_PLAYER_H, COL_PLAYER_T);
    } else if (this.currentColorState === 'ally') {
      this.setTeamColor(COL_ALLY_H, COL_ALLY_T);
    } else {
      this.setTeamColor(COL_ENEMY_H, COL_ENEMY_T);
    }
  }

  private toggleShimmer(): void {
    this.shimmerCount++;
    if (this.hullNode && this.turretPivot) {
      const activeState = !this.hullNode.active;
      this.hullNode.active = activeState;
      this.turretPivot.active = activeState;

      if (this.shimmerCount >= 30) {
        this.hullNode.active = true;
        this.turretPivot.active = true;
        this.unschedule(this.toggleShimmer);
      }
    }
  }

  private playDeathExplosion(): void {
    if (!this.node.parent) return;
    const expNode = new Node('DeathExplosion');
    this.node.parent.addChild(expNode);
    expNode.setPosition(this.node.position);

    const sphereMesh = utils.createMesh(primitives.sphere(8));
    const mr = expNode.addComponent(MeshRenderer);
    mr.mesh = sphereMesh;
    mr.material = this.makeMat(new Color(255, 80, 0, 255));

    expNode.setScale(0, 0, 0);
    tween(expNode)
      .to(0.3, { scale: new Vec3(3, 3, 3) })
      .call(() => {
        expNode.destroy();
      })
      .start();
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
    // Position it float 22 units above center: Y=22, Z=-16
    this.hpBarNode.setPosition(0, 22, -16);

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
      divider.setScale(0.4, 1.2, 2.8);
      divider.setPosition(x, 0.4, 0);
      this.hpBarDividers.push(divider);
    }
  }

  setTeamColor(hullColor: Color, turretColor: Color): void {
    const hullMat = this.makeMat(hullColor);
    const turretMat = this.makeMat(turretColor);

    if (this.hullNode) {
      const hullMR = this.hullNode.getComponent(MeshRenderer);
      if (hullMR) hullMR.material = hullMat;

      const slopeNode = this.hullNode.getChildByName('HullSlope');
      if (slopeNode) {
        const slopeMR = slopeNode.getComponent(MeshRenderer);
        if (slopeMR) slopeMR.material = hullMat;
      }
    }

    if (this.turretPivot) {
      const domeNode = this.turretPivot.getChildByName('TurretDome');
      if (domeNode) {
        const domeMR = domeNode.getComponent(MeshRenderer);
        if (domeMR) domeMR.material = turretMat;
      }
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
