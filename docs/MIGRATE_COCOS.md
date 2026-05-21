# Migrate Client from Phaser 3 → Cocos Creator

## Background

The current Phaser 3 client has the following issues:
- **Pixel rendering artifacts** — `pixelArt: false` + no `roundPixels` causes blurry, jittery sprites
- **No visual editor** — all UI, particles, animations must be hand-coded via Phaser Graphics API (598-line [BootScene.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/scenes/BootScene.ts) of procedural fallback textures)
- **No built-in VFX** — no particle system, no screen shake integration, no post-processing
- **"Pixel art feels wrong"** — the game aims for a 2.5D cel-shaded Flash webgame aesthetic, not pixel art

Cocos Creator 3.8 LTS solves all of these:
- Visual Scene Editor for UI, prefabs, animations
- Built-in 2D/3D Particle System, Tween, Camera effects
- TypeScript-native (reuse `@bang-bang/shared` directly)
- Excellent Web/Telegram Mini App build output (5-10MB)
- Sprite Atlas auto-packing, NineSlice, rich UI components

---

## User Review Required

> [!NOTE]
> **Decisions confirmed by user:**
> - **Cocos Creator 3.8.x LTS** — User is downloading
> - **Option B: 3D rendering** with orthographic camera — Low-poly cel-shaded 3D tank models (Blender → .glb → Cocos)
> - **Old Phaser client preserved** in `packages/client/` for reference
> - **3D tank models** designed from the start (not 2D→3D upgrade path)

## Open Questions

1. **Telegram Mini App target?** If yes, we should configure the Cocos build for Web Mobile from the start.
2. **Blender version?** Recommend Blender 4.x for .glb export. Do you have it installed?

---

## Proposed Changes

### Component 1: Monorepo Restructuring

#### Summary
Create `packages/client-cocos/` as a new Cocos Creator project. Keep server and shared packages untouched. The old Phaser client stays for reference.

```
bang-bang/
├── packages/
│   ├── shared/                    # UNCHANGED — TypeScript types & schemas
│   ├── server/                    # UNCHANGED — Node.js authoritative server
│   ├── client/                    # PRESERVED — Old Phaser 3 client (reference)
│   └── client-cocos/              # NEW — Cocos Creator 3.8 project
│       ├── assets/                # Cocos asset directory (scenes, prefabs, sprites, scripts)
│       │   ├── scenes/            # Main.scene, Game.scene, Lobby.scene
│       │   ├── prefabs/           # Tank.prefab, Projectile.prefab, HUD elements
│       │   ├── scripts/           # TypeScript components
│       │   │   ├── network/       # NetworkClient, ClientPrediction, EntityInterpolation
│       │   │   ├── game/          # GameManager, OnlineGameState, LocalGameState
│       │   │   ├── rendering/     # TankController, ProjectileController, MapController
│       │   │   ├── ui/            # HUD, MatchOverlay, Minimap, HealthBar
│       │   │   └── input/         # InputManager (WASD + mouse)
│       │   ├── textures/          # Imported sprites (hulls, turrets, projectiles, maps)
│       │   │   ├── tanks/
│       │   │   ├── projectiles/
│       │   │   ├── maps/
│       │   │   ├── tiles/
│       │   │   └── ui/
│       │   └── animations/        # Cocos animation clips
│       ├── settings/              # Cocos project settings
│       └── tsconfig.json          # Extends base, references @bang-bang/shared
├── docs/                          # UPDATED
├── tools/asset-gen/               # UPDATED — simplified pipeline
└── package.json                   # Add client-cocos workspace
```

#### [MODIFY] [package.json](file:///Users/phannghia/Projects/bang-bang/package.json)
- Add `"packages/client-cocos"` to workspaces array
- Add script: `"dev:cocos": "echo 'Open packages/client-cocos in Cocos Creator Dashboard'"`

---

### Component 2: Shared Types Reuse Strategy

#### Summary
Cocos Creator 3.8 uses TypeScript natively. We can import `@bang-bang/shared` types directly into Cocos scripts, but we need to handle the build output carefully since Cocos has its own module resolution.

