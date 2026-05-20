// ═══════════════════════════════════════════════════════════════════
// collision-map-loader.ts — Parse ASCII collision grid into GameMap
//
// Format: Each char in the grid maps to a tile type:
//   . = Ground
//   # = SteelWall (border walls, invisible — baked into map_bg)
//   W = Water (invisible — baked into map_bg)
//   B = Bush (invisible — baked into map_bg)
//   S = SteelBox (rendered as sprite on top of map_bg)
//   X = WoodBox (rendered as sprite on top, destructible)
//   ~ = Lava
// ═══════════════════════════════════════════════════════════════════

import {
  type GameMap,
  type TileDefinition,
  TileType,
  BushVisibilityState,
} from '../types/environment';
import { type GridUnits } from '../types/core';

export interface CollisionMapData {
  name: string;
  width: number;
  height: number;
  grid: string[];
}

const WOOD_BOX_HP = 400;

const CHAR_TO_TILE: Record<string, () => TileDefinition> = {
  '.': () => ({ type: TileType.Ground }),
  '#': () => ({ type: TileType.SteelWall }),
  'W': () => ({ type: TileType.Water }),
  'B': () => ({ type: TileType.Bush, visibility: BushVisibilityState.Stealth, visibleUntilMs: null }),
  'S': () => ({ type: TileType.SteelBox }),
  'X': () => ({ type: TileType.WoodBox, maxHp: WOOD_BOX_HP, hp: WOOD_BOX_HP, destroyed: false }),
  '~': () => ({ type: TileType.Lava }),
};

/**
 * Parse an ASCII collision grid into a GameMap.
 */
export function loadCollisionMap(data: CollisionMapData): GameMap {
  const tiles: TileDefinition[][] = [];

  for (let r = 0; r < data.height; r++) {
    const rowStr = data.grid[r] ?? '';
    const row: TileDefinition[] = [];

    for (let c = 0; c < data.width; c++) {
      const ch = rowStr[c] ?? '.';
      const factory = CHAR_TO_TILE[ch] ?? CHAR_TO_TILE['.']!;
      row.push(factory());
    }

    tiles.push(row);
  }

  return {
    name: data.name,
    widthGrids: data.width as GridUnits,
    heightGrids: data.height as GridUnits,
    tiles,
  };
}
