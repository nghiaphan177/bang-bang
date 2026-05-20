// ═══════════════════════════════════════════════════════════════════
// GameScene.ts — Main gameplay scene (Local + Online dual-mode)
//
// Camera: Dynamic follow with lerp (only small portion visible)
// Depth ordering: BG(0) → Water(10) → Bush(15) → Tanks(20)
//                 → WallShadow(25) → Walls(30) → Projectiles(40)
//                 → HP Bars(50)
//
// Mode detection:
//   1. On create(), probe server at localhost:8080
//   2. If reachable → online mode (NetworkClient + prediction)
//   3. If not → local mode (LocalGameState, existing behavior)
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import { InputManager } from '../input/InputManager';
import { MapRenderer, type MapTheme } from '../rendering/MapRenderer';
import { TankRenderer } from '../rendering/TankRenderer';
import { ProjectileRenderer } from '../rendering/ProjectileRenderer';
import { HUD } from '../rendering/HUD';
import { MatchOverlay } from '../rendering/MatchOverlay';
import { DummyRenderer } from '../rendering/DummyRenderer';
import { Minimap, type MinimapEntity } from '../rendering/Minimap';
import { LocalGameState } from '../game/LocalGameState';
import { OnlineGameState, type RemoteTankData } from '../game/OnlineGameState';
import type { PlayerId, TankId } from '@bang-bang/shared';

const TILE_PX = 32;

type GameMode = 'local' | 'online';

/** Map TankId → sprite key used by DummyRenderer */
const TANK_SPRITE_KEYS: Record<string, string> = {
  IronMan: 'ironman',
  Naruto: 'naruto',
  SpiderMan: 'spiderman',
  ThanhGiong: 'thanhgiong',
};

export class GameScene extends Phaser.Scene {
  private inputManager!: InputManager;
  private mapRenderer!: MapRenderer;
  private tankRenderer!: TankRenderer;
  private projectileRenderer!: ProjectileRenderer;
  private hud!: HUD;
  private minimap!: Minimap;

  // ─── Local mode ────────────────────────────────────────────
  private localState!: LocalGameState;
  private dummyRenderers!: DummyRenderer[];

  // ─── Online mode ───────────────────────────────────────────
  private onlineState: OnlineGameState | null = null;
  private remoteTankRenderers: Map<string, DummyRenderer> = new Map();
  private matchOverlay: MatchOverlay | null = null;