#### Approach
- **Build `@bang-bang/shared` as usual** (`npm run build:shared`)
- **In Cocos scripts**, import types via relative path or npm workspace symlink:
  ```typescript
  // Option A: Direct relative import (simplest)
  import type { GameSnapshot, TankSnapshot, PlayerInput } from '../../../shared/src/types/network';
  
  // Option B: If Cocos resolves npm workspaces
  import type { GameSnapshot, TankSnapshot } from '@bang-bang/shared';
  ```
- **Runtime data** (collision maps, constants) will be copied or symlinked into `assets/scripts/data/`
- Types that are purely compile-time (`type`, `interface`, `enum`) work with either approach

> [!NOTE]
> Cocos Creator's bundler may not resolve npm workspace symlinks out of the box. We'll test Option B first; if it fails, we use Option A with a build script that copies the shared types into the Cocos project.

---

### Component 3: Asset Pipeline Overhaul

#### Summary
Replace the Python BFS flood-fill pipeline with Cocos Creator's native asset import system. The old `tools/asset-gen/process_assets.py` becomes mostly unnecessary.

#### Current Pipeline (Phaser)
```
AI generates PNG → Python BFS flood-fill removes white BG → Auto-crop → Square pad → Lanczos downsample → Copy to packages/client/public/assets/
```

#### New Pipeline (Cocos Creator)
```
AI generates PNG → Remove BG in Photoshop/GIMP/rembg CLI (one-time) → Drop into packages/client-cocos/assets/textures/ → Cocos auto-imports with .meta → Configure sprite settings in Inspector → Auto-pack into SpriteAtlas
```

#### Key differences:
| Aspect | Old (Phaser) | New (Cocos) |
|--------|-------------|-------------|
| **BG Removal** | Custom Python BFS flood-fill | Use `rembg` CLI or Photoshop (one-time, higher quality) |
| **Cropping/Padding** | Custom Python script | Cocos handles trim/padding in Sprite Inspector |
| **Downsampling** | Lanczos in Python | Cocos texture compression settings (ASTC/ETC/WebP) |
| **Sprite Atlas** | Manual (none currently) | Cocos auto-packs via SpriteAtlas asset |
| **Pivot/Anchor** | Code: `setOrigin(0.5, 0.8)` | Visual: Drag anchor point in Prefab Editor |
| **Fallback textures** | 500+ lines of procedural Graphics code | Not needed — Cocos shows pink placeholder if asset missing |
| **UI assets** | Procedural Canvas Graphics | Design in Cocos UI Editor with Sprite + NineSlice |

#### [MODIFY] [ASSET_PIPELINE.md](file:///Users/phannghia/Projects/bang-bang/docs/ASSET_PIPELINE.md)
- Rewrite §3 (Post-Processing) for Cocos workflow
- Rewrite §4 (UI & HUD Assets Pipeline) for Cocos UI Editor
- Rewrite §5 (Pivot Alignment) for Cocos Prefab anchor points
- Update §6 (Directory Structure) for new Cocos layout
- Keep §1-2 (AI prompt templates) — they're engine-agnostic

#### [MODIFY] [process_assets.py](file:///Users/phannghia/Projects/bang-bang/tools/asset-gen/process_assets.py)
- Simplify to just `rembg`-based background removal (remove custom BFS flood-fill)
- Output directly to `packages/client-cocos/assets/textures/`
- Remove Phaser-specific square-padding logic (Cocos handles this)

---

### Component 4: Cocos Creator Project Setup & Scene Architecture

#### [NEW] `packages/client-cocos/` — Cocos Creator 3.8 Project

**Scenes:**

| Scene | Purpose |
|-------|---------|
| `Boot.scene` | Loading screen, asset preload |
| `Game.scene` | Main gameplay (local + online dual-mode) |
| `Lobby.scene` | Future: tank selection, garage |

**Node Hierarchy for Game.scene:**
```
Canvas (UI Camera)
├── HUD
│   ├── HealthBar
│   ├── SkillSlots (E, Space)
│   ├── MatchTimer
│   ├── ScoreBoard
│   └── NetworkStatus (ping, player count)
├── MatchOverlay
│   ├── CountdownLabel
│   ├── ResultsPanel
│   └── KillFeed
└── Minimap

GameWorld (Game Camera)
├── MapBackground (Sprite: map_bg.png)
├── BoxContainer (SteelBox, WoodBox sprites at grid positions)
├── TankContainer
│   ├── PlayerTank (Prefab instance)
│   │   ├── HullSprite
│   │   ├── TurretSprite (child, anchor at barrel base)
│   │   ├── Shadow (ellipse sprite below hull)
│   │   └── FloatingHP (HP bar above tank)
│   └── RemoteTanks (dynamically instantiated)
├── ProjectileContainer
└── VFXContainer (particles: muzzle flash, explosion, dust trail)
```

