// ═══════════════════════════════════════════════════════════════════
// DummyRenderer.ts — Render dummy/enemy tanks on the map
// Same visual style as player but without input-driven turret
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import type { RenderableTank } from './TankRenderer';

const TILE_PX = 32;
const HULL_SIZE = 57;    // (1.5× of 38)
const TURRET_W = 18;     // (1.5× of 12)
const TURRET_H = 45;     // (1.5× of 30)

export class DummyRenderer {
  private readonly container: Phaser.GameObjects.Container;
  private readonly hullSprite: Phaser.GameObjects.Sprite;
  private readonly turretSprite: Phaser.GameObjects.Sprite;
  private readonly hpFrame: Phaser.GameObjects.Image;
  private readonly hpFill: Phaser.GameObjects.Image;
  private lastAlive = true;
  private displayHullAngle = 0;

  constructor(scene: Phaser.Scene, entity: RenderableTank, tankKey: string) {
    const startX = (entity.transform?.position.x ?? 5) * TILE_PX;
    const startY = (entity.transform?.position.y ?? 5) * TILE_PX;

    this.container = scene.add.container(startX, startY);
    this.container.setDepth(20);

    // Shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillEllipse(0, 3, HULL_SIZE + 4, HULL_SIZE * 0.5);
    this.container.add(shadow);

    // Hull
    this.hullSprite = scene.add.sprite(0, 0, `hull_${tankKey}`);
    this.hullSprite.setOrigin(0.5, 0.5);
    this.scaleToFit(this.hullSprite, HULL_SIZE, HULL_SIZE);
    // Tint slightly to distinguish enemies
    this.hullSprite.setTint(0xff8888);
    this.container.add(this.hullSprite);

    // Turret
    this.turretSprite = scene.add.sprite(0, 0, `turret_${tankKey}`);
    this.turretSprite.setOrigin(0.5, 0.8);
    this.scaleToFit(this.turretSprite, TURRET_W, TURRET_H);
    this.container.add(this.turretSprite);

    // HP bar
    const barW = 34;
    const barH = 5;
    const fillW = 30;
    const fillH = 3;

    this.hpFrame = scene.add.image(startX, startY, 'ui_hp_frame')
      .setOrigin(0, 0.5)
      .setDepth(50)
      .setScale(barW / 100, barH / 12);

    // Enemies always use red HP fill
    this.hpFill = scene.add.image(startX, startY, 'ui_hp_fill_red')
      .setOrigin(0, 0.5)
      .setDepth(50)
      .setScale(fillW / 96, fillH / 8);
  }

  update(entity: RenderableTank): void {
    if (!entity.transform) return;

    const px = entity.transform.position.x * TILE_PX;
    const py = entity.transform.position.y * TILE_PX;
    this.container.setPosition(px, py);

    // Hull rotation (smooth lerp toward target)
    const targetAngle = entity.transform.rotation + Math.PI / 2;
    this.displayHullAngle = Phaser.Math.Angle.RotateTo(
      this.displayHullAngle,
      targetAngle,
      0.15,
    );
    this.hullSprite.setRotation(this.displayHullAngle);

    // Turret rotation (follows aim angle)
    if (entity.turret) {
      this.turretSprite.setRotation(entity.turret.aimAngle + Math.PI / 2);
    }

    // HP bar
    if (entity.health) {
      const barW = 34;
      const barH = 5;
      const fillW = 30;
      const fillH = 3;
      const barX = px - barW / 2;
      const barY = py - HULL_SIZE / 2 - 8;
      const hpRatio = Math.max(0, entity.health.hp / entity.health.maxHp);
      const alive = entity.health.isAlive;

      this.hpFrame.setPosition(barX, barY);
      this.hpFrame.setVisible(alive);

      const fillX = barX + (barW - fillW) / 2;
      this.hpFill.setPosition(fillX, barY);
      this.hpFill.setVisible(alive);

      // Crop the red fill texture (original fill texture width is 96)
      this.hpFill.setCrop(0, 0, 96 * hpRatio, 8);
    } else {
      this.hpFrame.setVisible(false);
      this.hpFill.setVisible(false);
    }

    // Visibility
    const alive = entity.health?.isAlive ?? true;
    const hasHealth = !!entity.health;
    this.container.setVisible(alive);
    this.hpFrame.setVisible(alive && hasHealth);
    this.hpFill.setVisible(alive && hasHealth);

    if (!alive && this.lastAlive) {
      this.container.setAlpha(0.15);
    } else if (alive && !this.lastAlive) {
      this.container.setAlpha(1);
    }
    this.lastAlive = alive;
  }

  /**
   * Clean up all Phaser game objects (for remote tank removal).
   */
  destroy(): void {
    this.container.destroy();
    this.hpFrame.destroy();
    this.hpFill.destroy();
  }

  private scaleToFit(sprite: Phaser.GameObjects.Sprite, tw: number, th: number): void {
    const tex = sprite.texture.getSourceImage();
    const s = Math.min(tw / tex.width, th / tex.height);
    sprite.setScale(s);
  }
}

