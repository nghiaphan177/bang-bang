# 🤖 AGENT CONTEXT — Bang Bang CMM Remake

> **READ THIS FIRST.** This file is the single source of truth for any AI agent picking up this project. It describes the project architecture, current state, what has been built, what's pending, and all rules you must follow. Updated: 2026-05-20.

---

## 1. PROJECT OVERVIEW

**Name:** Bang Bang CMM Remake
**Genre:** 2D Top-down Arena Tank Shooter (think: Bullet Hell meets casual MOBA)
**Inspiration:** The original Bang Bang mobile game — fast tanks, diverse heroes, PVP arenas.

**Tech Stack:**
| Layer | Tech | Notes |
|-------|------|-------|
| Client/Rendering | Phaser 3 (WebGL) | Bundled with Vite |
| Server | Node.js + `ws` | Authoritative game loop at 60Hz |
| Shared Types | `@bang-bang/shared` | TypeScript strict, brand types |
| Networking | WebSockets | Client prediction + server reconciliation |
| Language | TypeScript strict | `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true` |

**Design Philosophy:**
- NO Energy/Mana system — combat uses Cooldowns + AttackSpeed only.
- NO in-match shops — progression via In-Match Evolution (5 levels, 5 visual tiers).
- Server-authoritative ECS. Client does prediction + interpolation.
- Circle hitbox for tanks, AABB for tiles.
- Free movement (NOT grid-locked).

---

## 2. MONOREPO STRUCTURE

```
bang-bang/
├── docs/                          # ← YOU ARE HERE
│   ├── AGENT_CONTEXT.md           # This file — read first
│   ├── GDD.md                     # Full Game Design Document (Vietnamese + English terms)
│   └── ASSET_PIPELINE.md          # AI image generation + post-processing pipeline
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
│   └── client/                    # @bang-bang/client — Phaser 3 game client
│       ├── src/
│       │   ├── main.ts            # Phaser game config + boot
│       │   ├── scenes/
│       │   │   ├── BootScene.ts   # Asset preloading
│       │   │   └── GameScene.ts   # Main gameplay scene (dual-mode: local + online)
│       │   ├── game/
│       │   │   ├── LocalGameState.ts  # Offline test simulation
│       │   │   └── OnlineGameState.ts # Online multiplayer state manager
│       │   ├── input/
│       │   │   └── InputManager.ts    # WASD + mouse input
│       │   ├── rendering/
│       │   │   ├── MapRenderer.ts       # Tilemap rendering
│       │   │   ├── TankRenderer.ts      # Hull + turret sprite rendering
│       │   │   ├── ProjectileRenderer.ts
│       │   │   ├── DummyRenderer.ts     # Dummy target rendering
│       │   │   └── HUD.ts              # HP bar, cooldowns, minimap
│       │   └── network/
│       │       ├── NetworkClient.ts       # WebSocket client + auto-reconnect
│       │       ├── ClientPrediction.ts    # Optimistic local movement + reconciliation
│       │       └── EntityInterpolation.ts # Remote entity position smoothing
│       └── package.json           # deps: phaser, vite
│
├── tools/asset-gen/               # Python pipeline for asset processing
│   └── process_tanks.py           # rembg + OpenCV defringing
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
| 1 (Tier 1) | x1.00 | x1.0 | Base sprite |
| 2 (Tier 2) | x1.05 | x1.1 | Slight upgrade |
| 3 (Tier 3) | x1.10 | x1.25 | Major visual change. Unlock Passive. |
| 4 (Tier 4) | x1.15 | x1.4 | Upgraded sprite |
| 5 (Tier 5) | x1.20 | x1.6 | Final form. VFX aura. |

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
- Monorepo with workspaces: shared, server, client
- TypeScript strict config with brand types
- All 11 shared type files

### ✅ Phase 2: Local Prototype (COMPLETE)
- Phaser 3 client with Vite bundler
- Local game simulation (`LocalGameState.ts`)
- All renderers (Map, Tank, Projectile, HUD, Dummy)
- Input system (WASD + mouse)
- BootScene → GameScene flow

### ✅ Phase 3A: Type Alignment (COMPLETE)
- All types corrected per user feedback (3 skills, 7 stats, no shield/level/exp in snapshot)
- All server ECS systems rewritten: Movement, Collision, Combat, Projectile, StatusEffect
- All 3 packages compile clean with `tsc --noEmit`

### ✅ Phase 3B: Networking (COMPLETE — INFRASTRUCTURE)
- **Server:** WebSocketServer (port 8080) + Room (60Hz tick) + InputBuffer
- **Client:** NetworkClient (WS, auto-reconnect, ping/pong) + ClientPrediction + EntityInterpolation
- Server starts with `npx tsx packages/server/src/main.ts`
- Client starts with `npm run dev` in packages/client (Vite on :5173)

### ✅ Phase 3C: Wire Online Mode (COMPLETE)
- GameScene dual-mode: auto-detects server → online (prediction+interpolation) or local fallback
- `OnlineGameState.ts` wraps NetworkClient + ClientPrediction + EntityInterpolation
- Server Room spawns projectiles on `input.fire` (fire-rate-gated via AttackTimingComponent)
- WebSocketServer has CORS headers + `/info` endpoint for server probe
- HUD shows network status (ping, player count, mode indicator)
- All 3 packages compile clean

### ✅ Phase 4: Match Lifecycle (COMPLETE)
- Server-side match state machine: WaitingForPlayers → Countdown (3s) → Playing → MatchEnd (8s) → loop
- Kill/death tracking with per-player and per-team counters
- 5-second respawn with teleport + full heal
- Win conditions: first team to 10 kills or 5-minute time limit
- MatchState included in every snapshot broadcast
- Client `MatchOverlay.ts`: countdown animation, match timer, team scores, results screen
- All 3 packages compile clean

### ✅ Phase 5: Minimap, Tank Size, Map Rework (COMPLETE)
- Tank size increased 1.5× (HULL 40→60, TURRET 14×36→21×54)
- Map reduced from 80×60 to 40×30 grid (1280×960 px playable area)
- map_bg.png extends 64px beyond grid on each side for visual clarity
- Arctic theme set as default for both local and online modes
- New tile types: SteelBox (indestructible) and WoodBox (destructible, 400 HP)
- Collision map system: ASCII grid in shared/data → parsed by collision-map-loader.ts
- MapRenderer renders only box sprites on top of static map_bg.png
- Minimap: 160×120 px in bottom-left, terrain structure from collision grid, entity dots, camera viewport rect
- Box collision handling in both server (CollisionSystem, ProjectileSystem) and client (LocalGameState)
- All 3 packages compile clean

---

## 5. WHAT'S NOT BUILT YET (FUTURE WORK)

| Priority | Feature | Notes |
|----------|---------|-------|
| ~~HIGH~~ | ~~Wire GameScene → NetworkClient~~ | ✅ Done in Phase 3C |
| ~~HIGH~~ | ~~Server-side projectile spawning~~ | ✅ Done in Phase 3C |
| ~~MEDIUM~~ | ~~Match lifecycle~~ | ✅ Done in Phase 4 |
| ~~LOW~~ | ~~Minimap~~ | ✅ Done in Phase 5 |
| MEDIUM | Game modes (TDM, Base Destroy, CTF) | See GDD §7 |
| MEDIUM | PVE mode (Co-op Dungeon) | See GDD §8 |
| LOW | Vision / Fog of War | Server-side culling per player |
| LOW | Sound effects | Phaser audio system |
| LOW | Metagame / Garage | Out-match progression (see GDD §9) |

---

## 6. GRAPHICS STATUS

> ⚠️ **Current graphics are placeholder quality.** The user explicitly stated they will redo all graphics later. Do NOT spend time improving visuals unless the user asks. Focus on logic, networking, and gameplay. See `docs/ASSET_PIPELINE.md` for the image generation + processing pipeline when graphics work begins.

Current asset location: `packages/client/public/assets/`
- Tank sprites: AI-generated, need rework to match original Bang Bang aesthetic (2.5D isometric feel, not flat top-down)
- Tile sprites: AI-generated, functional but not polished

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

# Type-check client (no emit)
npx tsc --project packages/client/tsconfig.json --noEmit

# Start game server (port 8080)
npx tsx packages/server/src/main.ts

# Start client dev server (port 5173)
cd packages/client && npm run dev

# Process raw assets (Python)
cd tools/asset-gen && python process_tanks.py --input ./raw_assets/ --output ./clean_assets/
```

