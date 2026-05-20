# ASSET PIPELINE — Bang Bang Remake

> **Audience:** AI coding agents (Phaser 3 / TypeScript). Follow all rules exactly.

---

## 1. Dual-Perspective Visual Split

To replicate the authentic premium feel of Bang Bang, the game operates on a two-perspective architectural model:
1. **Lobby/Garage View:** Tanks are shown in a **2.5D Angled (60-degree)** perspective to showcase maximum character detail and metallic volume.
2. **In-Game Gameplay View:** The game runs in a **Strictly 90-degree Flat Top-Down** camera angle from the sky. Background tiles are replaced with a continuous artistic map (`map_art.png`), and tanks/projectiles use clean, flat, top-down 90-degree sprites.

---

## 2. Lobby/Garage Assets (2.5D Angled 60-degree)

Lobby assets use a three-quarter isometric projection showing the top and front-side face for three-dimensional depth.

### 2.1. Master Lobby Style Prompt
```text
Clean 2.5D angled game asset, 2010s Flash webgame style. Cel-shaded, vibrant saturated colors. Isometric/three-quarter view showing the top and front-side face for three-dimensional depth. Bold, clean, simplified shapes with no tiny micro-details. THICK, BOLD, CONTINUOUS BLACK OUTLINES around all features. Pronounced shading and cast highlights to emphasize volume. ABSOLUTELY NO GROUND CAST SHADOWS. Isolated on a #FFFFFF pure flat white background.
```

### 2.2. Lobby Hull
```text
[Master Lobby Style Prompt], a heavy 2.5D tank base hull inspired by [Character Motif]. Saturated metallic armor plating, bold treads on the sides, mechanical details on top. Angled isometric view showing side and front depth.
```

### 2.3. Lobby Turret
```text
[Master Lobby Style Prompt], a detached 2.5D tank turret with a weapon barrel inspired by [Character Motif]. The barrel MUST point directly upwards (12 o'clock / North) in perspective. Saturated colors. Angled view showing the base of the turret clearly.
```

---

## 3. In-Game Gameplay Assets (Flat 90-degree Top-Down)

In-game assets are projected from directly above (sky camera perspective) with no side faces showing.

### 3.1. Master In-Game Style Prompt
```text
Clean top-down game asset, 2010s Flash webgame style. Cel-shaded, vibrant saturated colors. Strictly 90-degree flat top-down view (from directly above, sky camera). Bold, clean, simplified shapes with no tiny micro-details. THICK, BOLD, CONTINUOUS BLACK OUTLINES around all features. Pronounced shading and beveled edge highlights to emphasize volume. ABSOLUTELY NO GROUND CAST SHADOWS. Isolated on a #FFFFFF pure flat white background.
```

### 3.2. Gameplay Hull
```text
[Master In-Game Style Prompt]. A heavy tank base hull inspired by [Character Motif], with saturated [Color Schema] metallic armor plating, and bold tracks on the sides.
```

### 3.3. Gameplay Turret
```text
[Master In-Game Style Prompt]. A detached mechanical tank turret with a weapon barrel, colored [Color Schema]. The barrel MUST point directly upwards (12 o'clock / North) in perspective.
```

### 3.4. Specific Projectiles
```text
Clean top-down game asset, 2010s Flash webgame style. Cel-shaded, vibrant saturated colors. Strictly 90-degree flat top-down view (from directly above, sky camera). Bold, clean, simplified shapes. THICK, BOLD, CONTINUOUS BLACK OUTLINES. [Projectile description, e.g., glowing energy repulsor plasma bolt, wind chakra shuriken, web ball, bamboo rod]. Isolated on a #FFFFFF pure flat white background.
```

### 3.5. Map Art Background (`map_art.png`)
```text
2D top-down game map background, sci-fi metallic arena battlefield, 2010s Flash webgame style. Cel-shaded, vibrant saturated colors. Strictly 90-degree flat top-down view (viewed from directly above, sky camera). Detailed metallic grid tiles, dirty paths, mechanical structures, glowing power lines, sci-fi details, high contrast. No characters or entities. Seamless flat plane. High quality, premium design.
```

---

## 4. Grid Environment Tiles
> Tiles = square tiles representing map grid obstacle elements (Walls/Bushes) laid on top of the map background.

```text
[Master In-Game Style Prompt], a game map block of [a green stealth bush / a destructible red clay brick wall / a steel block], showing a top-down view. Clean cartoon texture.
```

---

## 3. Post-Processing: Background Removal & Scaling (Python)

To remove white anti-aliasing halos and prepare images for Phaser, we use `tools/asset-gen/process_assets.py`. This script performs:
1. **BFS Flood-Fill Background Removal:** Cleans flat white `#FFFFFF` backgrounds starting from the corners, preserving internal highlight white pixels.
2. **Auto-Cropping:** Trims empty transparent border pixels to fit bounds.
3. **Square Padding:** Adds transparent padding to make the image square (essential to prevent off-center wobbles during rotation).
4. **Lanczos Downsampling:** Resizes cleanly to target resolution (128x128 for tanks, 64x64 for tiles) to prevent blur.

### 3.1. Setup & Usage

