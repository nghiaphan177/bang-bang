# ASSET PIPELINE — Bang Bang Remake

> **Audience:** AI coding agents (Cocos Creator 3.8 / TypeScript / Blender). Follow all rules exactly.

---

## 1. Rendering Architecture

The game uses **3D rendering with an orthographic top-down camera**. Tanks and obstacles are low-poly 3D meshes with cel-shaded materials. Map backgrounds are 2D images rendered on flat 3D planes.

| Element | Rendering Approach |
|---------|-------------------|
| **Tanks** | 3D meshes (hull + turret), cel-shaded material with outline |
| **Projectiles** | 3D meshes with emissive/glow materials |
| **Map Background** | 2D image on a 3D plane (quad mesh) |
| **Box Obstacles** | 3D cube meshes with PBR or cel-shaded materials |
| **Particles/VFX** | Cocos 3D ParticleSystem (muzzle flash, explosions, dust) |
| **UI/HUD** | Cocos 2D Canvas overlay (ProgressBar, Label, Sprite) |
| **Camera** | Orthographic, looking straight down (-Y axis) |

---

## 2. AI Image Generation Prompts (for textures & concept art)

These prompts are engine-agnostic and used for generating concept art, texture references, and 2D map backgrounds.

### 2.1. Lobby/Garage View (2.5D Concept Art)
Used for reference when modeling 3D tanks in Blender.

```text
Clean 2.5D angled game asset, 2010s Flash webgame style. Cel-shaded, vibrant saturated colors. Isometric/three-quarter view showing the top and front-side face for three-dimensional depth. Bold, clean, simplified shapes with no tiny micro-details. THICK, BOLD, CONTINUOUS BLACK OUTLINES around all features. Pronounced shading and cast highlights to emphasize volume. ABSOLUTELY NO GROUND CAST SHADOWS. Isolated on a #FFFFFF pure flat white background.
```

### 2.2. Map Background (`map_bg.png`)
```text
2D top-down game map background, sci-fi metallic arena battlefield, 2010s Flash webgame style. Cel-shaded, vibrant saturated colors. Strictly 90-degree flat top-down view (viewed from directly above, sky camera). Detailed metallic grid tiles, dirty paths, mechanical structures, glowing power lines, sci-fi details, high contrast. No characters or entities. Seamless flat plane. High quality, premium design.
```

### 2.3. Texture References for 3D Models
When generating texture sheets for Blender models:
```text
Clean flat texture sheet for a low-poly tank model, [Character Motif] themed. Vibrant saturated [Color Schema] metallic colors. Flat projection, no perspective. Bold color blocks suitable for UV mapping. No gradients, use 2-3 flat shading bands. High contrast between light and shadow areas.
```

---

## 3. 3D Model Pipeline (Blender → Cocos Creator)

### 3.1. Modeling Rules (Blender)

Each tank is modeled as **2 separate objects** in a single `.blend` file:

| Object | Name Convention | Poly Budget | Origin Point |
|--------|----------------|-------------|-------------|
| **Hull** | `hull_[tankId]` | 300-800 tris | Center of hull (geometric center) |
| **Turret** | `turret_[tankId]` | 200-500 tris | Barrel mount point (where turret sits on hull) |

**Modeling guidelines:**
- **Low-poly cel-shaded style** — simplified shapes, no micro-details
- **Orientation:** Model facing **+Y** (forward/north) in Blender. Turret barrel points **+Y**.
- **Scale:** 1 Blender unit = 1 game unit. Hull should be approximately 1.5-2 units wide.
- **Separate objects:** Hull and Turret MUST be separate objects (not joined) for independent rotation in-game.
- **Clean topology:** No n-gons, no isolated vertices. Manifold meshes preferred.
- **UV unwrapped:** Simple UV layout for texture painting. Use color-ID maps if needed.

### 3.2. Material Setup (Cocos Creator)

Tanks use a **custom cel-shaded Effect** (`.effect` file) in Cocos Creator:

