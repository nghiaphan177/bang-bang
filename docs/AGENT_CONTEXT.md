# 🤖 AGENT CONTEXT — Bang Bang CMM Remake

> **READ THIS FIRST.** This file is the single source of truth for any AI agent picking up this project. It describes the project architecture, current state, what has been built, what's pending, and all rules you must follow. Updated: 2026-05-21.

---

## 1. PROJECT OVERVIEW

**Name:** Bang Bang CMM Remake
**Genre:** 2D Top-down Arena Tank Shooter (think: Bullet Hell meets casual MOBA)
**Inspiration:** The original Bang Bang mobile game — fast tanks, diverse heroes, PVP arenas.

**Tech Stack:**
| Layer | Tech | Notes |
|-------|------|-------|
| Client/Rendering | **Cocos Creator 3.8 LTS (3D mode)** | Orthographic top-down camera, cel-shaded 3D tanks |
| Server | Node.js + `ws` | Authoritative game loop at 60Hz |
| Shared Types | `@bang-bang/shared` | TypeScript strict, brand types |
| Networking | WebSockets | Client prediction + server reconciliation |
| 3D Modeling | Blender 4.x | Low-poly cel-shaded models → `.glb` export |
| Language | TypeScript strict | `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true` |

**Design Philosophy:**
- NO Energy/Mana system — combat uses Cooldowns + AttackSpeed only.
- NO in-match shops — progression via In-Match Evolution (5 levels, 5 visual tiers).
- Server-authoritative ECS. Client does prediction + interpolation.
- Circle hitbox for tanks, AABB for tiles.
- Free movement (NOT grid-locked).
- **3D rendering** with orthographic camera for premium cel-shaded aesthetic.

---

## 2. MONOREPO STRUCTURE