Ensure `Pillow` is installed:
```bash
pip install pillow
```

Run the processor script:
```bash
# Process a tank hull
python tools/asset-gen/process_assets.py --input raw_hulls/ironman.png --output packages/client/public/assets/hulls/ironman.png --size 128 --tolerance 35

# Process a tile block (e.g. brick wall)
python tools/asset-gen/process_assets.py --input raw_tiles/brick.png --output packages/client/public/assets/tiles/brick.png --size 64 --tolerance 30
```

---

## 4. UI & HUD Assets Pipeline

All HUD overlays, slots, and panels must be image-based and rendered inside the Phaser Canvas.

### 4.1. Prompts for UI Assets

1. **Master UI Prompt:** "2012 Flash webgame UI element, sci-fi mechanical style. Chunky, heavy metallic borders with glowing accents, glossy beveled edges, high contrast. Isolated on pure white background. Flat projection. Thick black outlines."
2. **Skill Slot Frame:** "[Master UI Prompt], a square empty frame to hold a skill icon. Thick bolted borders, dark hollow center."
3. **HP Bar Frame:** "[Master UI Prompt], a long horizontal metallic empty casing for a health bar. Thick borders."
4. **HP Bar Fill:** "[Master UI Prompt], a glassy, glowing [green/yellow/red] horizontal progress bar fill. Beveled edges, specular highlights, looking like liquid in a tube."
5. **HUD Panels:** "[Master UI Prompt], a rectangular sci-fi screen panel background with bolted corners. Perfect for 9-slice scaling."

### 4.2. Phaser Integration Rules
- **Progress Bars:** DO NOT use `.setScaleX()` (it squishes details and bevels). Instead, use `fill.setCrop(0, 0, originalWidth * ratio, originalHeight)` to deplete the bar dynamically like liquid in a tube.
- **HUD Layout Panels:** Use Phaser 3's `NineSlice` Game Object with the `ui_hud_panel` texture to scale panel backgrounds to any size without stretching the bolted corners.
- **Procedural Fallback:** `packages/client/src/scenes/BootScene.ts` contains `generateUIFallbacks()` to procedurally generate all UI assets as a fallback using Canvas Graphics to prevent load failures.
- **Typography:** Avoid default sans-serif fonts. Use stylized impact fonts with outlines and drop-shadows:
  ```typescript
  scene.add.text(x, y, text, {
    fontFamily: 'Impact, Arial Black',
    fontSize: '14px',
    color: '#FFFFFF',
    stroke: '#000000',
    strokeThickness: 4,
    shadow: { offsetX: 2, offsetY: 2, color: '#000000', stroke: true, fill: true }
  });
  ```

---

## 5. Phaser 3 Pivot Alignment Rules

When integrating a tank into Phaser, these origin values are **mandatory**:

| Part | `setOrigin()` | Why |
|------|--------------|-----|
| **Hull** | `(0.5, 0.5)` | Rotates around center |
| **Turret** | `(0.5, 0.80)` | Rotates around barrel base (mount point on hull). Adjust Y between 0.80–0.85 per barrel length |

---

## 6. Directory Structure

```
bang-bang/
├── docs/                           # Documentation
│   ├── ASSET_PIPELINE.md
│   └── AGENT_CONTEXT.md
├── tools/asset-gen/                # Python pipeline scripts
│   └── process_assets.py
└── packages/client/public/assets/  # Final processed game assets
    ├── hulls/                      # Transparent 128x128 top-down tank hulls (gameplay)
    ├── turrets/                    # Transparent 128x128 top-down tank turrets (gameplay)
    ├── projectiles/                # Transparent 32x32 projectile sprites
    ├── lobby/                      # Angled 2.5D assets for garage/lobby
    │   ├── hulls/
    │   └── turrets/
    └── maps/                       # Per-map static background images
        ├── default/
        │   └── map_bg.png          # Full-map unified static background (1024x1024+)
        └── arctic/
            └── map_bg.png          # Arctic Polar themed background
```

## 7. Map Rendering Architecture (Static Image + Collision Matrix)

### Core Concept
The map visual and the map collision are **completely separate**:

| Layer | Responsibility |
|-------|---------------|
| **Client (MapRenderer)** | Renders ONE static image as the entire map background. No tile sprites. Walls, water, bushes are all baked into the image. |
| **Server / LocalGameState** | Maintains a hidden **collision matrix** (`map.tiles[][]`) — a 2D grid where each cell is Ground, BrickWall, SteelWall, Water, or Bush. This drives movement blocking, projectile collision, stealth, etc. |

### How It Works
1. The AI generates a beautiful unified map image with walls, rivers, bushes visible
2. The collision matrix is defined separately in code (e.g. `maps.ts`)
3. Client stretches the image to fit the map dimensions
4. When a brick wall is destroyed, a small rubble overlay is placed at that grid cell

### Adding a New Map
1. Create `packages/client/public/assets/maps/<theme_name>/map_bg.png`
2. Add a collision matrix in `packages/server/src/data/maps.ts`
3. Add the theme key to `THEME_BG` in `MapRenderer.ts`
4. Add the preload line in `BootScene.ts`