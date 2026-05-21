// ═══════════════════════════════════════════════════════════════════
// core.ts — Branded primitives, vectors, grid constants
// Bang Bang Remake — Shared Types
// ═══════════════════════════════════════════════════════════════════

/** Branded type utility for nominal typing */
type Brand<K, T> = K & { readonly __brand: T };

// ─── Identifiers ────────────────────────────────────────────────────

export type EntityId = Brand<string, 'EntityId'>;
export type PlayerId = Brand<string, 'PlayerId'>;

// ─── Unit Types (compile-time safety) ───────────────────────────────

export type Milliseconds = Brand<number, 'Milliseconds'>;
export type Seconds = Brand<number, 'Seconds'>;
export type GridUnits = Brand<number, 'GridUnits'>;
export type Degrees = Brand<number, 'Degrees'>;
export type Radians = Brand<number, 'Radians'>;
export type Pixels = Brand<number, 'Pixels'>;
export type Percentage = Brand<number, 'Percentage'>;

// ─── Vectors & Positions ────────────────────────────────────────────

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export interface GridPosition {
  readonly col: number;
  readonly row: number;
}

// ─── Grid Constants (GDD §1: 1 Grid = 32×32 pixels) ────────────────

export const GRID_SIZE_PX: Pixels = 32 as Pixels;

// ─── 8-Directional Movement (GDD §1: WASD, 8 directions) ───────────

export enum Direction {
  Up = 'Up',
  UpRight = 'UpRight',
  Right = 'Right',
  DownRight = 'DownRight',
  Down = 'Down',
  DownLeft = 'DownLeft',
  Left = 'Left',
  UpLeft = 'UpLeft',
}
