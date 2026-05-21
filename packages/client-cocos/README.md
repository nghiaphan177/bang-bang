# @bang-bang/client-cocos

Cocos Creator 3.8 LTS client for Bang Bang CMM Remake.

## Setup

1. Download and install [Cocos Dashboard](https://www.cocos.com/en/creator-download)
2. Install **Cocos Creator 3.8.x LTS** via the Dashboard
3. In Dashboard → **New Project** → Select **3D Empty** template
4. Set project path to this directory: `packages/client-cocos/`
5. Click **Create** to initialize the Cocos project

> **IMPORTANT:** The Cocos Creator project must be created through the Dashboard/Editor.
> It generates internal files (`.meta`, `settings/`, `native/`, etc.) that cannot be created manually.

## After Cocos Creates the Project

Once the project is created, the agent will:
1. Copy network scripts (NetworkClient, ClientPrediction, EntityInterpolation) into `assets/scripts/network/`
2. Create game logic components in `assets/scripts/game/`
3. Create rendering controllers in `assets/scripts/rendering/`
4. Create UI controllers in `assets/scripts/ui/`
5. Set up scene hierarchy in `assets/scenes/`

## 3D Assets

Import 3D models:
1. Model in Blender (`tools/blender/`)
2. Export as `.glb` (see `docs/ASSET_PIPELINE.md` §3)
3. Copy `.glb` files to `assets/models/tanks/`
4. Cocos auto-imports on Editor refresh
