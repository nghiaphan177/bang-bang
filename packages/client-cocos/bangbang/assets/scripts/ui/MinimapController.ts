/**
 * MinimapController.ts — Premium minimap with team dots, safe zones, and polish
 *
 * Features:
 * - Dark background with subtle grid lines
 * - Safe zone overlay (Red top-left, Blue bottom-right)
 * - Player dot with pulse animation
 * - Team-colored entity dots with glow rings
 * - Compass indicator
 */

import { _decorator, Component, Graphics, Color, Label } from 'cc';

const { ccclass, property } = _decorator;

const MINIMAP_W = 180;
const MINIMAP_H = 135;
const CORNER_R = 8;

// Arctic map dimensions
const MAP_W_GRIDS = 80;
const MAP_H_GRIDS = 60;

// Safe zone boundaries (matching server)
const SAFE_RED  = { minX: 1, minY: 1, maxX: 8, maxY: 8 };
const SAFE_BLUE = { minX: 72, minY: 52, maxX: 79, maxY: 59 };

// Colors
const COL_BG         = new Color(12, 14, 22, 220);
const COL_GRID       = new Color(30, 35, 50, 80);
const COL_BORDER     = new Color(50, 55, 75, 200);
const COL_BORDER_TOP = new Color(80, 90, 120, 200);
const COL_PLAYER     = new Color(46, 204, 113, 255);
const COL_PLAYER_GLOW = new Color(46, 204, 113, 50);
const COL_ALLY       = new Color(52, 152, 219, 255);
const COL_ALLY_GLOW  = new Color(52, 152, 219, 40);
const COL_ENEMY      = new Color(231, 76, 60, 255);
const COL_ENEMY_GLOW = new Color(231, 76, 60, 40);
const COL_SAFE_RED   = new Color(231, 76, 60, 30);
const COL_SAFE_BLUE  = new Color(52, 152, 219, 30);
const COL_SAFE_RED_BORDER  = new Color(231, 76, 60, 60);
const COL_SAFE_BLUE_BORDER = new Color(52, 152, 219, 60);
const COL_COMPASS    = new Color(200, 200, 210, 180);

interface MinimapEntity {
  x: number;
  y: number;
  color: Color;
  glowColor: Color;
  isPlayer: boolean;
}

@ccclass('MinimapController')
export class MinimapController extends Component {
  @property(Graphics)
  graphics: Graphics | null = null;

  private entities: MinimapEntity[] = [];
  private pulsePhase = 0;

  updateEntities(
    playerPos: { x: number; y: number },
    remoteTanks: Array<{ x: number; y: number; isAlly: boolean }>,
  ): void {
    this.entities = [];

    this.entities.push({
      x: playerPos.x / MAP_W_GRIDS,
      y: playerPos.y / MAP_H_GRIDS,
      color: COL_PLAYER,
      glowColor: COL_PLAYER_GLOW,
      isPlayer: true,
    });

    for (const tank of remoteTanks) {
      this.entities.push({
        x: tank.x / MAP_W_GRIDS,
        y: tank.y / MAP_H_GRIDS,
        color: tank.isAlly ? COL_ALLY : COL_ENEMY,
        glowColor: tank.isAlly ? COL_ALLY_GLOW : COL_ENEMY_GLOW,
        isPlayer: false,
      });
    }
  }

  update(dt: number): void {
    if (!this.graphics) return;
    this.graphics.clear();

    this.pulsePhase += dt * 3;

    // ── Background with rounded corners ────────────────────────
    this.graphics.fillColor = COL_BG;
    this.roundRect(this.graphics, 0, 0, MINIMAP_W, MINIMAP_H, CORNER_R);
    this.graphics.fill();

    // ── Subtle grid lines ──────────────────────────────────────
    this.graphics.strokeColor = COL_GRID;
    this.graphics.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const x = (MINIMAP_W / 4) * i;
      this.graphics.moveTo(x, CORNER_R);
      this.graphics.lineTo(x, MINIMAP_H - CORNER_R);
      this.graphics.stroke();
    }
    for (let i = 1; i < 3; i++) {
      const y = (MINIMAP_H / 3) * i;
      this.graphics.moveTo(CORNER_R, y);
      this.graphics.lineTo(MINIMAP_W - CORNER_R, y);
      this.graphics.stroke();
    }

    // ── Safe Zones ─────────────────────────────────────────────
    // Red safe zone (top-left of minimap = top-left of map)
    this.drawSafeZone(SAFE_RED, COL_SAFE_RED, COL_SAFE_RED_BORDER);
    // Blue safe zone (bottom-right)
    this.drawSafeZone(SAFE_BLUE, COL_SAFE_BLUE, COL_SAFE_BLUE_BORDER);

    // ── Entity dots ────────────────────────────────────────────
    for (const entity of this.entities) {
      const px = Math.max(3, Math.min(entity.x * MINIMAP_W, MINIMAP_W - 3));
      const py = Math.max(3, Math.min((1 - entity.y) * MINIMAP_H, MINIMAP_H - 3));

      // Glow ring
      const glowR = entity.isPlayer ? 7 + Math.sin(this.pulsePhase) * 2 : 5;
      this.graphics.fillColor = entity.glowColor;
      this.graphics.circle(px, py, glowR);
      this.graphics.fill();

      // Dot
      const dotR = entity.isPlayer ? 3.5 : 2.5;
      this.graphics.fillColor = entity.color;
      this.graphics.circle(px, py, dotR);
      this.graphics.fill();
    }

    // ── Border ──────────────────────────────────────────────────
    this.graphics.strokeColor = COL_BORDER;
    this.graphics.lineWidth = 1.5;
    this.roundRect(this.graphics, 0, 0, MINIMAP_W, MINIMAP_H, CORNER_R);
    this.graphics.stroke();

    // Top edge highlight
    this.graphics.strokeColor = COL_BORDER_TOP;
    this.graphics.lineWidth = 1;
    this.graphics.moveTo(CORNER_R + 4, 0.5);
    this.graphics.lineTo(MINIMAP_W - CORNER_R - 4, 0.5);
    this.graphics.stroke();

    // ── Compass N ───────────────────────────────────────────────
    // Draw small "N" at top center
    this.graphics.fillColor = COL_COMPASS;
    const nx = MINIMAP_W / 2;
    // Small triangle pointing up
    this.graphics.moveTo(nx, -6);
    this.graphics.lineTo(nx - 4, -1);
    this.graphics.lineTo(nx + 4, -1);
    this.graphics.close();
    this.graphics.fill();
  }

  private drawSafeZone(
    zone: { minX: number; minY: number; maxX: number; maxY: number },
    fillColor: Color,
    borderColor: Color,
  ): void {
    if (!this.graphics) return;

    const x1 = (zone.minX / MAP_W_GRIDS) * MINIMAP_W;
    const y1 = (1 - zone.maxY / MAP_H_GRIDS) * MINIMAP_H;
    const w = ((zone.maxX - zone.minX) / MAP_W_GRIDS) * MINIMAP_W;
    const h = ((zone.maxY - zone.minY) / MAP_H_GRIDS) * MINIMAP_H;

    this.graphics.fillColor = fillColor;
    this.graphics.rect(x1, y1, w, h);
    this.graphics.fill();

    this.graphics.strokeColor = borderColor;
    this.graphics.lineWidth = 1;
    this.graphics.rect(x1, y1, w, h);
    this.graphics.stroke();
  }

  private roundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    g.lineTo(x + w, y + h - r);
    g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    g.lineTo(x + r, y + h);
    g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    g.close();
  }
}