```
bang-bang/
├── docs/                          # ← YOU ARE HERE
│   ├── AGENT_CONTEXT.md           # This file — read first
│   ├── GDD.md                     # Full Game Design Document (Vietnamese + English terms)
│   └── ASSET_PIPELINE.md          # 3D asset generation + processing pipeline
│
├── packages/
│   ├── shared/                    # @bang-bang/shared — all type definitions
│   │   ├── src/types/
│   │   │   ├── core.ts            # Brand types: EntityId, PlayerId, Vector2, GridUnits, etc.
│   │   │   ├── tank.ts            # TankAttributes (7 stats), TankDefinition, TankRosterMap
│   │   │   ├── skills.ts          # SkillSlot(3), ProjectileArchetype(7), DamageChannel(3), SkillDefinition
│   │   │   ├── combat.ts          # StatusEffectType(6), DamageInstance, ProjectileState, StatusEffect
│   │   │   ├── state-machine.ts   # TankState enum (6 states: Idle/Moving/Casting/Dashing/Stunned/Dead)
│   │   │   ├── network.ts         # PlayerInput, TankSnapshot, GameSnapshot, ClientMessage, ServerMessage
│   │   │   ├── environment.ts     # TileType(7), TileDefinition, GameMap, PickupType
│   │   │   ├── progression.ts     # EvolutionTier(5), HardwareSlot, EvolutionLevel
│   │   │   ├── game-modes.ts      # GameMode, TeamId, MatchConfig, SafeZone
│   │   │   ├── pve.ts             # MobType, BossPhase, WaveDefinition
│   │   │   └── gacha.ts           # Rarity, GachaPull, Currency
│   │   └── src/index.ts           # Barrel re-exports (uses .js extensions for ESM)
│   │
│   ├── server/                    # @bang-bang/server — authoritative game server
│   │   ├── src/
│   │   │   ├── main.ts            # Entry point — starts WebSocketServer on port 8080
│   │   │   ├── data/
│   │   │   │   ├── tank-roster.ts # Concrete stat data for all 4 tanks
│   │   │   │   └── maps.ts       # Map definitions
│   │   │   ├── engine/
│   │   │   │   ├── components.ts  # ECS components (Transform, Health, CombatStats, etc.)
│   │   │   │   ├── EntityManager.ts # Entity create/destroy/query
│   │   │   │   ├── GameState.ts   # World state + snapshot serialization
│   │   │   │   ├── GameLoop.ts    # Fixed timestep loop
│   │   │   │   └── systems/
│   │   │   │       ├── MovementSystem.ts      # WASD 8-dir + turret tracking
│   │   │   │       ├── CollisionSystem.ts     # Circle-vs-AABB tile collision
│   │   │   │       ├── ProjectileSystem.ts    # Spawn/move/hit/wall detection
│   │   │   │       ├── CombatSystem.ts        # Damage formula + death
│   │   │   │       └── StatusEffectSystem.ts  # Tick/expire effects
│   │   │   └── network/
│   │   │       ├── WebSocketServer.ts  # HTTP + WS server, message routing
│   │   │       ├── Room.ts             # Game session (60Hz tick, input→systems→snapshot)
│   │   │       └── InputBuffer.ts      # Per-player latest input storage
│   │   └── package.json           # deps: ws, tsx
│   │
│   └── client-cocos/              # @bang-bang/client-cocos — Cocos Creator 3.8 (3D)
│       ├── assets/                # Cocos asset directory
│       │   ├── scenes/            # Boot.scene, Game.scene, Lobby.scene
│       │   ├── prefabs/           # Tank.prefab, Projectile.prefab, UI elements
│       │   ├── scripts/           # TypeScript components
│       │   │   ├── network/       # NetworkClient, ClientPrediction, EntityInterpolation
│       │   │   ├── game/          # GameManager, OnlineGameState, LocalGameState
│       │   │   ├── rendering/     # TankController, ProjectileController, MapController
│       │   │   ├── ui/            # HUD, MatchOverlay, Minimap, HealthBar
│       │   │   └── input/         # InputManager (WASD + mouse)
│       │   ├── models/            # Imported 3D models (.glb)
│       │   │   ├── tanks/         # Per-tank hull + turret meshes
│       │   │   ├── environment/   # Boxes, obstacles
│       │   │   └── projectiles/   # Projectile meshes
│       │   ├── textures/          # 2D textures (map_bg, UI sprites)
│       │   ├── materials/         # Cel-shaded materials + effects
│       │   ├── effects/           # Custom shader effects (.effect)
│       │   └── animations/        # Cocos animation clips
│       ├── settings/              # Cocos project settings
│       └── tsconfig.json
│
├── tools/
│   ├── asset-gen/                 # Asset processing scripts
│   │   └── process_assets.py      # Background removal (rembg)
│   └── blender/                   # Blender files for 3D tank models
│       ├── ironman.blend
│       ├── naruto.blend
│       ├── spiderman.blend
│       └── thanhgiong.blend
│
├── package.json                   # Workspace root
├── tsconfig.base.json             # Shared TS config (strict, bundler resolution)
└── tsconfig.json                  # Root project references
```

---

## 3. CORE GAME RULES (QUICK REFERENCE)

### 3.1. Stats (7 Base Stats)
| Stat | Field | Description |
|------|-------|-------------|
| HP | `hp` | Health points |
| ATK | `atk` | Attack power (single stat, not split P/E) |
| Range | `range` | Attack range in pixels |
| Physical DEF | `defP` | Reduces Physical channel damage |
| Energy DEF | `defE` | Reduces Energy channel damage |
| Attack Speed | `attackSpeed` | Attacks per second (e.g. 2.5 = fires every 400ms) |
| Speed | `speed` | Movement speed in GridUnits/sec |

> **Crit Rate and Crit Damage are NOT base stats.** They exist only as individual tank passives.

### 3.2. Damage Formula
```
Raw_DMG = Skill.baseDamage + (Attacker.ATK * Skill.atkScaling)
Channel: Physical → mitigation uses target.defP
         Energy  → mitigation uses target.defE
         True    → no mitigation
Mitigation = 100 / (100 + EffectiveDEF)
Final_DMG = max(1, floor(Raw_DMG * Mitigation))
```

### 3.3. Skill Slots (3 only)
| Slot | Key | Purpose |
|------|-----|---------|
| Attack | Mouse Left (LMB) | Basic attack. Infinite ammo. Gated by `attackSpeed`. |
| Skill E | E key | Mobility/defense. Cooldown 8-15s. |
| Skill Space | Space bar | Ultimate. Cooldown 30-60s. |

