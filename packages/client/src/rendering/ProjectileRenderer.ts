// ═══════════════════════════════════════════════════════════════════
// ProjectileRenderer.ts — Projectile sprite pooling & rendering
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';

const TILE_PX = 32;
const PROJ_DISPLAY_SIZE = 20;

interface RenderableProjectile {
  id: string;
  transform: { position: { x: number; y: number }; rotation: number };
  projectile: {
    phase: string;
    tankId?: string;
    projectileType?: string;
  };
}

export class ProjectileRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Sync visible sprites with current projectile list.
   */
  update(projectiles: RenderableProjectile[]): void {
    const activeIds = new Set<string>();

    for (const proj of projectiles) {
      activeIds.add(proj.id);

      const px = proj.transform.position.x * TILE_PX;
      const py = proj.transform.position.y * TILE_PX;

      let sprite = this.sprites.get(proj.id);
      if (!sprite) {
        // Determine texture based on tankId or projectileType
        let texKey = 'projectile_beam';
        const tankId = proj.projectile.tankId;
        const projType = proj.projectile.projectileType;
        if (tankId) {
          const lowerTankId = tankId.toLowerCase();
          if (this.scene.textures.exists(`projectile_${lowerTankId}`)) {
            texKey = `projectile_${lowerTankId}`;
          }
        } else if (projType) {
          const lowerType = projType.toLowerCase();
          if (this.scene.textures.exists(`projectile_${lowerType}`)) {
            texKey = `projectile_${lowerType}`;
          }
        }

        // Create new sprite
        sprite = this.scene.add.image(px, py, texKey);
        sprite.setDepth(40);
        // Scale to game size
        const tex = sprite.texture.getSourceImage();
        const scale = PROJ_DISPLAY_SIZE / Math.max(tex.width, tex.height);
        sprite.setScale(scale);
        this.sprites.set(proj.id, sprite);
      }

      sprite.setPosition(px, py);
      sprite.setRotation(proj.transform.rotation);
    }

    // Remove sprites for expired projectiles
    for (const [id, sprite] of this.sprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  /**
   * Destroy all projectile sprites.
   */
  destroy(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
  }
}