---

### Component 5: Core Script Migration (Network + Game Logic)

#### Summary
Port the 3 network scripts and 2 game state scripts from Phaser to Cocos. The logic is nearly identical since it's pure TypeScript — only the rendering integration changes.

#### [NEW] `assets/scripts/network/NetworkClient.ts`
- Port from [NetworkClient.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/network/NetworkClient.ts)
- Uses browser-native `WebSocket` (same as Phaser version)
- **No changes to protocol or message format**

#### [NEW] `assets/scripts/network/ClientPrediction.ts`
- Port from [ClientPrediction.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/network/ClientPrediction.ts)
- Pure math logic — no Phaser dependency, copy as-is

#### [NEW] `assets/scripts/network/EntityInterpolation.ts`
- Port from [EntityInterpolation.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/network/EntityInterpolation.ts)
- Pure math logic — no Phaser dependency, copy as-is

#### [NEW] `assets/scripts/game/OnlineGameState.ts`
- Port from [OnlineGameState.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/game/OnlineGameState.ts)
- Remove `Phaser` imports, replace with Cocos `cc` types where needed
- Map handling unchanged (collision map from shared)

#### [NEW] `assets/scripts/game/LocalGameState.ts`
- Port from [LocalGameState.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/game/LocalGameState.ts)
- Remove Phaser-specific APIs

---

### Component 6: Rendering Components (Cocos-Native)

#### [NEW] `assets/scripts/rendering/TankController.ts`
- Cocos `Component` attached to Tank prefab root node
- Replaces [TankRenderer.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/rendering/TankRenderer.ts) (173 lines)
- **3D Tank Prefab hierarchy:**
  ```
  TankRoot (Node3D)
  ├── HullMesh (MeshRenderer + cel-shade Material)
  ├── TurretPivot (empty Node3D, positioned at mount point)
  │   └── TurretMesh (MeshRenderer + cel-shade Material)
  ├── Shadow (Sprite3D or projected shadow)
  └── FloatingHP (Billboard UI: ProgressBar)
  ```
- Hull rotation: `Quat.fromEuler()` with `lerp` in `update()` around Y-axis
- Turret tracking: `Math.atan2` → `Quat.fromEuler(0, angle, 0)` on TurretPivot
- HP bar: Cocos `ProgressBar` on billboard Canvas facing camera

#### [NEW] `assets/scripts/rendering/MapController.ts`
- Replaces [MapRenderer.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/rendering/MapRenderer.ts) (121 lines)
- Background: `Sprite3D` or `Plane MeshRenderer` with `map_bg.png` texture on a flat quad
- Box sprites: 3D box meshes or Sprite3D at grid positions
- Destroyed overlay: Swap mesh or show rubble particle
- Camera: **Orthographic** top-down, looking straight down (-Y)

#### [NEW] `assets/scripts/rendering/ProjectileController.ts`
- Replaces [ProjectileRenderer.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/rendering/ProjectileRenderer.ts)
- Object pool pattern using Cocos `NodePool`
- 3D projectile meshes with glow materials (emissive)
- Rotation from velocity vector (same math, applied to 3D node)

#### [NEW] `assets/scripts/ui/HUDController.ts`
- Replaces [HUD.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/rendering/HUD.ts) (240 lines of procedural drawing)
- **Built with Cocos UI Editor** — `ProgressBar`, `Label`, `Sprite` nodes
- Skill cooldown: `ProgressBar.progress` or `Sprite.fillRange` (radial fill!)
- Network status: `Label` node bound to data

#### [NEW] `assets/scripts/ui/MatchOverlayController.ts`
- Replaces [MatchOverlay.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/rendering/MatchOverlay.ts) (250+ lines)
- Countdown animation: Cocos `Animation` component (keyframe editor)
- Results panel: Cocos UI layout with `Layout` component