### 3.4. Evolution (5 Levels = 5 Visual Tiers)
| Level | Hitbox Scale | Stat Scale | Visual |
|-------|-------------|------------|--------|
| 1 (Tier 1) | x1.00 | x1.0 | Base 3D model |
| 2 (Tier 2) | x1.05 | x1.1 | Slight mesh/material upgrade |
| 3 (Tier 3) | x1.10 | x1.25 | Major visual change. Unlock Passive. |
| 4 (Tier 4) | x1.15 | x1.4 | Upgraded model |
| 5 (Tier 5) | x1.20 | x1.6 | Final form. VFX aura particles. |

### 3.5. Tank State Machine (6 States)
`Idle → Moving → Casting → Dashing → Stunned → Dead`
- **Root and Silence** are NOT TankStates — they are StatusEffects checked at runtime.
- Only **Stun** forces a TankState change to `Stunned`.

### 3.6. Status Effects (6 Types)
`Stun | Root | Silence | Slow | Burn | Invulnerable`
- Slow: only highest % applies (anti-stacking).
- Burn: True Damage DoT (bypasses DEF).
- Invulnerable: blocks all damage + new debuffs.

### 3.7. Projectile Archetypes (7 Types)
`Linear | Piercing | Bouncing | Hitscan | Lob | Homing | Boomerang`

---

## 4. CURRENT STATE (What's Built)

### ✅ Phase 1: Foundation (COMPLETE)
- Monorepo with workspaces: shared, server
- TypeScript strict config with brand types
- All 11 shared type files

### ✅ Phase 2: Local Prototype (COMPLETE — Phaser, Legacy, Deleted)
- Phaser 3 client with Vite bundler (previously in `packages/client/`, now deleted)
- Local game simulation (`LocalGameState.ts`)
- All renderers (Map, Tank, Projectile, HUD, Dummy)

### ✅ Phase 3: Networking (COMPLETE — Infrastructure)
- **Server:** WebSocketServer (port 8080) + Room (60Hz tick) + InputBuffer
- **Client:** NetworkClient (WS, auto-reconnect, ping/pong) + ClientPrediction + EntityInterpolation
- Server runs at 60Hz, snapshots broadcast at 20Hz

### ✅ Phase 4: Match Lifecycle (COMPLETE)
- Server-side match state machine: WaitingForPlayers → Countdown → Playing → MatchEnd → loop
- Kill/death tracking, 5-second respawn, win conditions

### ✅ Phase 5: Minimap, Tank Size, Map Rework (COMPLETE)
- Collision map system, box tiles, minimap

### 🔄 Phase 6: Cocos Creator Migration (IN PROGRESS)
- Migrating client from Phaser 3 to Cocos Creator 3.8 with 3D rendering
- 3D cel-shaded tank models (Blender → .glb → Cocos)
- Orthographic top-down camera
- See `docs/ASSET_PIPELINE.md` for 3D asset workflow

---

## 5. WHAT'S NOT BUILT YET (FUTURE WORK)

| Priority | Feature | Notes |
|----------|---------|-------|
| **HIGH** | Cocos Creator client — full gameplay | Phase 6 in progress |
| MEDIUM | Game modes (TDM, Base Destroy, CTF) | See GDD §7 |
| MEDIUM | PVE mode (Co-op Dungeon) | See GDD §8 |
| LOW | Vision / Fog of War | Server-side culling per player |
| LOW | Sound effects | Cocos AudioSource component |
| LOW | Metagame / Garage | Out-match progression (see GDD §9) |

---

## 6. GRAPHICS APPROACH

> **3D Cel-Shaded with Orthographic Camera.** Tanks are low-poly 3D models with a custom cel-shaded material (stepped lighting, bold outlines). The camera is orthographic top-down for consistent gameplay. Map backgrounds remain 2D images rendered on a 3D plane.

Asset locations:
- **3D models:** `packages/client-cocos/assets/models/tanks/` (`.glb` files)
- **Textures:** `packages/client-cocos/assets/textures/` (map_bg, UI)
- **Materials:** `packages/client-cocos/assets/materials/` (cel-shade `.effect`)
- **Blender source:** `tools/blender/` (`.blend` files)