```
Cel-Shade Material Properties:
├── Base Color (diffuse texture or flat color)
├── Shadow Color (darker version, 2-3 step threshold)
├── Outline Width (inverted-hull method, 1-3px screen-space)
├── Outline Color (usually black or very dark version of base)
└── Specular Band (optional: single bright highlight step)
```

**Outline method:** Inverted-hull (duplicate mesh, flip normals, scale slightly outward, render back-faces only with solid outline color). This is the standard cel-shading outline for real-time 3D games.

### 3.3. Export Settings (Blender → .glb)

```
File → Export → glTF 2.0 (.glb)
├── Format: glTF Binary (.glb)
├── Include: Selected Objects only
├── Transform:
│   ├── +Y Up (default)
│   └── Apply Modifiers: ✅
├── Mesh:
│   ├── Apply Modifiers: ✅
│   ├── Normals: ✅
│   ├── UVs: ✅
│   └── Vertex Colors: ✅ (if used for color-ID)
├── Materials: Export (for reference, will be replaced in Cocos)
└── Animation: None (static meshes for now)
```

### 3.4. Import into Cocos Creator

1. Copy `.glb` files to `packages/client-cocos/assets/models/tanks/`
2. Cocos auto-generates `.meta` files and creates `Mesh`, `Material`, `Prefab` assets
3. In Cocos Editor:
   - Create new **Prefab** for the tank
   - Add HullMesh as child node with `MeshRenderer` component
   - Add TurretPivot (empty Node) at mount point position
   - Add TurretMesh as child of TurretPivot with `MeshRenderer`
   - Assign cel-shaded material to both MeshRenderers
   - Attach `TankController` script to root node

### 3.5. Tank Prefab Hierarchy

```
TankRoot (Node3D) — TankController.ts component
├── HullMesh (MeshRenderer + CelShadeMaterial)
│   └── DustEmitter (ParticleSystem — emits when moving)
├── TurretPivot (empty Node3D, position = hull mount point)
│   ├── TurretMesh (MeshRenderer + CelShadeMaterial)
│   └── MuzzlePoint (empty Node3D — particle spawn point)
│       └── MuzzleFlash (ParticleSystem — burst on fire)
├── Shadow (Sprite3D or projected shadow plane)
└── HPBarAnchor (empty Node3D — world-space anchor for billboard HP bar)
```

### 3.6. Evolution Tiers (5 Visual Levels)

| Tier | 3D Model Change | Material Change |
|------|----------------|-----------------|
| Tier 1 | Base model | Base cel-shade colors |
| Tier 2 | Same model, scale x1.05 | Slightly upgraded colors |
| Tier 3 | New model (more detail) | New color palette, unlock passive VFX |
| Tier 4 | Same as Tier 3, scale x1.10 | Premium metallic accents |
| Tier 5 | Final model (most detail) | Glowing aura particles, emissive accents |

---

## 4. 2D Texture Pipeline (Map Backgrounds & UI)

### 4.1. Background Removal

For 2D textures that need background removal (concept art, AI-generated images):

```bash
# Install rembg (one-time)
pip install rembg[gpu]  # GPU-accelerated, or just `pip install rembg`

# Remove background
rembg i input.png output.png

# Batch process
rembg p input_folder/ output_folder/
```

The old Python BFS flood-fill script (`process_assets.py`) is replaced by `rembg` which uses a neural network for much higher quality background removal.

### 4.2. Map Background Images

Map backgrounds are still 2D images, rendered on a flat 3D plane in the game world:

1. Generate or paint `map_bg.png` (recommended: 2048x2048 or 4096x4096 for high quality)
2. Place in `packages/client-cocos/assets/textures/maps/<theme>/map_bg.png`
3. In Cocos Editor: Create a `Plane` mesh at Y=0, apply `map_bg.png` as diffuse texture
4. Scale plane to match grid dimensions (e.g., 40×30 grid × 32px/tile = 1280×960 world units)

### 4.3. UI Assets

All HUD/UI is built using Cocos Creator's 2D UI system (Canvas overlay):

