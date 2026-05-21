# Blender Source Files

This directory contains Blender `.blend` files for all 3D tank models.

## Naming Convention
- `ironman.blend` — Iron Man tank (hull + turret)
- `naruto.blend` — Naruto tank (hull + turret)
- `spiderman.blend` — Spider-Man tank (hull + turret)
- `thanhgiong.blend` — Thánh Gióng tank (hull + turret)
- `environment.blend` — Shared environment meshes (SteelBox, WoodBox, rubble)
- `projectiles.blend` — Projectile meshes (beam, energy bolt, etc.)

## Export Workflow
See `docs/ASSET_PIPELINE.md` §3 for full export settings.

Quick export:
1. Select hull and turret objects
2. File → Export → glTF 2.0 (.glb)
3. Format: glTF Binary, +Y Up, Apply Modifiers
4. Save to `packages/client-cocos/assets/models/tanks/`