See `docs/ASSET_PIPELINE.md` for the full 3D modeling + import pipeline.

---

## 7. TANK ROSTER (4 Tanks)

All defined in `packages/server/src/data/tank-roster.ts`:

| TankId | Name | Role | Hover | HP | ATK | Speed | AS | Range | defP | defE |
|--------|------|------|-------|-----|-----|-------|----|-------|------|------|
| `IronMan` | Iron Man | Hover ADC | ✅ | 3200 | 200 | 3.5 | 2.5 | 384 | 80 | 120 |
| `Naruto` | Naruto | Melee Bruiser | ❌ | 5500 | 280 | 4.0 | 1.8 | 128 | 150 | 100 |
| `SpiderMan` | Spider-Man | Assassin Flanker | ❌ | 3000 | 220 | 4.5 | 2.0 | 256 | 60 | 80 |
| `Giong` | Thánh Gióng | Heavy Tank | ❌ | 7000 | 180 | 2.5 | 1.2 | 192 | 200 | 180 |

---

## 8. DEVELOPMENT COMMANDS

```bash
# Install all dependencies (run from root)
npm install

# Build shared types (MUST run first, generates dist/ with .d.ts)
cd packages/shared && npx tsc

# Type-check server (no emit)
npx tsc --project packages/server/tsconfig.json --noEmit

# Start game server (port 8080)
npx tsx packages/server/src/main.ts

# Open Cocos Creator client
# → Open Cocos Dashboard → Add Project → Select packages/client-cocos/
# → Click Open to launch in Cocos Creator Editor
# → Press Play button to preview in browser

# Process raw texture assets
pip install rembg
python tools/asset-gen/process_assets.py --input raw.png --output clean.png

```

---

## 9. CRITICAL RULES FOR AGENTS

1. **Always read `docs/AGENT_CONTEXT.md` first** when starting a new session.
2. **3 skill slots only:** Attack (LMB), E, Space. NO R/Q/Slot3.
3. **7 base stats only:** hp, atk, range, defP, defE, attackSpeed, speed. Crit is passive-only.
4. **Root and Silence are StatusEffects**, NOT TankStates. Only Stun changes TankState.
5. **No ammo/reload.** Attacks are infinite, gated by `attackSpeed` (attacks per second).
6. **Circle hitbox for tanks**, AABB for tiles. No `halfWidth`/`halfHeight` on tanks.
7. **5 levels = 5 visual tiers** (1:1 mapping). Each tier = different 3D model or material.
8. **Build shared first** (`cd packages/shared && npx tsc`) before type-checking server/client.
9. **Use `.js` extensions** in barrel re-exports (`index.ts`) for ESM compatibility.
10. **TypeScript strict mode** is on: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
11. **Server runs at 60Hz**, snapshots broadcast at 20Hz.
12. **Damage formula:** `Mitigation = 100 / (100 + DEF)`. NOT `1 - DEF/(DEF+CONSTANT)`.
13. **When referencing GDD:** Sections are in Vietnamese with English terms in parentheses.
14. **Cocos Creator 3D mode:** All game objects are 3D nodes. Camera is orthographic top-down. Use `cc` module for Cocos APIs.
15. **3D Tank prefab hierarchy:** TankRoot → HullMesh + TurretPivot → TurretMesh. Rotation via `Quat.fromEuler()`.
16. **UI uses Cocos UI system:** `Canvas`, `Label`, `Sprite`, `ProgressBar`, `Layout`. NOT DOM/HTML.

---

## 10. CROSS-REFERENCES

| Doc | Purpose | What's In It |
|-----|---------|-------------|
| [GDD.md](GDD.md) | Game Design Document | Full gameplay rules, modes, mechanics, boss fights, metagame |
| [ASSET_PIPELINE.md](ASSET_PIPELINE.md) | Art pipeline | 3D modeling workflow, Blender→Cocos, cel-shaded materials, map rendering |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | **Task tracker** | Detailed task breakdown, status, dependencies — pick up your next task here |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | **This file** | Architecture, current state, rules for agents |

> **Starting a new session?** After reading this file, check [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the current task list. Find the first `[ ]` task whose dependencies are all `[x]`, do that task, mark it `[x]`, and commit.