#### [NEW] `assets/scripts/ui/MinimapController.ts`
- Replaces [Minimap.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/rendering/Minimap.ts) (170 lines)
- Render using Cocos `Graphics` component or small sprite dots

---

### Component 7: Input System

#### [NEW] `assets/scripts/input/InputManager.ts`
- Replaces [InputManager.ts](file:///Users/phannghia/Projects/bang-bang/packages/client/src/input/InputManager.ts)
- WASD: `cc.input.on(Input.EventType.KEY_DOWN/UP, ...)`
- Mouse aim: `cc.input.on(Input.EventType.MOUSE_MOVE, ...)` → convert screen to world coords via `camera.screenToWorld()`
- Mouse fire: `cc.input.on(Input.EventType.MOUSE_DOWN, ...)`
- Touch support (mobile): `cc.input.on(Input.EventType.TOUCH_START/MOVE/END, ...)` — virtual joystick

---

### Component 8: VFX & Juice (New Capabilities)

These are NEW features not possible (or extremely tedious) in Phaser:

| Effect | Cocos Implementation |
|--------|---------------------|
| **Muzzle flash** | `ParticleSystem` (3D) on turret tip, burst on fire — with point light flash |
| **Explosion on hit** | 3D `ParticleSystem` + expanding sphere mesh with emissive material |
| **Dust trail** | `ParticleSystem` (3D) behind hull when moving — kicked-up debris |
| **Screen shake** | `cc.tween(camera.node).by(0.05, { position: ... }).repeat(3).start()` |
| **Death animation** | `cc.tween(tank).to(0.3, { scale: v3(0,0,0) })` + explosion particles |
| **Damage flash** | Material emissive flash (swap to red-tinted material for 100ms) |
| **HP bar smooth drain** | `cc.tween(progressBar).to(0.3, { progress: newRatio })` |
| **Dynamic shadows** | Cocos built-in shadow maps from directional light |
| **Tank tread tracks** | Decal projection on ground plane (optional) |

---

### Component 9: Map Background & 3D Asset Considerations

#### Map Background
- Keep the current `map_bg.png` approach (single static image)
- Render as a **3D Plane** (quad mesh) with `map_bg.png` as diffuse texture
- Camera: **Orthographic**, looking straight down (-Y axis)
- Cocos handles texture compression (WebP, ASTC) automatically for web builds
- Box obstacles: Low-poly 3D box meshes with cel-shaded materials at grid positions

#### 3D Tank Asset Pipeline (Blender → Cocos)
All tanks will be 3D from the start:

1. **Model in Blender** (low-poly, ~500-1500 tris per tank):
   - Hull mesh: separate object, origin at center
   - Turret mesh: separate object, origin at barrel mount point
   - Each tank = 1 `.blend` file with 2 objects
2. **Cel-shaded material**: Use Blender's toon shader for preview, but actual shading in Cocos:
   - Cocos custom Effect (`.effect` file) with stepped lighting (2-3 bands)
   - Bold outline via inverted-hull method or post-process
3. **Export as `.glb`** (binary glTF) — single file, embedded textures
4. **Import into Cocos** → auto-creates `Mesh`, `Material`, `Prefab`
5. **Assemble Tank Prefab in Cocos Editor**:
   - TankRoot → HullMesh + TurretPivot → TurretMesh
   - Adjust pivot points visually in editor
6. **5 Evolution Tiers**: Each tier = different `.glb` model (or same model + scale + material swap)

#### 3D Environment Assets
| Asset | Approach |
|-------|----------|
| **Map ground** | Flat plane mesh with artistic `map_bg.png` texture |
| **SteelBox** | Simple cube mesh with dark metallic material + rivets normal map |
| **WoodBox** | Simple cube mesh with wood diffuse texture |
| **Rubble** | Small scattered mesh pieces or particle debris |
| **Water tiles** | Plane with animated water shader (UV scrolling) |
| **Bush tiles** | Billboard sprite or low-poly foliage mesh |

---

### Component 10: Documentation Updates

#### [MODIFY] [AGENT_CONTEXT.md](file:///Users/phannghia/Projects/bang-bang/docs/AGENT_CONTEXT.md)
- §1 Tech Stack: Change Client from `Phaser 3 (WebGL)` → `Cocos Creator 3.8 (WebGL)`
- §2 Monorepo Structure: Add `client-cocos/` layout, mark `client/` as legacy
- §4 Current State: Add Phase 6 (Cocos Migration)
- §8 Dev Commands: Replace Phaser commands with Cocos workflow
- §9 Critical Rules: Remove Phaser-specific rules (rule #10 `.js` extensions, #15 Image-Based UI), add Cocos rules

#### [MODIFY] [ASSET_PIPELINE.md](file:///Users/phannghia/Projects/bang-bang/docs/ASSET_PIPELINE.md)
- §3: Replace Python BFS pipeline with `rembg` + Cocos import flow
- §4: Replace Phaser UI pipeline with Cocos UI Editor workflow
- §5: Replace Phaser `setOrigin()` rules with Cocos Prefab anchor points
- §6: Update directory structure
- §7: Update map rendering to reference Cocos Sprite nodes

#### [MODIFY] [GDD.md](file:///Users/phannghia/Projects/bang-bang/docs/GDD.md)
- Update Tech Stack section (line 6): Change `Phaser 3` → `Cocos Creator 3.8`

#### [MODIFY] [README.md](file:///Users/phannghia/Projects/bang-bang/README.md)
- Update Getting Started section with Cocos Creator workflow
- Add instructions for opening the Cocos project in Cocos Dashboard

---

## Execution Phases

### Phase 1: Setup (AI Agent)
1. Create Cocos Creator project skeleton in `packages/client-cocos/`
2. Configure `tsconfig.json` to reference `@bang-bang/shared`
3. Set up basic scene hierarchy (Boot → Game)

### Phase 2: Network & Game Logic Port (AI Agent)
4. Copy and adapt `NetworkClient.ts`, `ClientPrediction.ts`, `EntityInterpolation.ts`
5. Port `OnlineGameState.ts` and `LocalGameState.ts`
6. Port `InputManager.ts` to Cocos input system

### Phase 3: Rendering Components (AI Agent + User)
7. Create Tank prefab (Hull + Turret sprites) — **User places sprites in Editor**
8. Write `TankController.ts`, `MapController.ts`, `ProjectileController.ts`
9. Create HUD layout in Cocos UI Editor — **User arranges UI nodes**
10. Write `HUDController.ts`, `MatchOverlayController.ts`, `MinimapController.ts`

### Phase 4: Asset Migration (User + AI Agent)
11. Process existing tank PNGs through `rembg` → import into Cocos
12. Import `map_bg.png` backgrounds
13. Configure SpriteAtlas for tanks and projectiles
14. **User**: Adjust anchor points, sprite sizes in Prefab Editor

### Phase 5: VFX & Polish (AI Agent + User)
15. Add particle effects (muzzle flash, explosions, dust)
16. Add screen shake, damage flash, death animations
17. Add smooth HP bar transitions

### Phase 6: Documentation & Cleanup (AI Agent)
18. Update `AGENT_CONTEXT.md`, `ASSET_PIPELINE.md`, `GDD.md`, `README.md`
19. Update `.agent/` rules and workflows for Cocos

---

## Verification Plan

### Automated Checks
```bash
# Shared types still compile
npm run build:shared

# Server still works
npm run dev --workspace=@bang-bang/server

# Cocos project opens without errors (User verifies in Cocos Dashboard)
```

### Manual Verification
1. **Open `packages/client-cocos/` in Cocos Creator** — project loads without errors
2. **Run Game.scene in Cocos Preview** — map background renders, tank prefab visible
3. **Start server + Cocos preview** — client connects via WebSocket, receives snapshots
4. **WASD movement** — tank moves with prediction, hull rotates smoothly
5. **Mouse aiming** — turret tracks mouse position
6. **Fire (LMB)** — projectiles spawn and render
7. **Remote tanks** — other players interpolate smoothly
8. **HUD** — HP bar, skill cooldowns, network status display correctly
9. **Match lifecycle** — countdown → playing → match end works
10. **Web build** — `Cocos Build → Web Mobile` produces a working web bundle

### Comparison Test
- Run old Phaser client and new Cocos client side-by-side connecting to the same server
- Verify identical gameplay behavior (movement, shooting, collisions)
