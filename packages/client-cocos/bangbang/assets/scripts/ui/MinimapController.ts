/**
 * MinimapController.ts — Minimap using Cocos Graphics component
 */

import { _decorator, Component, Graphics, Color } from 'cc';

const { ccclass, property } = _decorator;

const MINIMAP_W = 160;
const MINIMAP_H = 120;

interface MinimapEntity {
  x: number;
  y: number;
  color: Color;
  isPlayer: boolean;
}

@ccclass('MinimapController')
export class MinimapController extends Component {
  @property(Graphics)
  graphics: Graphics | null = null;

  private mapWidthGrids = 40;
  private mapHeightGrids = 30;
  private entities: MinimapEntity[] = [];

  updateEntities(
    playerPos: { x: number; y: number },
    remoteTanks: Array<{ x: number; y: number; isAlly: boolean }>,
  ): void {
    this.entities = [];

    this.entities.push({
      x: playerPos.x / this.mapWidthGrids,
      y: playerPos.y / this.mapHeightGrids,
      color: new Color(46, 204, 113),
      isPlayer: true,
    });

    for (const tank of remoteTanks) {
      this.entities.push({
        x: tank.x / this.mapWidthGrids,
        y: tank.y / this.mapHeightGrids,
        color: tank.isAlly ? new Color(52, 152, 219) : new Color(231, 76, 60),
        isPlayer: false,
      });
    }
  }

  update(): void {
    if (!this.graphics) return;
    this.graphics.clear();

    // Background
    this.graphics.fillColor = new Color(20, 20, 30, 200);
    this.graphics.rect(0, 0, MINIMAP_W, MINIMAP_H);
    this.graphics.fill();

    // Entity dots
    for (const entity of this.entities) {
      const px = entity.x * MINIMAP_W;
      const py = (1 - entity.y) * MINIMAP_H;
      const radius = entity.isPlayer ? 4 : 3;

      this.graphics.fillColor = entity.color;
      this.graphics.circle(px, py, radius);
      this.graphics.fill();
    }

    // Border
    this.graphics.strokeColor = new Color(80, 80, 100);
    this.graphics.lineWidth = 2;
    this.graphics.rect(0, 0, MINIMAP_W, MINIMAP_H);
    this.graphics.stroke();
  }
}
