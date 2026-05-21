// ═══════════════════════════════════════════════════════════════════
// arctic-collision.ts — Arctic Polar 40×30 collision grid
//
// Legend:
//   . = Ground (walkable)
//   # = SteelWall (border + major walls, baked into map_bg)
//   W = Water (frozen rivers, baked into map_bg)
//   B = Bush (snow bushes, baked into map_bg)
//   S = SteelBox (indestructible crate, rendered as sprite)
//   X = WoodBox (destructible crate, rendered as sprite)
//
// The map_bg.png extends beyond this 40×30 grid visually.
// The playable area is exactly 40×30 tiles = 1280×960 pixels.
// ═══════════════════════════════════════════════════════════════════

import { type CollisionMapData } from './collision-map-loader';

export const ARCTIC_COLLISION: CollisionMapData = {
  name: 'Arctic Polar',
  width: 40,
  height: 30,
  grid: [
    // Row 0-29 (40 chars wide each)
    '########################################', // 0  Border
    '#......................................#', // 1
    '#.XX..........WW..............XX.......#', // 2
    '#.XX..........WW..............XX.......#', // 3
    '#.....SS......WW.......SS..........BB..#', // 4
    '#.....SS......WW.......SS..........BB..#', // 5
    '#.............WW.......................#', // 6
    '#..BB.........WW...........XX..........#', // 7
    '#..BB.........WW...........XX..........#', // 8
    '#.............WW.......................#', // 9
    '#....WWWWWWWWWWWWWWWWWWWWW.............#', // 10
    '#....WWWWWWWWWWWWWWWWWWWWW.............#', // 11
    '#.............WW.......................#', // 12
    '#..XX.........WW............SS.........#', // 13
    '#..XX.........WW............SS.........#', // 14
    '#.............WW.......................#', // 15
    '#.............WW.......................#', // 16
    '#.....SS......WW............XX.........#', // 17
    '#.....SS......WW............XX.........#', // 18
    '#.............WW.......................#', // 19
    '#.............WWWWWWWWWWWWWWWWW........#', // 20
    '#.............WWWWWWWWWWWWWWWWW........#', // 21
    '#.............WW.......................#', // 22
    '#..BB.........WW...........SS.........#', // 23
    '#..BB.........WW...........SS.........#', // 24
    '#.............WW.......................#', // 25
    '#.XX..........WW..............XX...BB..#', // 26
    '#.XX..........WW..............XX...BB..#', // 27
    '#......................................#', // 28
    '########################################', // 29  Border
  ],
};
