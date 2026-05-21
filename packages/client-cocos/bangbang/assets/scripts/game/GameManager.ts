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
import { KillFeedController } from '../ui/KillFeedController';
import type { GameSnapshot, PlayerInput, GameEvent } from '../shared/types/network';
import { GameEventType } from '../shared/types/network';
import type { Radians } from '../shared/types/core';
import { MatchPhase } from '../shared/types/state-machine';
import { SceneBuilder, TILE_PX } from './SceneBuilder';
import { TankId } from '../shared/types/tank';
import { TANK_ROSTER } from '../shared/data/tank-roster';

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
  private killFeedController: KillFeedController | null = null;

  private mode: 'connecting' | 'online' | 'local' = 'connecting';
  private networkClient: NetworkClient | null = null;
  private prediction: ClientPrediction | null = null;
  private interpolation: EntityInterpolation | null = null;

  private playerId = `player_${Math.random().toString(36).substring(2, 8)}`;

  private remoteTankControllers: Map<string, TankController> = new Map();
  private remoteTankNodes: Map<string, Node> = new Map();
  private latestSnapshot: GameSnapshot | null = null;

  private sceneBuilder: SceneBuilder = new SceneBuilder();

  private selectedTankId: TankId = TankId.IronMan; // dynamic lobby select in Task 7.1
  private skillECooldownMs = 0;
  private skillEMaxCooldownMs = 9000;
  private skillSpaceCooldownMs = 0;
  private skillSpaceMaxCooldownMs = 42000;

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
    this.killFeedController = refs.killFeedController;

    const tankDef = TANK_ROSTER[this.selectedTankId];
    if (tankDef) {
      this.skillEMaxCooldownMs = tankDef.skillE.cooldownSec * 1000;
      this.skillSpaceMaxCooldownMs = tankDef.skillSpace.cooldownSec * 1000;
    }

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
      tankId: this.selectedTankId as any,
      playerName: 'CocosPlayer',
    });

    this.networkClient.onSnapshot((s) => this.onSnapshot(s));
    this.networkClient.onGameEvent((e) => this.onGameEvent(e));
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

    const isMatchEnd = this.latestSnapshot?.matchState.phase === MatchPhase.MatchEnd;
    const rawInput = this.inputManager.getInput();
    const inp = isMatchEnd
      ? { moveDir: null, aimAngle: 0, fire: false, skillE: false, skillSpace: false }
      : rawInput;

    const playerInput: PlayerInput = {
      moveDir: inp.moveDir,
      aimAngle: inp.aimAngle as Radians,
      fire: inp.fire,
      skillE: inp.skillE,
      skillSpace: inp.skillSpace,
      seq: this.networkClient?.getNextSeq() ?? 0,
    };

    // Cooldown ticks
    const dtMs = dt * 1000;
    this.skillECooldownMs = Math.max(0, this.skillECooldownMs - dtMs);
    this.skillSpaceCooldownMs = Math.max(0, this.skillSpaceCooldownMs - dtMs);

    // Predict cooldown trigger
    let isAlive = true;
    if (this.latestSnapshot) {
      const me = this.latestSnapshot.tanks.find(
        (t) => (t.playerId as string) === this.playerId,
      );
      if (me) {
        isAlive = me.isAlive;
      }
    }

    if (isAlive && !isMatchEnd) {
      if (playerInput.skillE && this.skillECooldownMs <= 0) {
        this.skillECooldownMs = this.skillEMaxCooldownMs;
      }
      if (playerInput.skillSpace && this.skillSpaceCooldownMs <= 0) {
        this.skillSpaceCooldownMs = this.skillSpaceMaxCooldownMs;
      }
    }

    this.prediction.applyInput(playerInput, dtMs);

    if (this.mode === 'online' && this.networkClient) {
      this.networkClient.sendInput({
        moveDir: playerInput.moveDir,
        aimAngle: playerInput.aimAngle,
        fire: playerInput.fire,
        skillE: playerInput.skillE,
        skillSpace: playerInput.skillSpace,
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
        isPlayer: true,
        isAlly: true,
      };

      if (this.latestSnapshot) {
        const me = this.latestSnapshot.tanks.find(
          (t) => (t.playerId as string) === this.playerId,
        );
        if (me) {
          rd.health = { hp: me.hp, maxHp: me.maxHp, isAlive: me.isAlive };
          rd.level = me.level;
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

        // Update Skill Cooldowns on HUD
        const ratioE = this.skillEMaxCooldownMs > 0 ? this.skillECooldownMs / this.skillEMaxCooldownMs : 0;
        const ratioSpace = this.skillSpaceMaxCooldownMs > 0 ? this.skillSpaceCooldownMs / this.skillSpaceMaxCooldownMs : 0;
        const secE = this.skillECooldownMs / 1000;
        const secSpace = this.skillSpaceCooldownMs / 1000;
        this.hudController.updateSkillCooldowns(ratioE, ratioSpace, secE, secSpace);
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
      if (ms.phase === MatchPhase.WaitingForPlayers) {
        this.hudController?.setWaitingStatus(true);
        this.hudController?.hideMatchInfo();
        this.matchOverlay?.hideCountdown();
        this.matchOverlay?.hideResults();
      } else if (ms.phase === MatchPhase.Countdown) {
        this.hudController?.setWaitingStatus(false);
        this.hudController?.hideMatchInfo();
        this.matchOverlay?.showCountdown(ms.countdownSec);
        this.matchOverlay?.hideResults();
      } else if (ms.phase === MatchPhase.Playing) {
        this.hudController?.setWaitingStatus(false);
        this.hudController?.updateMatchInfo(ms.matchTimeSec, ms.teamScores['Red'] ?? 0, ms.teamScores['Blue'] ?? 0);
        this.matchOverlay?.hideCountdown();
        this.matchOverlay?.hideResults();
      } else if (ms.phase === MatchPhase.MatchEnd) {
        this.hudController?.setWaitingStatus(false);
        this.hudController?.hideMatchInfo();
        this.matchOverlay?.hideCountdown();
        this.matchOverlay?.showResults(ms.winnerId, ms.scores as any);
      }
    }

    this.renderProjectiles(snapshot);
  }

  private onGameEvent(event: GameEvent): void {
    if (event.eventType === GameEventType.Kill) {
      const killerName = (event.data.killerName as string) || 'Unknown';
      const victimName = (event.data.victimName as string) || 'Unknown';
      this.killFeedController?.addKillEntry(killerName, victimName);
    }
  }

  private renderRemotes(entities: InterpolatedEntity[]): void {
    const active = new Set<string>();
    const myTeam = this.latestSnapshot?.tanks.find(
      (t) => (t.playerId as string) === this.playerId,
    )?.team;

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

      const isAlly = myTeam ? e.team === myTeam : false;

      ctrl.updateFromState({
        transform: { position: e.position, rotation: e.hullRotation },
        turret: { aimAngle: e.turretRotation },
        health: { hp: e.hp, maxHp: e.maxHp, isAlive: e.isAlive },
        isPlayer: false,
        isAlly,
        level: e.level,
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
