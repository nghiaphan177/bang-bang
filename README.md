# 💥 Bang Bang CMM Remake

A modern 2D top-down arena tank shooter remake inspired by the classic *Bang Bang* mobile game. Built from the ground up as a server-authoritative monorepo with high-performance real-time physics, dual-mode client support (offline local simulation and online WebSocket multiplayer), and in-match evolution systems.

**Client:** Cocos Creator 3.8 LTS — 3D cel-shaded tanks with orthographic top-down camera.

---

## 🎮 Core Gameplay & Philosophy

- **Twin-Stick Action:** Independent hull movement (WASD) and turret rotation/kiting (Mouse pointer coordinates).
- **Cooldown-Driven Combat:** No mana or energy systems. All combat flow is governed strictly by ability cooldowns and attack speed.
- **In-Match Evolution:** Tanks grow in size, stats, and visual tiers (Levels 1 to 5) directly in the arena.
- **Server-Authoritative Physics & Netcode:** Custom Arcade Physics (circular colliders for tanks, AABB for environment tiles) resolved on a 60Hz server tick with client-side input prediction and remote entity interpolation.
- **3D Cel-Shaded Rendering:** Low-poly tanks modeled in Blender, rendered with custom cel-shading shader in Cocos Creator.

---

## 🏗️ Monorepo Architecture

This project is organized as an npm monorepo consisting of the following modules:

```
bang-bang/
├── docs/                           # Design & developer specifications
│   ├── AGENT_CONTEXT.md            # AI Agent context and rules (Single Source of Truth)
│   ├── GDD.md                      # Master Game Design Document
│   └── ASSET_PIPELINE.md           # 3D asset generation + Blender→Cocos pipeline
├── packages/
│   ├── shared/                     # @bang-bang/shared — TypeScript types & environment schemas
│   ├── server/                     # @bang-bang/server — 60Hz WebSocket authoritative game server
│   ├── client/                     # LEGACY — Old Phaser 3 client (preserved for reference)
│   └── client-cocos/               # @bang-bang/client-cocos — Cocos Creator 3.8 (3D)
├── tools/
│   ├── asset-gen/                  # Asset processing scripts (rembg background removal)
│   └── blender/                    # Blender source files for 3D tank models
└── tsconfig.base.json
```

---

## 🚀 Getting Started

### 1. Install Dependencies
Run the install command from the workspace root:
```bash
npm install
```

### 2. Build Shared Types
The client and server packages both rely on `@bang-bang/shared`. You **must** compile it first:
```bash
cd packages/shared
npm run build   # or npx tsc
```

### 3. Start the Game Server
Runs the authoritative WebSocket game server (listens on port `8080`):
```bash
npx tsx packages/server/src/main.ts
```

### 4. Open the Cocos Creator Client
1. Download and install [Cocos Dashboard](https://www.cocos.com/en/creator-download)
2. Install **Cocos Creator 3.8.x LTS** via the Dashboard
3. In Dashboard → **Add Project** → Select `packages/client-cocos/`
4. Click **Open** to launch in Cocos Creator Editor
5. Press the **Play** button (▶) to preview in browser

### 5. Legacy Phaser Client (Reference Only)
The old Phaser 3 client is preserved in `packages/client/`:
```bash
cd packages/client
npm run dev   # Opens at http://localhost:5173
```

---

## 🛠️ Verification & Development Commands

- **Type-Check Server:**
  ```bash
  npx tsc --project packages/server/tsconfig.json --noEmit
  ```
- **Process Raw Assets (Background Removal):**
  ```bash
  pip install rembg
  rembg i input.png output.png
  ```
- **3D Model Pipeline:**
  1. Model in Blender (`tools/blender/`)
  2. Export as `.glb` (glTF Binary)
  3. Copy to `packages/client-cocos/assets/models/tanks/`
  4. Cocos auto-imports on next Editor refresh

---

## 📝 Developer Guidelines

Please refer to the following documents for comprehensive details:
- **Architecture rules, coding guidelines, and status checklist:** [AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md)
- **Detailed game mechanics, formula specifications, and states:** [GDD.md](docs/GDD.md)
- **3D asset pipeline & Blender workflow:** [ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md)
