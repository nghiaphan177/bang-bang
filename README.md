# 💥 Bang Bang CMM Remake

A modern 2D top-down arena tank shooter remake inspired by the classic *Bang Bang* mobile game. Built from the ground up as a server-authoritative monorepo with high-performance real-time physics, dual-mode client support (offline local simulation and online WebSocket multiplayer), and in-match evolution systems.

---

## 🎮 Core Gameplay & Philosophy

- **Twin-Stick Action:** Independent hull movement (WASD) and turret rotation/kiting (Mouse pointer coordinates).
- **Cooldown-Driven Combat:** No mana or energy systems. All combat flow is governed strictly by ability cooldowns and attack speed.
- **In-Match Evolution:** Tanks grow in size, stats, and visual tiers (Levels 1 to 5) directly in the arena.
- **Server-Authoritative Physics & Netcode:** Custom Arcade Physics (circular colliders for tanks, AABB for environment tiles) resolved on a 60Hz server tick with client-side input prediction and remote entity interpolation.

---

## 🏗️ Monorepo Architecture

This project is organized as a pnpm/npm monorepo consisting of the following modules:

```
bang-bang/
├── docs/                       # Design & developer specifications
│   ├── AGENT_CONTEXT.md        # AI Agent context and rules (Single Source of Truth)
│   ├── GDD.md                  # Master Game Design Document
│   └── ASSET_PIPELINE.md       # Asset generation and processing workflow
├── packages/
│   ├── shared/                 # @bang-bang/shared — TypeScript types & environment schemas
│   ├── server/                 # @bang-bang/server — 60Hz WebSocket authoritative game server
│   └── client/                 # @bang-bang/client — Phaser 3 web client powered by Vite
└── tools/                      # Supporting development scripts (e.g. Asset Preprocessing)
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

### 4. Start the Client
Runs the Phaser 3 client with Vite's development server (opens at `http://localhost:5173`):
```bash
cd packages/client
npm run dev
```

---

## 🛠️ Verification & Development Commands

- **Type-Check Server:**
  ```bash
  npx tsc --project packages/server/tsconfig.json --noEmit
  ```
- **Type-Check Client:**
  ```bash
  npx tsc --project packages/client/tsconfig.json --noEmit
  ```
- **Asset Processing (Python):**
  If you are adding new raw tank assets, run the deflection and defringing tool:
  ```bash
  cd tools/asset-gen
  python process_assets.py --input ./raw_assets/ --output ./clean_assets/
  ```

---

## 📝 Developer Guidelines

Please refer to the following documents for comprehensive details:
- **Architecture rules, coding guidelines, and status checklist:** [AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md)
- **Detailed game mechanics, formula specifications, and states:** [GDD.md](docs/GDD.md)
- **Asset guidelines:** [ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md)
