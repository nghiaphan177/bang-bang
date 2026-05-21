/**
 * MapController.ts — 3D Map rendering for Cocos Creator 3.8
 */

import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

const TILE_PX = 32;

@ccclass('MapController')
export class MapController extends Component {
  @property(Node)
  groundPlane: Node | null = null;

  @property(Prefab)
  steelBoxPrefab: Prefab | null = null;

  @property(Prefab)
  woodBoxPrefab: Prefab | null = null;

  @property(Node)
  boxContainer: Node | null = null;

  private boxNodes: Map<string, Node> = new Map();

  initMap(tiles: any[][], widthGrids: number, heightGrids: number): void {
    const mapW = widthGrids * TILE_PX;
    const mapH = heightGrids * TILE_PX;

    if (this.groundPlane) {
      this.groundPlane.setPosition(mapW / 2, -0.1, -mapH / 2);
      this.groundPlane.setScale(mapW, 1, mapH);
    }

    for (let r = 0; r < heightGrids; r++) {
      for (let c = 0; c < widthGrids; c++) {
        const tile = tiles[r]?.[c];
        if (!tile) continue;

        const tileType = tile.type as string;
        const key = `${c},${r}`;
        const wx = c * TILE_PX + TILE_PX / 2;
        const wz = -(r * TILE_PX + TILE_PX / 2);

        if (tileType === 'SteelBox' && this.steelBoxPrefab && this.boxContainer) {
          const box = instantiate(this.steelBoxPrefab);
          box.setPosition(wx, TILE_PX / 2, wz);
          this.boxContainer.addChild(box);
          this.boxNodes.set(key, box);
        } else if (tileType === 'WoodBox' && this.woodBoxPrefab && this.boxContainer) {
          const box = instantiate(this.woodBoxPrefab);
          box.setPosition(wx, TILE_PX / 2, wz);
          this.boxContainer.addChild(box);
          this.boxNodes.set(key, box);
        }
      }
    }
  }

  markDestroyed(col: number, row: number): void {
    const key = `${col},${row}`;
    const boxNode = this.boxNodes.get(key);
    if (boxNode) {
      boxNode.destroy();
      this.boxNodes.delete(key);
    }
  }
}
