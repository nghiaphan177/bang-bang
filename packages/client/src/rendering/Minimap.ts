// ═══════════════════════════════════════════════════════════════════
// Minimap.ts — Corner minimap showing terrain + entities
//
// Uses a cached RenderTexture for the terrain base (drawn once),
// then overlays entity dots each frame. Updated every 3 frames
// for performance.
//
// Rule 15: Uses Phaser sprites/graphics only, NO DOM/HTML elements.
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import { type GameMap, TileType } from '@bang-bang/shared';

const TILE_PX = 32;

// ─── Tile type → minimap color ──────────────────────────────────
const TILE_COLORS: Partial<Record<TileType, number>> = {
  [TileType.Ground]:    0x4a6a8a,  // Pale blue-gray ground
  [TileType.SteelWall]: 0x2d3748,  // Dark border
  [TileType.BrickWall]: 0x8b5e3c,  // Brown brick
  [TileType.Bush]:      0x2d7d46,  // Green bush
  [TileType.Water]:     0x3b82f6,  // Bright blue water
  [TileType.Lava]:      0xef4444,  // Red lava
  [TileType.SteelBox]:  0x64748b,  // Steel gray box
  [TileType.WoodBox]:   0xa0722a,  // Brown wood box
};

export interface MinimapEntity {
  x: number;           // world X in grid units
  y: number;           // world Y in grid units
  type: 'player' | 'ally' | 'enemy';
}

export class Minimap {
  private scene: Phaser.Scene;

  // Minimap dimensions (pixels on screen)
  private readonly mmW: number;
  private readonly mmH: number;

  // Map dimensions (tiles)
  private readonly mapCols: number;
  private readonly mapRows: number;

  // Scale: tiles → minimap pixels
  private readonly scaleX: number;
  private readonly scaleY: number;

  // Fixed position on screen
  private readonly screenX: number;
  private readonly screenY: number;

  // Rendering objects
  private readonly bg: Phaser.GameObjects.RenderTexture;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly border: Phaser.GameObjects.Graphics;
  private readonly viewRect: Phaser.GameObjects.Graphics;

  // Frame counter for throttled updates
  private frameCount = 0;

  constructor(scene: Phaser.Scene, map: GameMap) {
    this.scene = scene;
    this.mapCols = map.widthGrids as number;
    this.mapRows = map.heightGrids as number;

    // Minimap size: proportional to map aspect ratio, max 160px wide
    const maxW = 160;
    const aspect = this.mapCols / this.mapRows;
    this.mmW = maxW;
    this.mmH = Math.round(maxW / aspect);

    // Position: bottom-left corner with padding
    this.screenX = 12;
    this.screenY = 640 - this.mmH - 12; // 640 = game height

    // Scale factors
    this.scaleX = this.mmW / this.mapCols;
    this.scaleY = this.mmH / this.mapRows;

    // ─── Background terrain (drawn once) ─────────────────────
    this.bg = scene.add.renderTexture(this.screenX, this.screenY, this.mmW, this.mmH);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(95);
    this.bg.setAlpha(0.85);
    this.drawTerrain(map);

    // ─── Entity overlay (redrawn each update) ────────────────
    this.overlay = scene.add.graphics();
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(96);

    // ─── Border frame ────────────────────────────────────────
    this.border = scene.add.graphics();
    this.border.setScrollFactor(0);
    this.border.setDepth(97);
    this.border.lineStyle(2, 0x444466, 1);
    this.border.strokeRect(this.screenX - 1, this.screenY - 1, this.mmW + 2, this.mmH + 2);

    // ─── Camera viewport rectangle ──────────────────────────
    this.viewRect = scene.add.graphics();
    this.viewRect.setScrollFactor(0);
    this.viewRect.setDepth(96);
  }

  /**
   * Draw the terrain base onto the RenderTexture (called once).
   */
  private drawTerrain(map: GameMap): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 });

    for (let r = 0; r < this.mapRows; r++) {
      for (let c = 0; c < this.mapCols; c++) {
        const tile = map.tiles[r]?.[c];
        if (!tile) continue;

        const color = TILE_COLORS[tile.type] ?? 0x4a6a8a;
        const px = Math.floor(c * this.scaleX);
        const py = Math.floor(r * this.scaleY);
        const pw = Math.ceil(this.scaleX);
        const ph = Math.ceil(this.scaleY);

        gfx.fillStyle(color, 1);
        gfx.fillRect(px, py, pw, ph);
      }
    }

    this.bg.draw(gfx);
    gfx.destroy();
  }

  /**
   * Update minimap with entity positions and camera viewport.
   * Called every frame but only redraws every 3 frames.
   */
  update(entities: MinimapEntity[], camera: Phaser.Cameras.Scene2D.Camera): void {
    this.frameCount++;
    if (this.frameCount % 3 !== 0) return;

    // ─── Entity dots ─────────────────────────────────────────
    this.overlay.clear();

    for (const entity of entities) {
      const px = this.screenX + entity.x * this.scaleX;
      const py = this.screenY + entity.y * this.scaleY;

      let color: number;
      let radius: number;

      switch (entity.type) {
        case 'player':
          color = 0x22c55e; // Green
          radius = 3;
          break;
        case 'ally':
          color = 0x3b82f6; // Blue
          radius = 2;
          break;
        case 'enemy':
          color = 0xef4444; // Red
          radius = 2;
          break;
      }

      // Glow for player
      if (entity.type === 'player') {
        this.overlay.fillStyle(color, 0.3);
        this.overlay.fillCircle(px, py, radius + 2);
      }

      this.overlay.fillStyle(color, 1);
      this.overlay.fillCircle(px, py, radius);
    }

    // ─── Camera viewport rectangle ───────────────────────────
    this.viewRect.clear();
    const camWorldX = camera.scrollX;
    const camWorldY = camera.scrollY;
    const camW = camera.width / camera.zoom;
    const camH = camera.height / camera.zoom;

    const rectX = this.screenX + (camWorldX / TILE_PX) * this.scaleX;
    const rectY = this.screenY + (camWorldY / TILE_PX) * this.scaleY;
    const rectW = (camW / TILE_PX) * this.scaleX;
    const rectH = (camH / TILE_PX) * this.scaleY;

    this.viewRect.lineStyle(1, 0xffffff, 0.6);
    this.viewRect.strokeRect(rectX, rectY, rectW, rectH);
  }
}
