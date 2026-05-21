/**
 * GameManager.ts — Main game orchestrator for Cocos Creator 3.8
 *
 * Builds the entire scene programmatically on load.
 * Handles server connection, input, prediction, and rendering.
 */

import {
  _decorator, Component, Node, Camera, Vec3, Quat, Color,
} from 'cc';
import { InputManager } from '../input/InputManager';
import { NetworkClient, type NetworkClientOptions } from '../network/NetworkClient';
import { ClientPrediction } from '../network/ClientPrediction';
import { EntityInterpolation, type InterpolatedEntity } from '../network/EntityInterpolation';
import { TankController, type RenderableTank } from '../rendering/TankController';
import { MapController } from '../rendering/MapController';
import { ProjectileController, type RenderableProjectile } from '../rendering/ProjectileController';
import { HUDController } from '../ui/HUDController';
import { MatchOverlayController } from '../ui/MatchOverlayController';
import { MinimapController } from '../ui/MinimapController';
import type { GameSnapshot, PlayerInput } from '../shared/types/network';
import type { Radians } from '../shared/types/core';
import { SceneBuilder, TILE_PX } from './SceneBuilder';

const { ccclass } = _decorator;

const SERVER_URL = 'ws://localhost:8080';
const SERVER_INFO_URL = 'http://localhost:8080/info';

@ccclass('GameManager')
export class GameManager extends Component {

  private gameCamera: Camera | null = null;
  private inputManager: InputManager | null = null;
  private mapController: MapController | null = null;
  private projectileController: ProjectileController | null = null;
  private playerTankController: TankController | null = null;
  private hudController: HUDController | null = null;
  private matchOverlay: MatchOverlayController | null = null;
  private minimapController: MinimapController | null = null;

  private mode: 'connecting' | 'online' | 'local' = 'connecting';
  private networkClient: NetworkClient | null = null;
  private prediction: ClientPrediction | null = null;
  private interpolation: EntityInterpolation | null = null;

  private playerId = `player_${Math.random().toString(36).substring(2, 8)}`;

  private remoteTankControllers: Map<string, TankController> = new Map();
  private remoteTankNodes: Map<string, Node> = new Map();
  private latestSnapshot: GameSnapshot | null = null;

  private sceneBuilder: SceneBuilder = new SceneBuilder();

  // ─── Lifecycle ──────────────────────────────────────────────────

  async start(): Promise<void> {
    console.log('[Game] Initializing...');

    const refs = this.sceneBuilder.build(this.node);
    this.gameCamera = refs.gameCamera;
    this.inputManager = refs.inputManager;
    this.mapController = refs.mapController;
    this.projectileController = refs.projectileController;
    this.playerTankController = refs.playerTankController;
    this.hudController = refs.hudController;
    this.matchOverlay = refs.matchOverlayController;
    this.minimapController = refs.minimapController;

    const serverAvailable = await NetworkClient.isServerAvailable(SERVER_INFO_URL);
    if (serverAvailable) {
      this.startOnlineMode();
    } else {
      console.log('[Game] Server not available → local mode');
      this.startLocalMode();
    }
  }



  // ─── Networking ─────────────────────────────────────────────────

  private startOnlineMode(): void {
    console.log('[Game] Online mode');
    this.mode = 'online';
    this.prediction = new ClientPrediction(this.playerId);
    this.interpolation = new EntityInterpolation(this.playerId);

    this.networkClient = new NetworkClient({
      url: SERVER_URL,
      playerId: this.playerId as any,
      tankId: 'IronMan' as any,
      playerName: 'CocosPlayer',
    });

    this.networkClient.onSnapshot((s) => this.onSnapshot(s));
    this.networkClient.onConnect(() => console.log('[Game] Connected'));
    this.networkClient.onDisconnect(() => console.log('[Game] Disconnected'));
    this.networkClient.connect();
  }

  private startLocalMode(): void {
    this.mode = 'local';
    this.prediction = new ClientPrediction(this.playerId);
    this.prediction.position = { x: 20, y: 15 };
  }

  // ─── Update Loop ────────────────────────────────────────────────

