# Codebase Structure Rule

Treat this structure as a strict placement contract for the Bang Bang CMM Remake monorepo.

## 1) Root Package Contract

All production code must be under `packages/`:
- `packages/shared` — cross-module domain primitives, types, and environment schemas
- `packages/server` — 60Hz WebSocket authoritative game server
- `packages/client-cocos` — Cocos Creator 3.8 client (3D mode, primary)
- `packages/client` — LEGACY Phaser 3 client (preserved for reference, do NOT modify)

Documentation and tooling:
- `docs/` — Design & developer specifications (AGENT_CONTEXT.md, GDD.md, ASSET_PIPELINE.md)
- `tools/asset-gen/` — Asset processing scripts (rembg background removal)
- `tools/blender/` — Blender source files for 3D tank models

## 2) Shared Package (`packages/shared`)

`shared` is for reusable building blocks used by both client and server:
- TypeScript types and interfaces
- Environment schemas and collision maps
- Constants and enums
- Network payload definitions

Do not place environment-specific logic (DOM, Node APIs, WebSocket handlers, Cocos `cc` imports) here.

## 3) Server Package (`packages/server`)

Authoritative game server running at 60Hz.
- Contains custom Arcade Physics
- Handles WebSocket connections
- Manages authoritative game state
- Broadcasts snapshots at 20Hz

## 4) Cocos Client Package (`packages/client-cocos`)

Cocos Creator 3.8 client with 3D rendering:
- `assets/scripts/` — TypeScript components (network, game, rendering, UI, input)
- `assets/models/` — Imported 3D models (.glb)
- `assets/textures/` — 2D textures (map backgrounds, UI)
- `assets/materials/` — Cel-shaded materials and effects
- `assets/prefabs/` — Tank, projectile, UI prefabs
- `assets/scenes/` — Boot, Game, Lobby scenes

## 5) Placement Rules (Hard)

- If code is shared between client and server, it goes to `packages/shared`.
- If code is server-side game logic or netcode, it goes to `packages/server`.
- If code is a Cocos component/rendering/UI, it goes to `packages/client-cocos/assets/scripts/`.
- 3D models (.blend) go to `tools/blender/`, exported .glb go to `packages/client-cocos/assets/models/`.
- Do NOT modify `packages/client/` — it is the legacy Phaser client for reference only.
