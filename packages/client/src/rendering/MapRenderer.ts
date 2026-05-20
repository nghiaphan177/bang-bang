// ═══════════════════════════════════════════════════════════════════
// MapRenderer.ts — Image-based map renderer
//
// Architecture:
//   - map_bg.png is the ENTIRE visual map. It extends BEYOND the
//     playable grid area for visual clarity (bleed region).
//   - Server/client maintains a hidden collision grid for logic.
//   - Only interactive objects (SteelBox, WoodBox) are rendered as
//     sprites ON TOP of the background at their grid positions.
//   - When a WoodBox is destroyed, its sprite is removed and a
//     rubble overlay appears.
//
// Depth: 0 (background), 2 (box sprites), 1 (rubble)
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import { type GameMap, TileType } from '@bang-bang/shared';

const TILE_PX = 32;

/** How many extra pixels the map_bg extends beyond the grid on each side */
const BG_BLEED_PX = 64;

/** Map theme determines which background image to use */
export type MapTheme = 'default' | 'arctic';

/** Theme → background image texture key */
const THEME_BG: Record<MapTheme, string> = {
  default: 'map_bg_default',
  arctic:  'map_bg_arctic',
};

export class MapRenderer {
  private scene: Phaser.Scene;
  private boxSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private rubbleSprites: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor(scene: Phaser.Scene, map: GameMap, theme: MapTheme = 'default') {
    this.scene = scene;
    const rows = map.heightGrids as number;
    const cols = map.widthGrids as number;
    const mapW = cols * TILE_PX;
    const mapH = rows * TILE_PX;

    // ─── Single static map background image ───────────────────
    // The image extends beyond the grid for visual clarity
    const bgKey = THEME_BG[theme];
    if (scene.textures.exists(bgKey)) {
      const bg = scene.add.image(mapW / 2, mapH / 2, bgKey);
      // Scale to cover grid area PLUS bleed on each side
      bg.setDisplaySize(mapW + BG_BLEED_PX * 2, mapH + BG_BLEED_PX * 2);
      bg.setDepth(0);
    } else {
      // Fallback: solid color fill if image not loaded
      const fallbackKey = theme === 'arctic' ? 'bg_arctic' : 'bg_ground';
      if (scene.textures.exists(fallbackKey)) {
        const bg = scene.add.tileSprite(mapW / 2, mapH / 2, mapW, mapH, fallbackKey);
        bg.setDepth(0);
      }
    }

    // ─── Render box sprites on top of background ─────────────
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map.tiles[r]?.[c];
        if (!tile) continue;

        const cx = c * TILE_PX + TILE_PX / 2;
        const cy = r * TILE_PX + TILE_PX / 2;
        const key = `${c},${r}`;

        if (tile.type === TileType.SteelBox) {
          const sprite = scene.add.image(cx, cy, 'tile_steel_box');
          sprite.setDisplaySize(TILE_PX, TILE_PX);
          sprite.setDepth(2);
          this.boxSprites.set(key, sprite);
        } else if (tile.type === TileType.WoodBox) {
          const sprite = scene.add.image(cx, cy, 'tile_wood_box');
          sprite.setDisplaySize(TILE_PX, TILE_PX);
          sprite.setDepth(2);
          this.boxSprites.set(key, sprite);
        }
      }
    }
  }

  /**
   * Called when a box/brick is destroyed — remove its sprite and
   * overlay a rubble mark at the grid position.
   */
  markDestroyed(col: number, row: number): void {
    const key = `${col},${row}`;

    // Remove box sprite if exists
    const boxSprite = this.boxSprites.get(key);
    if (boxSprite) {
      boxSprite.destroy();
      this.boxSprites.delete(key);
    }

    // Add rubble overlay
    if (this.rubbleSprites.has(key)) return;

    const cx = col * TILE_PX + TILE_PX / 2;
    const cy = row * TILE_PX + TILE_PX / 2;

    const sprite = this.scene.add.image(cx, cy, 'tile_destroyed');
    sprite.setDisplaySize(TILE_PX, TILE_PX);
    sprite.setDepth(1);
    sprite.setAlpha(0.7);
    this.rubbleSprites.set(key, sprite);
  }

  /**
   * Returns the collision grid data for the minimap to use.
   */
  getMap(): GameMap | null {
    return null; // MapRenderer doesn't store the map — use GameState
  }
}
