// ═══════════════════════════════════════════════════════════════════
// maps.ts — Test map definitions
// GDD §1: Grid System (1 Grid = 32x32 pixels)
// ═══════════════════════════════════════════════════════════════════

import {
  GameMap,
  TileType,
  TileDefinition,
  GridUnits,
  BushVisibilityState,
} from '@bang-bang/shared';

// ─── Tile Factory Helpers ───────────────────────────────────────────

function ground(): TileDefinition {
  return { type: TileType.Ground };
}

function brick(hp: number = 500): TileDefinition {
  return { type: TileType.BrickWall, maxHp: hp, hp, destroyed: false };
}

function steel(): TileDefinition {
  return { type: TileType.SteelWall };
}

function bush(): TileDefinition {
  return { type: TileType.Bush, visibility: BushVisibilityState.Stealth, visibleUntilMs: null };
}

function water(): TileDefinition {
  return { type: TileType.Water };
}

// Shorthand aliases for map layout readability
const G = ground;
const B = brick;
const S = steel;
const U = bush;   // 'U' for Underbrush
const W = water;

// ─── Test Map: 20x15 Grid ──────────────────────────────────────────
// A small symmetric arena for testing all tile types

function createTestMapTiles(): TileDefinition[][] {
  const rows = 15;
  const cols = 20;
  const tiles: TileDefinition[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: TileDefinition[] = [];
    for (let c = 0; c < cols; c++) {
      // Border walls (steel)
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        row.push(S());
      }
      // Center brick walls (destructible cover)
      else if ((r === 4 || r === 10) && c >= 5 && c <= 14) {
        row.push(B());
      }
      // Steel pillars
      else if ((r === 7) && (c === 3 || c === 16)) {
        row.push(S());
      }
      // Bush zones (stealth areas)
      else if ((r >= 6 && r <= 8) && (c >= 8 && c <= 11)) {
        row.push(U());
      }
      // Water channel
      else if (r === 7 && (c >= 5 && c <= 7 || c >= 12 && c <= 14)) {
        row.push(W());
      }
      // Everything else is ground
      else {
        row.push(G());
      }
    }
    tiles.push(row);
  }

  return tiles;
}

export const TEST_MAP: GameMap = {
  name: 'Test Arena',
  widthGrids: 20 as GridUnits,
  heightGrids: 15 as GridUnits,
  tiles: createTestMapTiles(),
};

// ─── Spawn Points ───────────────────────────────────────────────────

export interface SpawnPoint {
  readonly col: number;
  readonly row: number;
  readonly team: 'Red' | 'Blue';
}

export const TEST_MAP_SPAWNS: SpawnPoint[] = [
  // Red team (left side)
  { col: 2, row: 2, team: 'Red' },
  { col: 2, row: 7, team: 'Red' },
  { col: 2, row: 12, team: 'Red' },
  // Blue team (right side)
  { col: 17, row: 2, team: 'Blue' },
  { col: 17, row: 7, team: 'Blue' },
  { col: 17, row: 12, team: 'Blue' },
];

// ─── Arctic Map: "Cực Địa Bắc Cực" (Arctic Polar) ─────────────────
// 80x60 grid — large frozen tundra arena with ice walls and frozen rivers

function createArcticMapTiles(): TileDefinition[][] {
  const rows = 60;
  const cols = 80;
  const tiles: TileDefinition[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: TileDefinition[] = [];
    for (let c = 0; c < cols; c++) {
      // ─── Border walls (steel/ice, indestructible) ────────
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        row.push(S());
        continue;
      }

      // ─── Frozen river channels (horizontal) ──────────────
      if (r >= 14 && r <= 16 && c >= 8 && c <= 40) {
        row.push(W());
        continue;
      }
      if (r >= 42 && r <= 44 && c >= 38 && c <= 72) {
        row.push(W());
        continue;
      }
      // Frozen river (vertical connecting)
      if (c >= 38 && c <= 40 && r >= 14 && r <= 44) {
        row.push(W());
        continue;
      }

      // ─── Ice wall clusters (destructible) ────────────────
      // Northwest fortress
      if (r >= 8 && r <= 12 && c >= 12 && c <= 22) {
        row.push(B(400));
        continue;
      }
      // Northeast fortress
      if (r >= 8 && r <= 12 && c >= 55 && c <= 68) {
        row.push(B(400));
        continue;
      }
      // Southwest fortress
      if (r >= 48 && r <= 52 && c >= 10 && c <= 25) {
        row.push(B(400));
        continue;
      }
      // Southeast fortress
      if (r >= 48 && r <= 52 && c >= 52 && c <= 70) {
        row.push(B(400));
        continue;
      }
      // Center arena walls
      if (r >= 26 && r <= 34 && c >= 28 && c <= 30) {
        row.push(B(400));
        continue;
      }
      if (r >= 26 && r <= 34 && c >= 48 && c <= 50) {
        row.push(B(400));
        continue;
      }
      if (r === 30 && c >= 30 && c <= 48) {
        row.push(B(400));
        continue;
      }

      // ─── Steel pillars (indestructible ice columns) ──────
      if ((r === 20 || r === 40) && (c === 20 || c === 60)) {
        row.push(S());
        continue;
      }
      if (r === 30 && (c === 15 || c === 65)) {
        row.push(S());
        continue;
      }

      // ─── Snowy bush zones (stealth areas) ────────────────
      // Center bush ring
      if (r >= 27 && r <= 33 && c >= 34 && c <= 44) {
        row.push(U());
        continue;
      }
      // NW corner bushes
      if (r >= 3 && r <= 6 && c >= 3 && c <= 8) {
        row.push(U());
        continue;
      }
      // SE corner bushes
      if (r >= 53 && r <= 57 && c >= 70 && c <= 76) {
        row.push(U());
        continue;
      }
      // NE corner bushes
      if (r >= 3 && r <= 6 && c >= 70 && c <= 76) {
        row.push(U());
        continue;
      }
      // SW corner bushes
      if (r >= 53 && r <= 57 && c >= 3 && c <= 8) {
        row.push(U());
        continue;
      }

      // ─── Everything else: frozen ground ───────────────────
      row.push(G());
    }
    tiles.push(row);
  }
  return tiles;
}

export const ARCTIC_MAP: GameMap = {
  name: 'Arctic Polar',
  widthGrids: 80 as GridUnits,
  heightGrids: 60 as GridUnits,
  tiles: createArcticMapTiles(),
};

export const ARCTIC_MAP_SPAWNS: SpawnPoint[] = [
  // Red team (left side)
  { col: 5, row: 5, team: 'Red' },
  { col: 5, row: 30, team: 'Red' },
  { col: 5, row: 55, team: 'Red' },
  // Blue team (right side)
  { col: 74, row: 5, team: 'Blue' },
  { col: 74, row: 30, team: 'Blue' },
  { col: 74, row: 55, team: 'Blue' },
];