  // ─── Mode flag ─────────────────────────────────────────────
  private mode: GameMode = 'local';
  private sceneInitialized = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  async create(): Promise<void> {
    // ─── Detect server availability ──────────────────────────
    const serverAvailable = await OnlineGameState.isServerAvailable();

    if (serverAvailable) {
      this.mode = 'online';
      console.log('[GameScene] Server detected → ONLINE mode');
      this.createOnline();
    } else {
      this.mode = 'local';
      console.log('[GameScene] No server → LOCAL mode');
      this.createLocal();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOCAL MODE SETUP (existing behavior)
  // ═══════════════════════════════════════════════════════════════

  private createLocal(): void {
    this.localState = new LocalGameState();

    const map = this.localState.getMap();
    const mapW = (map.widthGrids as number) * TILE_PX;
    const mapH = (map.heightGrids as number) * TILE_PX;

    // Determine map theme from map name
    const theme: MapTheme = map.name.toLowerCase().includes('arctic') ? 'arctic' : 'default';

    // ─── Render the map ─────────────────────────────────────
    this.mapRenderer = new MapRenderer(this, map, theme);

    // ─── Player tank (Container-based twin-stick) ───────────
    this.tankRenderer = new TankRenderer(
      this, this.localState.getPlayerEntity(), 'ironman',
    );

    // ─── Dummy target renderers ─────────────────────────────
    const dummies = this.localState.getDummies();
    const dummyKeys = ['naruto', 'spiderman', 'thanhgiong', 'naruto', 'spiderman'];
    this.dummyRenderers = dummies.map((d, i) =>
      new DummyRenderer(this, d, dummyKeys[i % dummyKeys.length]!),
    );

    // ─── Projectile renderer ────────────────────────────────
    this.projectileRenderer = new ProjectileRenderer(this);

    // ─── Camera ─────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(
      this.tankRenderer.container,
      true, 0.15, 0.15,
    );

    // ─── Input ──────────────────────────────────────────────
    this.inputManager = new InputManager(this);

    // ─── HUD ────────────────────────────────────────────────
    this.hud = new HUD(this);

    // ─── Minimap ────────────────────────────────────────────
    this.minimap = new Minimap(this, map);

    this.sceneInitialized = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // ONLINE MODE SETUP
  // ═══════════════════════════════════════════════════════════════

  private createOnline(): void {
    // Generate random player identity
    const playerId = `player_${Math.random().toString(36).slice(2, 8)}` as PlayerId;
    const tankId = 'IronMan' as TankId;

    this.onlineState = new OnlineGameState(playerId, tankId);

    const map = this.onlineState.getMap();
    const mapW = (map.widthGrids as number) * TILE_PX;
    const mapH = (map.heightGrids as number) * TILE_PX;

    // Determine map theme from map name
    const theme: MapTheme = map.name.toLowerCase().includes('arctic') ? 'arctic' : 'default';

    // ─── Render the map ─────────────────────────────────────
    this.mapRenderer = new MapRenderer(this, map, theme);

    // ─── Player tank — starts at origin, will snap on first snapshot ──
    const initialEntity = {
      transform: { position: { x: 10, y: 10 }, rotation: 0 },
      turret: { aimAngle: 0 },
      health: { hp: 3200, maxHp: 3200, isAlive: true },
    };
    this.tankRenderer = new TankRenderer(this, initialEntity, 'ironman');

    // ─── Projectile renderer ────────────────────────────────
    this.projectileRenderer = new ProjectileRenderer(this);

    // ─── Camera ─────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(
      this.tankRenderer.container,
      true, 0.15, 0.15,
    );

    // ─── Input ──────────────────────────────────────────────
    this.inputManager = new InputManager(this);

    // ─── HUD ────────────────════════════════════════════════
    this.hud = new HUD(this);

    // ─── Match Overlay ──────────────────────────────────────
    this.matchOverlay = new MatchOverlay(this);

    // ─── Minimap ────────────────────────────────────────────
    this.minimap = new Minimap(this, map);

    // ─── Connect to server ──────────────────────────────────
    this.onlineState.connect();

    this.sceneInitialized = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE LOOP
  // ═══════════════════════════════════════════════════════════════

  update(_time: number, delta: number): void {
    if (!this.sceneInitialized) return;

    if (this.mode === 'local') {
      this.updateLocal(delta);
    } else {
      this.updateOnline(delta);
    }
  }

  // ─── Local Update (unchanged) ─────────────────────────────────

  private updateLocal(delta: number): void {
    const input = this.inputManager.getInput(this.tankRenderer.container);

    this.localState.processInput(input);
    this.localState.tick(delta);

    // Notify map renderer about destroyed walls
    for (const { col, row } of this.localState.drainDestroyedTiles()) {
      this.mapRenderer.markDestroyed(col, row);
    }

    this.tankRenderer.update(this.localState.getPlayerEntity());

    const dummies = this.localState.getDummies();
    for (let i = 0; i < this.dummyRenderers.length; i++) {
      this.dummyRenderers[i]!.update(dummies[i]!);
    }

    this.projectileRenderer.update(this.localState.getProjectiles());
    this.hud.update(this.localState.getPlayerEntity());

    // ─── Minimap ─────────────────────────────────────────────
    const player = this.localState.getPlayerEntity();
    const minimapEntities: MinimapEntity[] = [
      { x: player.transform.position.x, y: player.transform.position.y, type: 'player' },
    ];
    for (const d of this.localState.getDummies()) {
      if (d.health.isAlive) {
        minimapEntities.push({ x: d.transform.position.x, y: d.transform.position.y, type: 'enemy' });
      }
    }
    this.minimap.update(minimapEntities, this.cameras.main);
  }

  // ─── Online Update ────────────────────────────────────────────

  private updateOnline(delta: number): void {
    if (!this.onlineState) return;

    // ─── Gather input ─────────────────────────────────────
    const input = this.inputManager.getInput(this.tankRenderer.container);

    // ─── Process input (predict locally + send to server) ──
    this.onlineState.processInput(input, delta);

    // ─── Wait for initialization from first snapshot ───────
    if (!this.onlineState.isInitialized) return;

    // ─── Update local player from prediction ──────────────
    const playerEntity = this.onlineState.getPlayerEntity();
    this.tankRenderer.update(playerEntity);

    // ─── Update remote tanks from interpolation ───────────
    this.updateRemoteTanks();

    // ─── Update projectiles from latest snapshot ──────────
    this.projectileRenderer.update(this.onlineState.getProjectiles());

    // ─── Update HUD ───────────────────────────────────────
    this.hud.update(playerEntity, {
      connected: this.onlineState.connected,
      rtt: this.onlineState.rtt,
      playerCount: this.onlineState.playerCount,
    });

    // ─── Update Match Overlay ─────────────────────────────
    if (this.matchOverlay) {
      this.matchOverlay.update(this.onlineState.getMatchState());
    }

    // ─── Minimap ─────────────────────────────────────────
    const minimapEntities: MinimapEntity[] = [
      { x: playerEntity.transform.position.x, y: playerEntity.transform.position.y, type: 'player' },
    ];
    for (const tank of this.onlineState.getRemoteTanks()) {
      if (tank.isAlive) {
        minimapEntities.push({ x: tank.position.x, y: tank.position.y, type: 'enemy' });
      }
    }
    this.minimap.update(minimapEntities, this.cameras.main);
  }

  // ─── Remote Tank Management ───────────────────────────────────

  private updateRemoteTanks(): void {
    if (!this.onlineState) return;

    const remoteTanks = this.onlineState.getRemoteTanks();
    const activeIds = new Set<string>();

    for (const tank of remoteTanks) {
      activeIds.add(tank.entityId);

      let renderer = this.remoteTankRenderers.get(tank.entityId);
      if (!renderer) {
        // Create new remote tank renderer
        const spriteKey = TANK_SPRITE_KEYS[tank.tankId] ?? 'ironman';
        const initData = {
          transform: { position: tank.position, rotation: tank.hullRotation },
          turret: { aimAngle: tank.turretRotation },
          health: { hp: tank.hp, maxHp: tank.maxHp, isAlive: tank.isAlive },
        };
        renderer = new DummyRenderer(this, initData, spriteKey);
        this.remoteTankRenderers.set(tank.entityId, renderer);
        console.log(`[GameScene] Created remote tank renderer: ${tank.tankId}`);
      }

      // Update with latest interpolated data
      renderer.update({
        transform: { position: tank.position, rotation: tank.hullRotation },
        turret: { aimAngle: tank.turretRotation },
        health: { hp: tank.hp, maxHp: tank.maxHp, isAlive: tank.isAlive },
      });
    }

    // Remove renderers for tanks that have left
    for (const [id, renderer] of this.remoteTankRenderers) {
      if (!activeIds.has(id)) {
        renderer.destroy();
        this.remoteTankRenderers.delete(id);
        console.log(`[GameScene] Removed remote tank renderer: ${id}`);
      }
    }
  }
}