- **ProgressBar** component for HP bars and skill cooldowns (built-in!)
- **Sprite** with `fillRange` for radial cooldown indicators
- **Label** with custom fonts (import `.ttf` or `.otf` into Cocos)
- **Layout** component for auto-arranging UI elements
- **Widget** component for screen-edge anchoring
- **NineSlice** (Sprite with sliced mode) for scalable panel backgrounds

No procedural Canvas Graphics code needed — design everything visually in Cocos Editor.

---

## 5. Environment 3D Assets

### 5.1. Box Obstacles

| Box Type | Mesh | Material | Notes |
|----------|------|----------|-------|
| **SteelBox** | Simple cube (8 tris) | Dark metallic with rivets normal map | Indestructible |
| **WoodBox** | Simple cube (8 tris) | Wood diffuse texture | Destructible (400 HP), shows damage states |
| **Rubble** | 3-5 small irregular shapes | Dark brown, semi-transparent | Spawned when WoodBox destroyed |

### 5.2. Water & Bush Tiles

| Tile | Approach |
|------|----------|
| **Water** | Plane mesh with animated UV-scrolling water shader |
| **Bush** | Billboard sprites or low-poly foliage mesh clusters |

---

## 6. Directory Structure

```
bang-bang/
├── tools/
│   ├── asset-gen/
│   │   └── process_assets.py          # rembg-based background removal
│   └── blender/                       # Blender source files
│       ├── ironman.blend
│       ├── naruto.blend
│       ├── spiderman.blend
│       ├── thanhgiong.blend
│       └── environment.blend          # Shared box/obstacle meshes
│
└── packages/client-cocos/assets/      # Cocos Creator asset directory
    ├── models/
    │   ├── tanks/
    │   │   ├── ironman_hull.glb
    │   │   ├── ironman_turret.glb
    │   │   ├── naruto_hull.glb
    │   │   └── ...
    │   ├── environment/
    │   │   ├── steel_box.glb
    │   │   ├── wood_box.glb
    │   │   └── rubble.glb
    │   └── projectiles/
    │       ├── beam.glb
    │       └── ...
    ├── textures/
    │   ├── maps/
    │   │   ├── default/map_bg.png
    │   │   └── arctic/map_bg.png
    │   ├── tanks/                     # Diffuse textures for tank models
    │   └── ui/                        # UI sprite sheets
    ├── materials/
    │   ├── cel-shade.mtl              # Cel-shaded material instance
    │   └── outline.mtl                # Outline pass material
    ├── effects/
    │   └── cel-shade.effect           # Custom cel-shade shader
    ├── prefabs/
    │   ├── tanks/
    │   │   ├── IronMan.prefab
    │   │   ├── Naruto.prefab
    │   │   └── ...
    │   ├── Projectile.prefab
    │   └── ui/
    │       ├── HealthBar.prefab
    │       └── SkillSlot.prefab
    └── scenes/
        ├── Boot.scene
        ├── Game.scene
        └── Lobby.scene
```

---

## 7. Map Rendering Architecture (3D Plane + Collision Matrix)

### Core Concept
The map visual and the map collision remain **completely separate** (same as before):

| Layer | Responsibility |
|-------|---------------|
| **Client (MapController)** | Renders a 3D Plane with `map_bg.png` texture. Box obstacles are 3D cube meshes placed at grid positions on top of the plane. |
| **Server / GameState** | Maintains a hidden **collision matrix** (`map.tiles[][]`) — a 2D grid for movement blocking, projectile collision, stealth. |

### How It Works
1. The AI generates a beautiful unified map image (top-down view)
2. The collision matrix is defined in code (`shared/src/data/`)
3. MapController creates a Plane mesh, applies texture, scales to grid dimensions
4. Box obstacles are instantiated as 3D cube prefabs at grid coordinates
5. When a WoodBox is destroyed: remove mesh, spawn rubble particles

### Adding a New Map
1. Create `packages/client-cocos/assets/textures/maps/<theme>/map_bg.png`
2. Add a collision matrix in `packages/shared/src/data/`
3. Register the theme in `MapController.ts`