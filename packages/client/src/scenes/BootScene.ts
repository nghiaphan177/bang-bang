// ═══════════════════════════════════════════════════════════════════
// BootScene.ts — Asset loading + procedural texture generation
// Generates 2.5D-ready textures with shadows and depth
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';

const TILE_PX = 32;

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // ─── Map Background Images (single static image per map) ──
    // Walls, water, bushes are all baked into these images.
    // Server/game logic maintains a hidden collision matrix.
    this.load.image('map_bg_default', '/assets/maps/default/map_bg.png');
    this.load.image('map_bg_arctic', '/assets/maps/arctic/map_bg.png');

    // ─── Tank Assets (In-Game Top-Down 90-degree) ────────────
    this.load.image('hull_ironman', '/assets/hulls/ironman.png');
    this.load.image('hull_naruto', '/assets/hulls/naruto.png');
    this.load.image('hull_spiderman', '/assets/hulls/spiderman.png');
    this.load.image('hull_thanhgiong', '/assets/hulls/thanhgiong.png');
    this.load.image('turret_ironman', '/assets/turrets/ironman.png');
    this.load.image('turret_naruto', '/assets/turrets/naruto.png');
    this.load.image('turret_spiderman', '/assets/turrets/spiderman.png');
    this.load.image('turret_thanhgiong', '/assets/turrets/thanhgiong.png');

    // ─── Lobby Tank Assets (Garage Angled 60-degree) ──────────
    this.load.image('lobby_hull_ironman', '/assets/lobby/hulls/ironman.png');
    this.load.image('lobby_hull_naruto', '/assets/lobby/hulls/naruto.png');
    this.load.image('lobby_hull_spiderman', '/assets/lobby/hulls/spiderman.png');
    this.load.image('lobby_hull_thanhgiong', '/assets/lobby/hulls/thanhgiong.png');
    this.load.image('lobby_turret_ironman', '/assets/lobby/turrets/ironman.png');
    this.load.image('lobby_turret_naruto', '/assets/lobby/turrets/naruto.png');
    this.load.image('lobby_turret_spiderman', '/assets/lobby/turrets/spiderman.png');
    this.load.image('lobby_turret_thanhgiong', '/assets/lobby/turrets/thanhgiong.png');

    // ─── Projectiles ────────────────────────────────────────
    this.load.image('projectile_beam', '/assets/projectiles/beam.png');
    this.load.image('projectile_ironman', '/assets/projectiles/ironman.png');
    this.load.image('projectile_naruto', '/assets/projectiles/naruto.png');
    this.load.image('projectile_spiderman', '/assets/projectiles/spiderman.png');
    this.load.image('projectile_thanhgiong', '/assets/projectiles/thanhgiong.png');

    this.createLoadingBar();
  }

  create(): void {
    this.generateAllTextures();
    this.scene.start('GameScene');
  }

  private createLoadingBar(): void {
    const { width, height } = this.scale;
    const barW = 320, barH = 20;
    const barX = (width - barW) / 2, barY = height / 2;

    const bgBar = this.add.graphics();
    bgBar.fillStyle(0x111111, 1);
    bgBar.fillRect(barX, barY, barW, barH);

    const progressBar = this.add.graphics();

    this.add.text(width / 2, barY - 40, 'BANG BANG REMAKE', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '20px',
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, barY + 30, 'Loading assets...', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#888888',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xf1c40f, 1);
      progressBar.fillRect(barX + 2, barY + 2, (barW - 4) * value, barH - 4);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      bgBar.destroy();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCEDURAL TEXTURES
  // Generate all textures needed for 2.5D rendering
  // ═══════════════════════════════════════════════════════════════

  private generateAllTextures(): void {
    this.generateSeamlessBackground();  // Fallback if map_bg image fails to load
    this.generateArcticBackground();    // Fallback if arctic image fails to load
    this.generateFallbackTanks();
    this.generateDestroyedTile();       // Rubble overlay for destroyed walls
    this.generateProjectileFallback();
    this.generateBoxTextures();         // Steel/Wood box sprites for map overlay
    this.generateUIFallbacks();
  }

  // ─── Box sprite textures (rendered on top of map_bg) ────────────
  private generateBoxTextures(): void {
    // Steel Box — dark metallic crate with rivets
    if (!this.textures.exists('tile_steel_box')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Base dark steel
      gfx.fillStyle(0x4a5568, 1);
      gfx.fillRoundedRect(1, 1, TILE_PX - 2, TILE_PX - 2, 2);
      // Inner plate
      gfx.fillStyle(0x5a6a7e, 1);
      gfx.fillRect(4, 4, TILE_PX - 8, TILE_PX - 8);
      // Cross reinforcement
      gfx.lineStyle(2, 0x3a4558, 1);
      gfx.lineBetween(4, 4, TILE_PX - 4, TILE_PX - 4);
      gfx.lineBetween(TILE_PX - 4, 4, 4, TILE_PX - 4);
      // Corner rivets
      gfx.fillStyle(0x8a9bb0, 1);
      gfx.fillCircle(5, 5, 2);
      gfx.fillCircle(TILE_PX - 5, 5, 2);
      gfx.fillCircle(5, TILE_PX - 5, 2);
      gfx.fillCircle(TILE_PX - 5, TILE_PX - 5, 2);
      // Heavy outline
      gfx.lineStyle(1.5, 0x2d3748, 1);
      gfx.strokeRoundedRect(1, 1, TILE_PX - 2, TILE_PX - 2, 2);
      // Top highlight
      gfx.fillStyle(0xffffff, 0.08);
      gfx.fillRect(2, 2, TILE_PX - 4, 3);
      gfx.generateTexture('tile_steel_box', TILE_PX, TILE_PX);
      gfx.destroy();
    }

    // Wood Box — warm brown wooden crate with planks
    if (!this.textures.exists('tile_wood_box')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Base wood
      gfx.fillStyle(0x8B6914, 1);
      gfx.fillRoundedRect(1, 1, TILE_PX - 2, TILE_PX - 2, 1);
      // Plank lines (horizontal)
      gfx.lineStyle(1, 0x6B4F10, 0.6);
      gfx.lineBetween(2, 8, TILE_PX - 2, 8);
      gfx.lineBetween(2, 16, TILE_PX - 2, 16);
      gfx.lineBetween(2, 24, TILE_PX - 2, 24);
      // Vertical bracing
      gfx.lineStyle(2, 0x704F0E, 0.5);
      gfx.lineBetween(TILE_PX / 2, 2, TILE_PX / 2, TILE_PX - 2);
      // Nail heads
      gfx.fillStyle(0x555555, 1);
      gfx.fillCircle(TILE_PX / 2, 8, 1.5);
      gfx.fillCircle(TILE_PX / 2, 16, 1.5);
      gfx.fillCircle(TILE_PX / 2, 24, 1.5);
      // Wood grain highlight
      gfx.fillStyle(0xA08020, 0.3);
      gfx.fillRect(3, 2, 12, 5);
      gfx.fillRect(18, 17, 10, 5);
      // Outline
      gfx.lineStyle(1, 0x5B3F0A, 1);
      gfx.strokeRoundedRect(1, 1, TILE_PX - 2, TILE_PX - 2, 1);
      gfx.generateTexture('tile_wood_box', TILE_PX, TILE_PX);
      gfx.destroy();
    }
  }

  // ─── Seamless tiling background (Depth 0) ─────────────────
  private generateSeamlessBackground(): void {
    const size = 128; // Larger tile for less repetition
    const gfx = this.make.graphics({ x: 0, y: 0 });

    // Base ground color — military dark green-gray
    gfx.fillStyle(0x3d4f3d, 1);
    gfx.fillRect(0, 0, size, size);

    // Subtle noise/dirt patches for organic look
    const rng = new Phaser.Math.RandomDataGenerator(['bg_seed']);
    for (let i = 0; i < 40; i++) {
      const x = rng.integerInRange(0, size);
      const y = rng.integerInRange(0, size);
      const r = rng.integerInRange(2, 6);
      const shade = rng.integerInRange(0x30, 0x50);
      const color = (shade << 16) | ((shade + 0x10) << 8) | shade;
      gfx.fillStyle(color, rng.realInRange(0.15, 0.35));
      gfx.fillCircle(x, y, r);
    }

    // Subtle grid lines (very faint, not ugly white)
    gfx.lineStyle(1, 0x4a5c4a, 0.2);
    for (let i = 0; i <= size; i += 32) {
      gfx.lineBetween(i, 0, i, size);
      gfx.lineBetween(0, i, size, i);
    }

    gfx.generateTexture('bg_ground', size, size);
    gfx.destroy();
  }

  // ─── Arctic seamless tiling background ──────────────────────
  private generateArcticBackground(): void {
    const size = 128;
    const gfx = this.make.graphics({ x: 0, y: 0 });

    // Base icy white-blue
    gfx.fillStyle(0xd6eaf8, 1);
    gfx.fillRect(0, 0, size, size);

    // Subtle snow patches
    const rng = new Phaser.Math.RandomDataGenerator(['arctic_bg']);
    for (let i = 0; i < 30; i++) {
      const x = rng.integerInRange(0, size);
      const y = rng.integerInRange(0, size);
      const r = rng.integerInRange(3, 8);
      gfx.fillStyle(0xeaf2f8, rng.realInRange(0.3, 0.6));
      gfx.fillCircle(x, y, r);
    }

    // Faint ice crack lines
    gfx.lineStyle(1, 0xaed6f1, 0.15);
    for (let i = 0; i <= size; i += 32) {
      gfx.lineBetween(i, 0, i, size);
      gfx.lineBetween(0, i, size, i);
    }

    gfx.generateTexture('bg_arctic', size, size);
    gfx.destroy();
  }

  // ─── Arctic fallback tiles ──────────────────────────────────
  private generateArcticFallbackTiles(): void {
    if (!this.textures.exists('arctic_ground')) {
      this.makeRectTexture('arctic_ground', TILE_PX, TILE_PX, 0xd6eaf8, 0xaed6f1);
    }
    if (!this.textures.exists('arctic_brick')) {
      this.makeRectTexture('arctic_brick', TILE_PX, TILE_PX, 0x85c1e9, 0x5dade2);
    }
    if (!this.textures.exists('arctic_steel')) {
      this.makeRectTexture('arctic_steel', TILE_PX, TILE_PX, 0x5b7d9a, 0x7fb3d3);
    }
    if (!this.textures.exists('arctic_bush')) {
      this.makeRectTexture('arctic_bush', TILE_PX, TILE_PX, 0x1e8449, 0xd5f5e3);
    }
    if (!this.textures.exists('arctic_water')) {
      this.makeRectTexture('arctic_water', TILE_PX, TILE_PX, 0x2e86c1, 0x5dade2);
    }
  }

  // ─── Drop shadow for walls (2.5D height illusion) ──────────
  private generateWallShadow(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0x000000, 0.4);
    // Shadow slightly offset and larger to simulate height
    gfx.fillRoundedRect(0, 0, TILE_PX + 4, TILE_PX + 4, 2);
    gfx.generateTexture('wall_shadow', TILE_PX + 4, TILE_PX + 4);
    gfx.destroy();
  }

  // ─── Destroyed brick rubble ─────────────────────────────────
  private generateDestroyedTile(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // Transparent rubble - barely visible debris
    const rng = new Phaser.Math.RandomDataGenerator(['rubble']);
    for (let i = 0; i < 8; i++) {
      const x = rng.integerInRange(4, 28);
      const y = rng.integerInRange(4, 28);
      gfx.fillStyle(0x6d4c2a, rng.realInRange(0.3, 0.6));
      gfx.fillRect(x, y, rng.integerInRange(3, 7), rng.integerInRange(2, 5));
    }
    gfx.generateTexture('tile_destroyed', TILE_PX, TILE_PX);
    gfx.destroy();
  }

  // ─── Fallback tiles (if AI images fail) ─────────────────────
  private generateFallbackTiles(): void {
    if (!this.textures.exists('tile_ground')) {
      this.makeRectTexture('tile_ground', TILE_PX, TILE_PX, 0x4a6741, 0x5a7751);
    }
    if (!this.textures.exists('tile_brick')) {
      this.makeBrickTexture();
    }
    if (!this.textures.exists('tile_steel')) {
      this.makeRectTexture('tile_steel', TILE_PX, TILE_PX, 0x7f8c8d, 0x95a5a6);
    }
    if (!this.textures.exists('tile_bush')) {
      this.makeBushTexture();
    }
    if (!this.textures.exists('tile_water')) {
      this.makeWaterTexture();
    }
  }

  // ─── Brick wall with visible mortar lines ───────────────────
  private makeBrickTexture(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // Base mortar
    gfx.fillStyle(0x8b7355, 1);
    gfx.fillRect(0, 0, TILE_PX, TILE_PX);
    // Bricks
    const brickH = 7;
    const colors = [0xc0392b, 0xb33a2c, 0xd44a3a, 0xc0442e];
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : 8;
      for (let col = -1; col < 3; col++) {
        const ci = (row + col) & 3;
        gfx.fillStyle(colors[ci]!, 1);
        gfx.fillRect(offset + col * 16 + 1, row * (brickH + 1) + 1, 14, brickH);
      }
    }
    // Subtle top highlight
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillRect(0, 0, TILE_PX, 2);
    gfx.generateTexture('tile_brick', TILE_PX, TILE_PX);
    gfx.destroy();
  }

  // ─── Bush with leaf clusters ────────────────────────────────
  private makeBushTexture(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    const rng = new Phaser.Math.RandomDataGenerator(['bush']);
    // Base dark green
    gfx.fillStyle(0x1e7a34, 1);
    gfx.fillRect(0, 0, TILE_PX, TILE_PX);
    // Leaf clusters
    for (let i = 0; i < 12; i++) {
      const x = rng.integerInRange(2, 30);
      const y = rng.integerInRange(2, 30);
      const shade = rng.pick([0x27ae60, 0x2ecc71, 0x1abc6c, 0x229954]);
      gfx.fillStyle(shade, 0.8);
      gfx.fillCircle(x, y, rng.integerInRange(3, 6));
    }
    gfx.generateTexture('tile_bush', TILE_PX, TILE_PX);
    gfx.destroy();
  }

  // ─── Water with ripples ─────────────────────────────────────
  private makeWaterTexture(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0x1a6fa0, 1);
    gfx.fillRect(0, 0, TILE_PX, TILE_PX);
    // Ripple lines
    gfx.lineStyle(1, 0x3498db, 0.5);
    for (let y = 4; y < TILE_PX; y += 6) {
      gfx.lineBetween(0, y, TILE_PX, y + 2);
    }
    // Highlight
    gfx.fillStyle(0x5dade2, 0.2);
    gfx.fillRect(4, 4, 12, 8);
    gfx.generateTexture('tile_water', TILE_PX, TILE_PX);
    gfx.destroy();
  }

  private makeRectTexture(key: string, w: number, h: number, fill: number, stroke: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(fill, 1);
    gfx.fillRect(0, 0, w, h);
    gfx.lineStyle(1, stroke, 0.5);
    gfx.strokeRect(0, 0, w, h);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  // ─── Fallback tank textures ─────────────────────────────────
  private generateFallbackTanks(): void {
    const tanks = ['ironman', 'naruto', 'spiderman', 'thanhgiong'];
    const hullColors = [0xe74c3c, 0xf39c12, 0x3498db, 0x2ecc71];
    const turretColors = [0xc0392b, 0xe67e22, 0x2980b9, 0x27ae60];

    for (let i = 0; i < tanks.length; i++) {
      const hullKey = `hull_${tanks[i]}`;
      const turretKey = `turret_${tanks[i]}`;

      if (!this.textures.exists(hullKey)) {
        this.makeHullTexture(hullKey, hullColors[i]!);
      }
      if (!this.textures.exists(turretKey)) {
        this.makeTurretTexture(turretKey, turretColors[i]!);
      }
    }
  }

  private makeHullTexture(key: string, color: number): void {
    const w = 36, h = 44;
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // Tracks
    gfx.fillStyle(0x444444, 1);
    gfx.fillRoundedRect(0, 2, 8, h - 4, 2);
    gfx.fillRoundedRect(w - 8, 2, 8, h - 4, 2);
    // Track detail lines
    gfx.lineStyle(1, 0x333333, 0.6);
    for (let y = 4; y < h - 4; y += 4) {
      gfx.lineBetween(1, y, 7, y);
      gfx.lineBetween(w - 7, y, w - 1, y);
    }
    // Body
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(8, 4, w - 16, h - 8, 3);
    // Body detail — center line
    gfx.lineStyle(1, 0xffffff, 0.15);
    gfx.lineBetween(w / 2, 6, w / 2, h - 6);
    // Top highlight
    gfx.fillStyle(0xffffff, 0.12);
    gfx.fillRoundedRect(10, 5, w - 20, 6, 2);
    // Outline
    gfx.lineStyle(1.5, 0x000000, 0.5);
    gfx.strokeRoundedRect(0, 2, w, h - 4, 3);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private makeTurretTexture(key: string, color: number): void {
    const w = 12, h = 32;
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // Base circle (sits on hull center)
    gfx.fillStyle(color, 1);
    gfx.fillCircle(w / 2, h - 8, 6);
    gfx.lineStyle(1, 0x000000, 0.4);
    gfx.strokeCircle(w / 2, h - 8, 6);
    // Barrel
    gfx.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(20).color, 1);
    gfx.fillRoundedRect(w / 2 - 3, 0, 6, h - 12, 1);
    // Barrel outline
    gfx.lineStyle(1, 0x000000, 0.3);
    gfx.strokeRoundedRect(w / 2 - 3, 0, 6, h - 12, 1);
    // Muzzle tip glow
    gfx.fillStyle(0xf5f5dc, 0.9);
    gfx.fillCircle(w / 2, 2, 2);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private generateProjectileFallback(): void {
    if (!this.textures.exists('projectile_beam')) {
      this.makeProjFallback('projectile_beam', 0xf1c40f);
    }
    if (!this.textures.exists('projectile_ironman')) {
      this.makeProjFallback('projectile_ironman', 0xe74c3c);
    }
    if (!this.textures.exists('projectile_naruto')) {
      this.makeProjFallback('projectile_naruto', 0x3498db);
    }
    if (!this.textures.exists('projectile_spiderman')) {
      this.makeProjFallback('projectile_spiderman', 0xffffff);
    }
    if (!this.textures.exists('projectile_thanhgiong')) {
      this.makeProjFallback('projectile_thanhgiong', 0x2ecc71);
    }
  }

  private makeProjFallback(key: string, color: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(color, 0.4);
    gfx.fillCircle(6, 6, 6);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(6, 6, 3);
    gfx.generateTexture(key, 12, 12);
    gfx.destroy();
  }

  private generateUIFallbacks(): void {
    // ─── HP Bar Frame (100x12) ──────────────────────────────
    if (!this.textures.exists('ui_hp_frame')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Metallic casing (heavy dark gray)
      gfx.fillStyle(0x2b2b2b, 1);
      gfx.fillRoundedRect(0, 0, 100, 12, 3);
      // Inner shadow / hollow casing
      gfx.fillStyle(0x151515, 1);
      gfx.fillRoundedRect(2, 2, 96, 8, 2);
      // Sleek silver borders
      gfx.lineStyle(1.5, 0x4f4f4f, 1);
      gfx.strokeRoundedRect(0.75, 0.75, 98.5, 10.5, 3);
      gfx.generateTexture('ui_hp_frame', 100, 12);
      gfx.destroy();
    }

    // ─── HP Bar Fill - Green (96x8) ─────────────────────────
    if (!this.textures.exists('ui_hp_fill')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Base vibrant green
      gfx.fillStyle(0x2ecc71, 1);
      gfx.fillRoundedRect(0, 0, 96, 8, 1);
      // Glossy highlight streak at the top half
      gfx.fillStyle(0xa3e4d7, 0.6);
      gfx.fillRect(0, 0, 96, 3);
      gfx.generateTexture('ui_hp_fill', 96, 8);
      gfx.destroy();
    }

    // ─── HP Bar Fill - Yellow (96x8) ────────────────────────
    if (!this.textures.exists('ui_hp_fill_yellow')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Base yellow
      gfx.fillStyle(0xf39c12, 1);
      gfx.fillRoundedRect(0, 0, 96, 8, 1);
      // Glossy highlight streak
      gfx.fillStyle(0xfadbd8, 0.6);
      gfx.fillRect(0, 0, 96, 3);
      gfx.generateTexture('ui_hp_fill_yellow', 96, 8);
      gfx.destroy();
    }

    // ─── HP Bar Fill - Red (96x8) ───────────────────────────
    if (!this.textures.exists('ui_hp_fill_red')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Base red
      gfx.fillStyle(0xe74c3c, 1);
      gfx.fillRoundedRect(0, 0, 96, 8, 1);
      // Glossy highlight streak
      gfx.fillStyle(0xfadbd8, 0.6);
      gfx.fillRect(0, 0, 96, 3);
      gfx.generateTexture('ui_hp_fill_red', 96, 8);
      gfx.destroy();
    }

    // ─── Skill Slot Frame (64x64) ───────────────────────────
    if (!this.textures.exists('ui_skill_frame')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Base metallic plate
      gfx.fillStyle(0x1f1f1f, 1);
      gfx.fillRect(0, 0, 64, 64);
      // Hollow center
      gfx.fillStyle(0x0e0e0e, 1);
      gfx.fillRect(4, 4, 56, 56);
      // Thick bolted border
      gfx.lineStyle(4, 0x474747, 1);
      gfx.strokeRect(2, 2, 60, 60);
      // Small circles for corner bolts
      gfx.fillStyle(0x888888, 1);
      gfx.fillCircle(6, 6, 2);
      gfx.fillCircle(58, 6, 2);
      gfx.fillCircle(6, 58, 2);
      gfx.fillCircle(58, 58, 2);
      gfx.generateTexture('ui_skill_frame', 64, 64);
      gfx.destroy();
    }

    // ─── Skill Icon - E (64x64) ─────────────────────────────
    if (!this.textures.exists('ui_skill_icon_e')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Dark yellow/orange tech background
      gfx.fillStyle(0x3a2307, 1);
      gfx.fillRect(0, 0, 64, 64);
      // Lightning bolt icon (glowing yellow)
      gfx.fillStyle(0xf1c40f, 1);
      gfx.beginPath();
      gfx.moveTo(32, 8);
      gfx.lineTo(44, 28);
      gfx.lineTo(34, 28);
      gfx.lineTo(38, 56);
      gfx.lineTo(20, 36);
      gfx.lineTo(30, 36);
      gfx.closePath();
      gfx.fill();
      gfx.generateTexture('ui_skill_icon_e', 64, 64);
      gfx.destroy();
    }

    // ─── Skill Icon - Space (64x64) ─────────────────────────
    if (!this.textures.exists('ui_skill_icon_space')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Dark blue tech background
      gfx.fillStyle(0x0b2238, 1);
      gfx.fillRect(0, 0, 64, 64);
      // Glowing blue rings / ultimate indicator
      gfx.lineStyle(3, 0x3498db, 1);
      gfx.strokeCircle(32, 32, 18);
      gfx.lineStyle(2, 0x5dade2, 0.8);
      gfx.strokeCircle(32, 32, 10);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(32, 32, 4);
      gfx.generateTexture('ui_skill_icon_space', 64, 64);
      gfx.destroy();
    }

    // ─── HUD Panel background (32x32 for 9-slice) ───────────
    if (!this.textures.exists('ui_hud_panel')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Metallic plate
      gfx.fillStyle(0x18181f, 0.85); // 85% opacity dark blue-gray
      gfx.fillRoundedRect(0, 0, 32, 32, 4);
      // Thick metallic border
      gfx.lineStyle(2, 0x33333f, 1);
      gfx.strokeRoundedRect(1, 1, 30, 30, 4);
      // Corner glow / bolts
      gfx.fillStyle(0x555566, 1);
      gfx.fillRect(2, 2, 2, 2);
      gfx.fillRect(28, 2, 2, 2);
      gfx.fillRect(2, 28, 2, 2);
      gfx.fillRect(28, 28, 2, 2);
      gfx.generateTexture('ui_hud_panel', 32, 32);
      gfx.destroy();
    }
  }
}