---

## 9. CRITICAL RULES FOR AGENTS

1. **Always read `docs/AGENT_CONTEXT.md` first** when starting a new session.
2. **3 skill slots only:** Attack (LMB), E, Space. NO R/Q/Slot3.
3. **7 base stats only:** hp, atk, range, defP, defE, attackSpeed, speed. Crit is passive-only.
4. **Root and Silence are StatusEffects**, NOT TankStates. Only Stun changes TankState.
5. **No ammo/reload.** Attacks are infinite, gated by `attackSpeed` (attacks per second).
6. **Circle hitbox for tanks**, AABB for tiles. No `halfWidth`/`halfHeight` on tanks.
7. **5 levels = 5 visual tiers** (1:1 mapping). Hitbox grows each level.
8. **Don't touch graphics** unless explicitly asked. Current visuals are placeholders.
9. **Build shared first** (`cd packages/shared && npx tsc`) before type-checking server/client.
10. **Use `.js` extensions** in barrel re-exports (`index.ts`) for Vite ESM compatibility.
11. **TypeScript strict mode** is on: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`. Don't use `undefined` where only `number` is expected.
12. **Server runs at 60Hz**, snapshots broadcast at 20Hz.
13. **Damage formula:** `Mitigation = 100 / (100 + DEF)`. NOT `1 - DEF/(DEF+CONSTANT)`.
14. **When referencing GDD:** Sections are in Vietnamese with English terms in parentheses. Use the section numbers (§1, §2, etc.) for cross-references.
15. **Image-Based UI Only:** Do NOT use HTML/CSS DOM elements for in-game UI. Avoid using raw `Phaser.GameObjects.Graphics` for main UI shapes. All HUD elements (HP bars, Skill slots, Panels) MUST use Phaser Sprites, Image `.setCrop()` for progress bars, or Phaser 3's `NineSlice` for scalable panels. Use stylized Canvas Text with thick strokes and drop-shadows.


---

## 10. CROSS-REFERENCES

| Doc | Purpose | What's In It |
|-----|---------|-------------|
| [GDD.md](GDD.md) | Game Design Document | Full gameplay rules, modes, mechanics, boss fights, metagame |
| [ASSET_PIPELINE.md](ASSET_PIPELINE.md) | Art pipeline | AI prompt templates, Python background-removal script, Phaser pivot rules |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | **This file** | Architecture, current state, rules for agents |
