// ═══════════════════════════════════════════════════════════════════
// TankRenderer.ts — Twin-Stick Tank Architecture
//
// Tank = Phaser.GameObjects.Container with 2 independent layers:
//   - hullSprite:   rotates smoothly toward WASD velocity direction
//   - turretSprite: instantly tracks mouse world position
//   - hpBarGfx:     floating HP bar drawn above the container
//
// ASSET_PIPELINE §4: turret pivot at (0.5, 0.8)
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';

/** Entity data the renderer reads */
export interface RenderableTank {
  transform?: { position: { x: number; y: number }; rotation: number };
  turret?: { aimAngle: number };
  health?: { hp: number; maxHp: number; isAlive: boolean };
}

const TILE_PX = 32;
const HULL_SIZE = 60;    // Display size for hull sprite (1.5× of 40)
const TURRET_W = 21;     // Turret barrel width (1.5× of 14)
const TURRET_H = 54;     // Turret barrel length (1.5× of 36)

export class TankRenderer {
  /** Expose container for camera follow */
  public readonly container: Phaser.GameObjects.Container;
  public readonly hullSprite: Phaser.GameObjects.Sprite;
  private readonly turretSprite: Phaser.GameObjects.Sprite;
  private readonly hpFrame: Phaser.GameObjects.Image;
  private readonly hpFill: Phaser.GameObjects.Image;
  private readonly shadowGfx: Phaser.GameObjects.Graphics;

  /** Smoothed hull rotation for visual interpolation */
  private displayHullAngle = 0;
  private lastAlive = true;

  constructor(scene: Phaser.Scene, entity: RenderableTank, tankKey: string = 'ironman') {
    const startX = (entity.transform?.position.x ?? 5) * TILE_PX;
    const startY = (entity.transform?.position.y ?? 5) * TILE_PX;

    // ─── Container ──────────────────────────────────────────
    this.container = scene.add.container(startX, startY);
    this.container.setDepth(20); // Tanks between water(10) and walls(30)

    // ─── Ground Shadow (below hull) ─────────────────────────
    this.shadowGfx = scene.add.graphics();
    this.shadowGfx.fillStyle(0x000000, 0.25);
    this.shadowGfx.fillEllipse(0, 4, HULL_SIZE + 6, HULL_SIZE * 0.55);
    this.container.add(this.shadowGfx);

    // ─── Hull Sprite ────────────────────────────────────────
    const hullKey = `hull_${tankKey}`;
    this.hullSprite = scene.add.sprite(0, 0, hullKey);
    this.hullSprite.setOrigin(0.5, 0.5);
    this.scaleToFit(this.hullSprite, HULL_SIZE, HULL_SIZE);
    this.container.add(this.hullSprite);

    // ─── Turret Sprite ──────────────────────────────────────
    const turretKey = `turret_${tankKey}`;
    this.turretSprite = scene.add.sprite(0, 0, turretKey);
    // Pivot at barrel base (ASSET_PIPELINE §4)
    this.turretSprite.setOrigin(0.5, 0.8);
    this.scaleToFit(this.turretSprite, TURRET_W, TURRET_H);
    this.container.add(this.turretSprite);

    // ─── Floating HP Bar (above container) ──────────────────
    const barW = 38;
    const barH = 6;
    const fillW = 34;
    const fillH = 4;

    this.hpFrame = scene.add.image(startX, startY, 'ui_hp_frame')
      .setOrigin(0, 0.5)
      .setDepth(50)
      .setScale(barW / 100, barH / 12);

    this.hpFill = scene.add.image(startX, startY, 'ui_hp_fill')
      .setOrigin(0, 0.5)
      .setDepth(50)
      .setScale(fillW / 96, fillH / 8);
  }

  /**
   * Update every frame from entity state.
   */
  update(entity: RenderableTank): void {
    if (!entity.transform) return;

    const px = entity.transform.position.x * TILE_PX;
    const py = entity.transform.position.y * TILE_PX;

    // ─── Position ───────────────────────────────────────────
    this.container.setPosition(px, py);

    // ─── Hull Rotation (smooth lerp toward velocity angle) ──
    const targetAngle = entity.transform.rotation + Math.PI / 2;
    this.displayHullAngle = Phaser.Math.Angle.RotateTo(
      this.displayHullAngle,
      targetAngle,
      0.15, // Lerp speed — smooth but responsive
    );
    this.hullSprite.setRotation(this.displayHullAngle);

    // ─── Turret Rotation (instant mouse tracking) ───────────
    if (entity.turret) {
      this.turretSprite.setRotation(entity.turret.aimAngle + Math.PI / 2);
    }

    // ─── Floating HP Bar ────────────────────────────────────
    this.drawHpBar(px, py, entity);

    // ─── Visibility ─────────────────────────────────────────
    const alive = entity.health?.isAlive ?? true;
    const hasHealth = !!entity.health;
    this.container.setVisible(alive);
    this.hpFrame.setVisible(alive && hasHealth);
    this.hpFill.setVisible(alive && hasHealth);

    // Death flash effect
    if (!alive && this.lastAlive) {
      this.container.setAlpha(0.3);
    } else if (alive && !this.lastAlive) {
      this.container.setAlpha(1);
    }
    this.lastAlive = alive;
  }

  private drawHpBar(px: number, py: number, entity: RenderableTank): void {
    if (!entity.health) {
      this.hpFrame.setVisible(false);
      this.hpFill.setVisible(false);
      return;
    }

    const barW = 38;
    const barH = 6;
    const fillW = 34;
    const fillH = 4;
    const barX = px - barW / 2;
    const barY = py - HULL_SIZE / 2 - 10; // Above the tank

    const hpRatio = Math.max(0, entity.health.hp / entity.health.maxHp);
    const alive = entity.health.isAlive;

    this.hpFrame.setPosition(barX, barY);
    this.hpFrame.setVisible(alive);

    const fillX = barX + (barW - fillW) / 2;
    this.hpFill.setPosition(fillX, barY);
    this.hpFill.setVisible(alive);

    // HP fill color texture based on ratio
    let fillKey = 'ui_hp_fill';
    if (hpRatio < 0.6) fillKey = 'ui_hp_fill_yellow';
    if (hpRatio < 0.3) fillKey = 'ui_hp_fill_red';
    
    this.hpFill.setTexture(fillKey);

    // Deplete HP bar using setCrop (original fill texture width is 96)
    this.hpFill.setCrop(0, 0, 96 * hpRatio, 8);
  }

  private scaleToFit(sprite: Phaser.GameObjects.Sprite, targetW: number, targetH: number): void {
    const tex = sprite.texture.getSourceImage();
    const scaleX = targetW / tex.width;
    const scaleY = targetH / tex.height;
    const scale = Math.min(scaleX, scaleY);
    sprite.setScale(scale);
  }
}