  update(dt: number): void {
    if (!this.inputManager || !this.prediction) return;

    this.inputManager.setTankPosition(
      this.prediction.position.x * TILE_PX,
      this.prediction.position.y * TILE_PX,
    );

    const inp = this.inputManager.getInput();

    const playerInput: PlayerInput = {
      moveDir: inp.moveDir,
      aimAngle: inp.aimAngle as Radians,
      fire: inp.fire,
      skillE: inp.skillE,
      skillSpace: inp.skillSpace,
      seq: this.networkClient?.getNextSeq() ?? 0,
    };

    this.prediction.applyInput(playerInput, dt * 1000);

    if (this.mode === 'online' && this.networkClient) {
      this.networkClient.sendInput({
        moveDir: inp.moveDir,
        aimAngle: inp.aimAngle as Radians,
        fire: inp.fire,
        skillE: inp.skillE,
        skillSpace: inp.skillSpace,
      });
    }

    // ── Render Player Tank ─────────────────────────────────────
    if (this.playerTankController) {
      const rd: RenderableTank = {
        transform: {
          position: this.prediction.position,
          rotation: this.prediction.hullRotation,
        },
        turret: { aimAngle: inp.aimAngle },
        health: { hp: 100, maxHp: 100, isAlive: true },
      };

      if (this.latestSnapshot) {
        const me = this.latestSnapshot.tanks.find(
          (t) => (t.playerId as string) === this.playerId,
        );
        if (me) {
          rd.health = { hp: me.hp, maxHp: me.maxHp, isAlive: me.isAlive };
        }
      }
      this.playerTankController.updateFromState(rd);

      // HUD
      if (this.hudController) {
        this.hudController.updateHP(rd.health.hp, rd.health.maxHp);
        this.hudController.updateNetworkStatus(
          this.networkClient?.getRTT() ?? 0,
          this.mode,
          this.latestSnapshot?.tanks.length ?? 0
        );
      }
    }

    // ── Render Remotes ─────────────────────────────────────────
    let remotes: InterpolatedEntity[] = [];
    if (this.interpolation) {
      remotes = this.interpolation.getInterpolatedEntities(Date.now());
      this.renderRemotes(remotes);
    }

    // ── Minimap ────────────────────────────────────────────────
    if (this.minimapController) {
      this.minimapController.updateEntities(
        this.prediction.position,
        remotes.map(e => ({ x: e.position.x, y: e.position.y, isAlly: false }))
      );
    }

    // ── Camera Follow ──────────────────────────────────────────
    this.followCamera();
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private onSnapshot(snapshot: GameSnapshot): void {
    this.latestSnapshot = snapshot;
    this.prediction?.reconcile(snapshot);
    this.interpolation?.pushSnapshot(snapshot.timestamp as number, snapshot.tanks);

    if (this.mapController) {
      for (const d of snapshot.mapDelta) {
        this.mapController.markDestroyed(d.col, d.row);
      }
    }

    const ms = snapshot.matchState;
    if (ms) {
      if (ms.phase === 'Countdown') this.matchOverlay?.showCountdown(ms.countdownSec);
      if (ms.phase === 'Playing') this.hudController?.updateMatchInfo(ms.matchTimeSec, ms.teamScores['Red'] ?? 0, ms.teamScores['Blue'] ?? 0);
      if (ms.phase === 'MatchEnd') this.matchOverlay?.showResults(ms.winnerId, ms.scores as any);
    }

    this.renderProjectiles(snapshot);
  }

  private renderRemotes(entities: InterpolatedEntity[]): void {
    const active = new Set<string>();

    for (const e of entities) {
      active.add(e.entityId);
      let ctrl = this.remoteTankControllers.get(e.entityId);

      if (!ctrl) {
        const nd = this.sceneBuilder.createRemoteTankNode(`Remote_${e.entityId}`);
        this.node.getChildByName('GameWorld')?.getChildByName('RemoteTanks')?.addChild(nd);
        ctrl = nd.getComponent(TankController)!;
        this.remoteTankControllers.set(e.entityId, ctrl);
        this.remoteTankNodes.set(e.entityId, nd);
      }

      ctrl.updateFromState({
        transform: { position: e.position, rotation: e.hullRotation },
        turret: { aimAngle: e.turretRotation },
        health: { hp: e.hp, maxHp: e.maxHp, isAlive: e.isAlive },
      });
    }

    for (const [id, nd] of this.remoteTankNodes) {
      if (!active.has(id)) {
        nd.destroy();
        this.remoteTankNodes.delete(id);
        this.remoteTankControllers.delete(id);
      }
    }
  }

  private followCamera(): void {
    if (!this.gameCamera || !this.prediction) return;
    const cn = this.gameCamera.node;
    const tx = this.prediction.position.x * TILE_PX;
    const tz = this.prediction.position.y * TILE_PX;
    const p = cn.getPosition();
    cn.setPosition(
      p.x + (tx - p.x) * 0.1,
      p.y,
      p.z + (tz - p.z) * 0.1,
    );
  }



  // ─── Projectiles from Snapshot ──────────────────────────────────

  private renderProjectiles(snapshot: GameSnapshot): void {
    if (!this.projectileController) return;
    const projs: RenderableProjectile[] = snapshot.projectiles.map((p) => ({
      id: p.id,
      transform: {
        position: { x: p.position.x, y: p.position.y },
        rotation: Math.atan2(p.velocity.y, p.velocity.x),
      },
      projectile: { phase: 'Active' },
    }));
    this.projectileController.updateProjectiles(projs);
  }

  onDestroy(): void {
    this.networkClient?.disconnect();
  }
}
