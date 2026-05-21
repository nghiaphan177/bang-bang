// ═══════════════════════════════════════════════════════════════════
// Room.ts — A single game room/session
// Manages GameState, game loop, player connections, input handling,
// match lifecycle (Waiting → Countdown → Playing → MatchEnd), and
// kill/death tracking with 5-second respawn.
// ═══════════════════════════════════════════════════════════════════

import type WebSocket from 'ws';
import {
  type PlayerId,
  type EntityId,
  type Milliseconds,
  type GridUnits,
  type GameMap,
  type TileDefinition,
  type MatchState,
  type PlayerScore,
  TileType,
  TankState,
  BushVisibilityState,
  ProjectilePhase,
  ProjectileArchetype,
  MatchPhase,
  type ServerMessage,
  ServerMessageType,
  type SnapshotMessage,
  type GameSnapshot,
  type MatchEndMessage,
  type GameEvent,
  type GameEventMessage,
  GameEventType,
  TeamId,
  TankId,
  loadCollisionMap,
  ARCTIC_COLLISION,
} from '@bang-bang/shared';
import { GameState } from '../engine/GameState';
import { EntityManager } from '../engine/EntityManager';
import { type GameEntity } from '../engine/components';
import { MovementSystem } from '../engine/systems/MovementSystem';
import { CollisionSystem } from '../engine/systems/CollisionSystem';
import { ProjectileSystem } from '../engine/systems/ProjectileSystem';
import { CombatSystem } from '../engine/systems/CombatSystem';
import { StatusEffectSystem } from '../engine/systems/StatusEffectSystem';
import { DashSystem } from '../engine/systems/DashSystem';
import { HitscanSystem } from '../engine/systems/HitscanSystem';
import { EvolutionSystem } from '../engine/systems/EvolutionSystem';
import { TANK_ROSTER } from '../data/tank-roster';
import { InputBuffer } from './InputBuffer';

const TICK_RATE = 60;                    // Server Hz
const TICK_MS = 1000 / TICK_RATE;
const MAX_PLAYERS = 10;                  // 5v5
const SNAPSHOT_SEND_RATE = 20;          // Snapshots per second
const SNAPSHOT_EVERY_N_TICKS = Math.round(TICK_RATE / SNAPSHOT_SEND_RATE);

// ─── Match Config ────────────────────────────────────────────────
const MIN_PLAYERS_TO_START = 1;          // 1 for dev testing
const COUNTDOWN_SEC = 3;
const MATCH_TIME_LIMIT_SEC = 600;        // 10 minutes (GDD §7.1)
const KILL_TARGET = 25;                  // First to 25 kills wins (GDD §7.1)
const RESPAWN_DELAY_MS = 5000;           // 5 seconds
const MATCH_END_DISPLAY_SEC = 8;         // Results screen duration

// ─── Safe Zone (GDD §7.1) ────────────────────────────────────────
const SAFE_ZONES: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {
  [TeamId.Red]: { minX: 1, minY: 1, maxX: 8, maxY: 8 },
  [TeamId.Blue]: { minX: 72, minY: 52, maxX: 79, maxY: 59 },
};
const SAFE_ZONE_ENEMY_DPS = 2000;        // True damage per second to enemies
const SAFE_ZONE_HEAL_PER_SEC = 0.10;     // 10% maxHP/sec heal for allies
const SPAWN_PROTECTION_MS = 3000;        // 3 seconds invulnerability on respawn

export interface RoomPlayer {
  playerId: PlayerId;
  tankId: TankId;
  playerName: string;
  entityId: EntityId;
  team: TeamId;
  ws: WebSocket;
  kills: number;
  deaths: number;
}

interface RespawnEntry {
  playerId: PlayerId;
  entityId: EntityId;
  respawnAt: number; // timestamp
}

export class Room {
  public readonly id: string;
  private readonly gameState: GameState;
  private readonly inputBuffer = new InputBuffer();
  private readonly players = new Map<PlayerId, RoomPlayer>();

  // Systems
  private readonly movementSystem = new MovementSystem();
  private readonly collisionSystem = new CollisionSystem();
  private readonly projectileSystem = new ProjectileSystem();
  private readonly combatSystem = new CombatSystem();
  private readonly statusEffectSystem = new StatusEffectSystem();
  private readonly dashSystem = new DashSystem();
  private readonly hitscanSystem = new HitscanSystem();
  private readonly evolutionSystem = new EvolutionSystem();

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;
  private running = false;

  // ─── Match State ─────────────────────────────────────────────
  private matchPhase: MatchPhase = MatchPhase.WaitingForPlayers;
  private countdownRemainingSec: number = COUNTDOWN_SEC;
  private matchElapsedMs: number = 0;
  private matchEndTimerMs: number = 0;
  private winnerId: string = '';

  // Team kill counters
  private teamKills: Record<string, number> = {
    [TeamId.Red]: 0,
    [TeamId.Blue]: 0,
  };

  // Respawn queue
  private respawnQueue: RespawnEntry[] = [];

  constructor(id: string) {
    this.id = id;
    this.gameState = new GameState(this.createDefaultMap());
    // Wire combat ↔ projectile
    this.combatSystem.projectileSystem = this.projectileSystem;
  }

  // ─── Player Management ──────────────────────────────────────────

  get playerCount(): number { return this.players.size; }
  get isFull(): boolean { return this.players.size >= MAX_PLAYERS; }

  addPlayer(playerId: PlayerId, tankId: TankId, ws: WebSocket, playerName: string): EntityId | null {
    if (this.isFull) return null;
    if (this.players.has(playerId)) return null;

    const team = this.assignTeam();
    const def = TANK_ROSTER[tankId];
    if (!def) return null;

    // Create tank entity
    const entity = this.gameState.entityManager.create('tank');
    const spawnPos = this.getSpawnPosition(team);

    // Attach components
    entity.transform = { position: spawnPos, rotation: 0 as any };
    entity.velocity = { velocity: { x: 0, y: 0 }, speed: 0 };
    entity.tankIdentity = {
      tankId,
      playerId,
      team,
      hover: def.hover,
      hitboxRadius: def.hitboxRadius,
    };
    entity.health = { hp: def.attributes.hp, maxHp: def.attributes.hp, isAlive: true };
    entity.tankState = {
      current: TankState.Idle,
      enteredAt: Date.now() as Milliseconds,
      durationMs: 0 as Milliseconds,
    };
    entity.turret = { aimAngle: 0 as any, rotationSpeed: Math.PI * 4 };
    entity.attackTiming = {
      attackSpeed: def.attributes.attackSpeed,
      fireIntervalMs: 1000 / def.attributes.attackSpeed,
      lastFireElapsedMs: 0,
    };
    entity.cooldowns = {
      skillE: { cooldownMs: def.skillE.cooldownSec * 1000, remainingMs: 0, isReady: true },
      skillSpace: { cooldownMs: def.skillSpace.cooldownSec * 1000, remainingMs: 0, isReady: true },
    };
    entity.combatStats = {
      atk: def.attributes.atk,
      range: def.attributes.range,
      defP: def.attributes.defP,
      defE: def.attributes.defE,
      attackSpeed: def.attributes.attackSpeed,
      speed: def.attributes.speed as number,
    };
    entity.input = {
      moveDir: null,
      aimAngle: 0 as any,
      fire: false,
      skillE: false,
      skillSpace: false,
      seq: 0,
    };
    entity.collider = { radius: def.hitboxRadius / 32, isStatic: false };
    entity.statusEffects = { effects: [] };
    entity.evolution = { level: 1, currentExp: 0, expToNextLevel: 100 };

    const player: RoomPlayer = {
      playerId,
      tankId,
      playerName,
      entityId: entity.id,
      team,
      ws,
      kills: 0,
      deaths: 0,
    };
    this.players.set(playerId, player);

    console.log(`[Room ${this.id}] Player ${playerId} joined as ${tankId} on team ${team}`);

    // Start loop if not running (tick handles phase transitions)
    if (!this.running) {
      this.start();
    }

    // Check if we should start countdown
    if (this.matchPhase === MatchPhase.WaitingForPlayers &&
        this.players.size >= MIN_PLAYERS_TO_START) {
      this.transitionTo(MatchPhase.Countdown);
    }

    return entity.id;
  }

  removePlayer(playerId: PlayerId): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Destroy the entity
    this.gameState.entityManager.destroy(player.entityId);
    this.inputBuffer.removePlayer(playerId);
    this.players.delete(playerId);

    // Remove from respawn queue
    this.respawnQueue = this.respawnQueue.filter(r => r.playerId !== playerId);

    console.log(`[Room ${this.id}] Player ${playerId} left`);

    if (this.players.size === 0) {
      this.stop();
      this.resetMatch();
    }
  }

  getPlayerByWs(ws: WebSocket): RoomPlayer | undefined {
    for (const player of this.players.values()) {
      if (player.ws === ws) return player;
    }
    return undefined;
  }

  // ─── Input Handling ─────────────────────────────────────────────

  bufferInput(playerId: PlayerId, input: import('@bang-bang/shared').PlayerInput): void {
    this.inputBuffer.setInput(playerId, input);
  }

  // ─── Game Loop ──────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
    console.log(`[Room ${this.id}] Game loop started at ${TICK_RATE}Hz`);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log(`[Room ${this.id}] Game loop stopped`);
  }

  // ═══════════════════════════════════════════════════════════════
  // TICK — Phase-aware
  // ═══════════════════════════════════════════════════════════════

  private tick(): void {
    const now = Date.now();
    const dt = Math.min(now - this.lastTickTime, TICK_MS * 2);
    this.lastTickTime = now;

    switch (this.matchPhase) {
      case MatchPhase.WaitingForPlayers:
        this.tickWaiting(dt);
        break;
      case MatchPhase.Countdown:
        this.tickCountdown(dt);
        break;
      case MatchPhase.Playing:
        this.tickPlaying(dt);
        break;
      case MatchPhase.MatchEnd:
        this.tickMatchEnd(dt);
        break;
    }

    // Always advance tick counter and send snapshots
    this.gameState.advanceTick();
    if (this.gameState.tick % SNAPSHOT_EVERY_N_TICKS === 0) {
      this.broadcastSnapshot();
    }
    this.inputBuffer.clearTick();
  }

  // ─── Phase: Waiting ───────────────────────────────────────────

  private tickWaiting(_dt: number): void {
    // Check if enough players joined
    if (this.players.size >= MIN_PLAYERS_TO_START) {
      this.transitionTo(MatchPhase.Countdown);
    }
    // No simulation during waiting — just broadcast snapshot with phase info
  }

  // ─── Phase: Countdown ─────────────────────────────────────────

  private tickCountdown(dt: number): void {
    this.countdownRemainingSec -= dt / 1000;

    if (this.countdownRemainingSec <= 0) {
      this.countdownRemainingSec = 0;
      this.transitionTo(MatchPhase.Playing);
    }
    // No simulation during countdown
  }

  // ─── Phase: Playing ───────────────────────────────────────────

  private tickPlaying(dt: number): void {
    this.matchElapsedMs += dt;

    // 1. Apply buffered inputs
    this.applyInputs();

    // 1.1 Process spawn protection (before combat, cancels on attack)
    this.processSpawnProtection(dt);

    // 1.3 Process skill activations
    this.processSkillActivations(dt);

    // 1.5 Spawn projectiles for tanks that are firing
    this.spawnProjectilesForFiringTanks(dt);

    // 2. Run game systems
    const em = this.gameState.entityManager;
    this.statusEffectSystem.update(em, dt);
    
    // Update dashes and cast/hitscans
    this.dashSystem.update(em, this.gameState, this.collisionSystem, this.combatSystem, dt);
    this.hitscanSystem.update(em, this.gameState, this.combatSystem, dt);

    this.movementSystem.update(em, dt);
    this.collisionSystem.update(em, this.gameState, dt);
    this.projectileSystem.update(em, this.gameState, dt);
    this.combatSystem.update(em, this.gameState, dt);
    this.evolutionSystem.update(em, dt);

    // Tick down player stealth window
    for (const tank of em.getTanks()) {
      if (tank.tankState?.stealthRemainingMs && tank.tankState.stealthRemainingMs > 0) {
        tank.tankState.stealthRemainingMs = Math.max(0, tank.tankState.stealthRemainingMs - dt);
      }
    }

    // 3. Process kills and deaths
    this.processDeaths();

    // 4. Process respawn queue
    this.processRespawns();

    // 5. Safe Zone mechanics (heal allies, damage enemies)
    this.processSafeZones(dt);

    // 6. Check win conditions
    this.checkWinConditions();
  }

  // ─── Phase: Match End ─────────────────────────────────────────

  private tickMatchEnd(dt: number): void {
    this.matchEndTimerMs += dt;

    if (this.matchEndTimerMs >= MATCH_END_DISPLAY_SEC * 1000) {
      // Reset and go back to waiting
      this.resetMatch();
      this.transitionTo(MatchPhase.WaitingForPlayers);

      // If enough players, immediately start countdown again
      if (this.players.size >= MIN_PLAYERS_TO_START) {
        this.transitionTo(MatchPhase.Countdown);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MATCH STATE TRANSITIONS
  // ═══════════════════════════════════════════════════════════════

  private transitionTo(phase: MatchPhase): void {
    const prev = this.matchPhase;
    this.matchPhase = phase;
    console.log(`[Room ${this.id}] Match phase: ${prev} → ${phase}`);

    switch (phase) {
      case MatchPhase.Countdown:
        this.countdownRemainingSec = COUNTDOWN_SEC;
        break;

      case MatchPhase.Playing:
        this.matchElapsedMs = 0;
        // Heal all tanks and teleport to spawn
        this.resetAllTanks();
        console.log(`[Room ${this.id}] Match started! Kill target: ${KILL_TARGET}, Time limit: ${MATCH_TIME_LIMIT_SEC}s`);
        break;

      case MatchPhase.MatchEnd:
        this.matchEndTimerMs = 0;
        // Broadcast match end message
        this.broadcastMatchEnd();
        break;

      case MatchPhase.WaitingForPlayers:
        // Already reset in resetMatch
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // KILL / DEATH / RESPAWN
  // ═══════════════════════════════════════════════════════════════

  private processDeaths(): void {
    const em = this.gameState.entityManager;

    for (const tank of em.getTanks()) {
      if (!tank.health || !tank.tankState || !tank.tankIdentity) continue;

      // Detect newly dead tanks
      if (!tank.health.isAlive && tank.tankState.current === TankState.Dead) {
        // Check if already in respawn queue
        const alreadyQueued = this.respawnQueue.some(
          r => (r.entityId as string) === (tank.id as string)
        );
        if (alreadyQueued) continue;

        const victimPlayer = this.findPlayerByEntityId(tank.id);
        if (!victimPlayer) continue;

        // Record death
        victimPlayer.deaths++;

        // Attribute kill — find who killed them via last projectile hit
        const killerEntityId = this.findKillerEntityId(tank.id);
        const killerPlayer = killerEntityId ? this.findPlayerByEntityId(killerEntityId) : undefined;

        if (killerPlayer) {
          killerPlayer.kills++;
          this.teamKills[killerPlayer.team as string] =
            (this.teamKills[killerPlayer.team as string] ?? 0) + 1;
          console.log(`[Room ${this.id}] KILL: ${killerPlayer.playerId} → ${victimPlayer.playerId} (${killerPlayer.kills} kills)`);
        }

        // Process assists and award EXP
        const assistants = new Set<EntityId>();
        const fiveSecondsAgo = Date.now() - 5000;
        if (tank.recentDamage) {
          for (const dmg of tank.recentDamage) {
            if (dmg.timestamp >= fiveSecondsAgo && dmg.attackerId !== killerEntityId && dmg.attackerId !== tank.id) {
              const attackerEntity = em.get(dmg.attackerId);
              if (attackerEntity && attackerEntity.tankIdentity?.team !== tank.tankIdentity.team) {
                assistants.add(dmg.attackerId);
              }
            }
          }
        }

        // Award EXP to killer entity
        if (killerEntityId) {
          const killerEntity = em.get(killerEntityId);
          if (killerEntity?.evolution) {
            killerEntity.evolution.currentExp += 50;
          }
        }

        // Award EXP to assistant entities
        for (const assistantId of assistants) {
          const assistantEntity = em.get(assistantId);
          if (assistantEntity?.evolution) {
            assistantEntity.evolution.currentExp += 25;
          }
        }

        // Clear victim recent damage history
        tank.recentDamage = [];

        // Broadcast kill event
        const gameEvent: GameEvent = {
          eventType: GameEventType.Kill,
          timestamp: Date.now() as Milliseconds,
          data: {
            killerId: killerPlayer ? killerPlayer.playerId : 'Unknown',
            killerName: killerPlayer ? killerPlayer.playerName : 'Unknown',
            victimId: victimPlayer.playerId,
            victimName: victimPlayer.playerName,
          },
        };

        const msg: GameEventMessage = {
          type: ServerMessageType.GameEvent,
          event: gameEvent,
        };

        for (const p of this.players.values()) {
          this.sendToPlayer(p, msg);
        }

        // Queue respawn
        this.respawnQueue.push({
          playerId: victimPlayer.playerId,
          entityId: tank.id,
          respawnAt: Date.now() + RESPAWN_DELAY_MS,
        });
      }
    }
  }

  private processRespawns(): void {
    const now = Date.now();
    const toRespawn: RespawnEntry[] = [];
    const remaining: RespawnEntry[] = [];

    for (const entry of this.respawnQueue) {
      if (now >= entry.respawnAt) {
        toRespawn.push(entry);
      } else {
        remaining.push(entry);
      }
    }
    this.respawnQueue = remaining;

    for (const entry of toRespawn) {
      this.respawnTank(entry.playerId, entry.entityId);
    }
  }

  private respawnTank(playerId: PlayerId, entityId: EntityId): void {
    const player = this.players.get(playerId);
    if (!player) return;

    const entity = this.gameState.entityManager.get(entityId);
    if (!entity) return;

    const def = TANK_ROSTER[player.tankId];
    if (!def) return;

    // Reset health
    if (entity.health) {
      entity.health.hp = def.attributes.hp;
      entity.health.maxHp = def.attributes.hp;
      entity.health.isAlive = true;
    }

    // Reset state
    if (entity.tankState) {
      entity.tankState.current = TankState.Idle;
      entity.tankState.enteredAt = Date.now() as Milliseconds;
    }

    // Teleport to spawn
    if (entity.transform) {
      entity.transform.position = this.getSpawnPosition(player.team);
    }

    // Reset velocity
    if (entity.velocity) {
      entity.velocity.velocity = { x: 0, y: 0 };
      entity.velocity.speed = 0;
    }

    // Clear status effects
    if (entity.statusEffects) {
      entity.statusEffects.effects = [];
    }

    // Spawn protection: 3 seconds invulnerability
    entity.spawnProtectionMs = SPAWN_PROTECTION_MS;

    console.log(`[Room ${this.id}] Player ${playerId} respawned (3s protection)`);
  }

  private findPlayerByEntityId(entityId: EntityId): RoomPlayer | undefined {
    for (const player of this.players.values()) {
      if ((player.entityId as string) === (entityId as string)) return player;
    }
    return undefined;
  }

  /**
   * Find who killed a tank by checking the recent projectile hits.
   * Looks up the projectile entity's ownerId (the tank that fired it).
   */
  private findKillerEntityId(victimEntityId: EntityId): EntityId | undefined {
    const em = this.gameState.entityManager;

    // Check pending hits from ProjectileSystem for this victim
    for (const hit of this.projectileSystem.pendingHits) {
      if (hit.targetId === (victimEntityId as string)) {
        // Look up the projectile entity to get the owner
        const projEntity = em.get(hit.projectileId as EntityId);
        if (projEntity?.projectile?.ownerId) {
          return projEntity.projectile.ownerId;
        }
      }
    }

    // Fallback: scan all living projectiles for recent hits
    // (pendingHits may have been consumed by CombatSystem already)
    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════
  // WIN CONDITIONS
  // ═══════════════════════════════════════════════════════════════

  private checkWinConditions(): void {
    if (this.matchPhase !== MatchPhase.Playing) return;

    // Kill target reached?
    for (const [teamId, kills] of Object.entries(this.teamKills)) {
      if (kills >= KILL_TARGET) {
        this.winnerId = teamId;
        console.log(`[Room ${this.id}] Team ${teamId} wins with ${kills} kills!`);
        this.transitionTo(MatchPhase.MatchEnd);
        return;
      }
    }

    // Time limit reached?
    if (this.matchElapsedMs >= MATCH_TIME_LIMIT_SEC * 1000) {
      const redKills = this.teamKills[TeamId.Red] ?? 0;
      const blueKills = this.teamKills[TeamId.Blue] ?? 0;
      if (redKills > blueKills) {
        this.winnerId = TeamId.Red;
      } else if (blueKills > redKills) {
        this.winnerId = TeamId.Blue;
      } else {
        this.winnerId = 'Draw';
      }
      console.log(`[Room ${this.id}] Time limit! Winner: ${this.winnerId} (Red: ${redKills}, Blue: ${blueKills})`);
      this.transitionTo(MatchPhase.MatchEnd);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MATCH RESET
  // ═══════════════════════════════════════════════════════════════

  private resetMatch(): void {
    // Reset scores
    for (const player of this.players.values()) {
      player.kills = 0;
      player.deaths = 0;
    }
    this.teamKills = {
      [TeamId.Red]: 0,
      [TeamId.Blue]: 0,
    };
    this.respawnQueue = [];
    this.matchElapsedMs = 0;
    this.matchEndTimerMs = 0;
    this.winnerId = '';
    this.countdownRemainingSec = COUNTDOWN_SEC;

    // Reset all tanks
    this.resetAllTanks();

    console.log(`[Room ${this.id}] Match reset`);
  }

  private resetAllTanks(): void {
    for (const player of this.players.values()) {
      this.respawnTank(player.playerId, player.entityId);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INPUT APPLICATION
  // ═══════════════════════════════════════════════════════════════

  private applyInputs(): void {
    for (const [playerId, input] of this.inputBuffer.getAllInputs()) {
      const player = this.players.get(playerId);
      if (!player) continue;
      const entity = this.gameState.entityManager.get(player.entityId);
      if (!entity?.input) continue;

      entity.input.moveDir = input.moveDir;
      entity.input.aimAngle = input.aimAngle;
      entity.input.fire = input.fire;
      entity.input.skillE = input.skillE;
      entity.input.skillSpace = input.skillSpace;
      entity.input.seq = input.seq;

      this.inputBuffer.markProcessed(playerId);
    }
  }

  // ─── Projectile Spawning ──────────────────────────────────────────

  private spawnProjectilesForFiringTanks(dt: number): void {
    const em = this.gameState.entityManager;

    for (const tank of em.getTanks()) {
      if (!tank.input || !tank.transform || !tank.attackTiming || !tank.health?.isAlive) continue;
      if (!tank.tankIdentity || !tank.combatStats || !tank.turret) continue;

      // Check if Stunned or Dead (can't fire)
      if (tank.tankState?.current === TankState.Stunned ||
          tank.tankState?.current === TankState.Dead) continue;

      if (!tank.input.fire) continue;

      // Check fire rate
      if (tank.attackTiming.lastFireElapsedMs < tank.attackTiming.fireIntervalMs) continue;

      // Get attack definition from roster
      const def = TANK_ROSTER[tank.tankIdentity.tankId];
      if (!def) continue;

      const atk = def.attack;
      const aimAngle = tank.turret.aimAngle as number;

      // Calculate raw damage: baseDamage + atk * atkScaling
      const rawDamage = atk.damageFormula.baseDamage + (tank.combatStats.atk * atk.damageFormula.atkScaling);

      // Don't spawn projectiles for Dash/Hitscan archetypes on basic attack
      if (atk.archetype === ProjectileArchetype.Dash ||
          atk.archetype === ProjectileArchetype.Hitscan) {
        tank.attackTiming.lastFireElapsedMs = 0;
        continue;
      }

      // Calculate projectile speed and range in GridUnits
      const projectileSpeed = atk.projectileSpeed ?? def.attributes.projectileSpeed ?? 14;
      const maxRange = (atk.range ?? tank.combatStats.range) / 32;

      // Spawn projectile entity
      const proj = em.create('projectile');
      const spawnDist = 0.7;

      proj.transform = {
        position: {
          x: tank.transform.position.x + Math.cos(aimAngle) * spawnDist,
          y: tank.transform.position.y + Math.sin(aimAngle) * spawnDist,
        },
        rotation: aimAngle as any,
      };

      proj.velocity = {
        velocity: {
          x: Math.cos(aimAngle) * projectileSpeed,
          y: Math.sin(aimAngle) * projectileSpeed,
        },
        speed: projectileSpeed,
      };

      proj.projectile = {
        archetype: atk.archetype,
        ownerId: tank.id,
        tankId: tank.tankIdentity.tankId,
        damage: rawDamage,
        damageChannel: atk.damageFormula.channel,
        maxRange,
        distanceTraveled: 0,
        phase: ProjectilePhase.Active,
        ...(atk.maxBounces != null ? { maxBounces: atk.maxBounces, bouncesLeft: atk.maxBounces } : {}),
      };

      // Reset fire timer
      tank.attackTiming.lastFireElapsedMs = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SNAPSHOT BROADCAST
  // ═══════════════════════════════════════════════════════════════

  private broadcastSnapshot(): void {
    const matchState = this.createMatchState();
    const snapshot = this.gameState.createSnapshot(
      this.inputBuffer.getAllLastProcessedSeqs(),
      matchState,
    );

    for (const player of this.players.values()) {
      // Filter tanks: hide enemies that have stealthRemainingMs > 0
      const filteredTanks = snapshot.tanks.filter(t => {
        const entity = this.gameState.entityManager.get(t.entityId);
        if (entity?.tankState?.stealthRemainingMs && entity.tankState.stealthRemainingMs > 0) {
          // If stealth is active, only show to same team
          return t.team === player.team;
        }
        return true;
      });

      const playerSnapshot: GameSnapshot = {
        ...snapshot,
        tanks: filteredTanks,
        lastProcessedInput: this.inputBuffer.getLastProcessedSeq(player.playerId),
      };

      const msg: SnapshotMessage = {
        type: ServerMessageType.Snapshot,
        snapshot: playerSnapshot,
      };

      this.sendToPlayer(player, msg);
    }
  }

  private broadcastMatchEnd(): void {
    const scores = this.getPlayerScores();

    const msg: MatchEndMessage = {
      type: ServerMessageType.MatchEnd,
      winnerTeam: this.winnerId as TeamId,
      scores,
      matchDurationSec: Math.floor(this.matchElapsedMs / 1000),
    };

    for (const player of this.players.values()) {
      this.sendToPlayer(player, msg as ServerMessage);
    }
  }

  private createMatchState(): MatchState {
    return {
      phase: this.matchPhase,
      countdownSec: Math.ceil(this.countdownRemainingSec),
      matchTimeSec: Math.floor(this.matchElapsedMs / 1000),
      matchTimeLimitSec: MATCH_TIME_LIMIT_SEC,
      scores: this.getPlayerScores(),
      teamScores: { ...this.teamKills },
      winnerId: this.winnerId,
      killTarget: KILL_TARGET,
    };
  }

  private getPlayerScores(): PlayerScore[] {
    const scores: PlayerScore[] = [];
    for (const player of this.players.values()) {
      scores.push({
        playerId: player.playerId,
        tankId: player.tankId,
        team: player.team,
        kills: player.kills,
        deaths: player.deaths,
      });
    }
    return scores;
  }

  private processSkillActivations(dt: number): void {
    const em = this.gameState.entityManager;
    for (const tank of em.getTanks()) {
      if (!tank.health?.isAlive || !tank.input || !tank.cooldowns || !tank.tankIdentity || !tank.transform || !tank.turret) continue;

      // If stunned or dead, cannot activate skills
      if (tank.tankState?.current === TankState.Stunned || tank.tankState?.current === TankState.Dead) continue;

      // Handle Skill E
      if (tank.input.skillE && tank.cooldowns.skillE.isReady) {
        const def = TANK_ROSTER[tank.tankIdentity.tankId];
        if (def && def.skillE) {
          const activated = this.activateSkill(tank, 'E', def.skillE);
          if (activated) {
            tank.cooldowns.skillE.remainingMs = def.skillE.cooldownSec * 1000;
            tank.cooldowns.skillE.isReady = false;
          }
        }
      }

      // Handle Skill Space
      if (tank.input.skillSpace && tank.cooldowns.skillSpace.isReady) {
        const def = TANK_ROSTER[tank.tankIdentity.tankId];
        if (def && def.skillSpace) {
          const activated = this.activateSkill(tank, 'Space', def.skillSpace);
          if (activated) {
            tank.cooldowns.skillSpace.remainingMs = def.skillSpace.cooldownSec * 1000;
            tank.cooldowns.skillSpace.isReady = false;
          }
        }
      }
    }
  }

  private activateSkill(tank: GameEntity, slot: 'E' | 'Space', skillDef: any): boolean {
    const em = this.gameState.entityManager;

    switch (skillDef.archetype) {
      case ProjectileArchetype.Homing: {
        // Iron Man E - Micro-Missiles
        const rangeGrids = (skillDef.range ?? 320) / 32;
        let targetEnemy: GameEntity | null = null;
        let minDist = rangeGrids;

        for (const other of em.getTanks()) {
          if (!other.health?.isAlive || other.id === tank.id) continue;
          if (other.tankIdentity?.team === tank.tankIdentity?.team) continue; // Skip allies

          const dx = other.transform!.position.x - tank.transform!.position.x;
          const dy = other.transform!.position.y - tank.transform!.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            targetEnemy = other;
          }
        }

        const rawDamage = skillDef.damageFormula.baseDamage + (tank.combatStats!.atk * skillDef.damageFormula.atkScaling);
        const angles = [-Math.PI / 12, 0, Math.PI / 12];
        const spawnDist = 0.7;
        const speed = 15;
        const maxRange = rangeGrids;

        for (const spread of angles) {
          const angle = (tank.turret!.aimAngle as number) + spread;
          const proj = em.create('projectile');

          proj.transform = {
            position: {
              x: tank.transform!.position.x + Math.cos(angle) * spawnDist,
              y: tank.transform!.position.y + Math.sin(angle) * spawnDist,
            },
            rotation: angle as any,
          };

          proj.velocity = {
            velocity: {
              x: Math.cos(angle) * speed,
              y: Math.sin(angle) * speed,
            },
            speed,
          };

          proj.projectile = {
            archetype: ProjectileArchetype.Homing,
            ownerId: tank.id,
            tankId: tank.tankIdentity!.tankId,
            damage: rawDamage,
            damageChannel: skillDef.damageFormula.channel,
            maxRange,
            distanceTraveled: 0,
            phase: ProjectilePhase.Active,
            targetEntityId: targetEnemy ? targetEnemy.id : undefined,
            turnRate: Math.PI * 2, // 360 degrees per second
          };
        }
        return true;
      }

      case ProjectileArchetype.Lob: {
        // SpiderMan Space - Web Prison
        const rangeGrids = (skillDef.range ?? 352) / 32;
        const aimAngle = tank.turret!.aimAngle as number;
        const targetX = tank.transform!.position.x + Math.cos(aimAngle) * rangeGrids;
        const targetY = tank.transform!.position.y + Math.sin(aimAngle) * rangeGrids;

        const rawDamage = skillDef.damageFormula.baseDamage + (tank.combatStats!.atk * skillDef.damageFormula.atkScaling);
        const airTime = skillDef.airTime ?? 1.0; // 1s air time
        const airTimeMs = airTime * 1000;

        // Calculate visual flight speed so it arrives at targetPosition in airTime
        const dx = targetX - tank.transform!.position.x;
        const dy = targetY - tank.transform!.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = airTime > 0 ? dist / airTime : 10;

        const proj = em.create('projectile');
        proj.transform = {
          position: { x: tank.transform!.position.x, y: tank.transform!.position.y },
          rotation: aimAngle as any,
        };

        proj.velocity = {
          velocity: {
            x: Math.cos(aimAngle) * speed,
            y: Math.sin(aimAngle) * speed,
          },
          speed,
        };

        proj.projectile = {
          archetype: ProjectileArchetype.Lob,
          ownerId: tank.id,
          tankId: tank.tankIdentity!.tankId,
          damage: rawDamage,
          damageChannel: skillDef.damageFormula.channel,
          maxRange: dist,
          distanceTraveled: 0,
          phase: ProjectilePhase.Active,
          targetPosition: { x: targetX, y: targetY },
          airTimeMs,
          airTimeRemainingMs: airTimeMs,
          aoeRadius: 3.0, // 3 grids AoE
          aoeEffects: [...(skillDef.effects ?? [])],
        };
        return true;
      }

      case ProjectileArchetype.Dash: {
        if (slot === 'E' && tank.tankIdentity!.tankId === TankId.Naruto) {
          // Naruto Shadow Clone (E)
          // 1. Spawn decoy clone at player's current position
          const clone = em.create('tank');
          clone.transform = {
            position: { x: tank.transform!.position.x, y: tank.transform!.position.y },
            rotation: tank.transform!.rotation,
          };
          clone.velocity = { velocity: { x: 0, y: 0 }, speed: 0 };
          clone.tankIdentity = {
            tankId: tank.tankIdentity!.tankId,
            playerId: `clone_${tank.id}_${Date.now()}` as any,
            team: tank.tankIdentity!.team,
            hover: tank.tankIdentity!.hover,
            hitboxRadius: tank.tankIdentity!.hitboxRadius,
          };
          clone.health = { hp: 1, maxHp: 1, isAlive: true };
          clone.tankState = {
            current: TankState.Moving,
            enteredAt: Date.now() as any,
            durationMs: 3000 as any, // 3s
          };
          clone.turret = {
            aimAngle: tank.turret!.aimAngle,
            rotationSpeed: tank.turret!.rotationSpeed,
          };
          clone.collider = { radius: tank.collider!.radius, isStatic: false };
          clone.statusEffects = { effects: [] };
          clone.combatStats = {
            atk: 0,
            range: 0,
            defP: 0,
            defE: 0,
            attackSpeed: 0,
            speed: 0 as any,
          };

          // 2. Teleport real player a short distance backward (opposite of aim angle)
          const oppositeAngle = (tank.turret!.aimAngle as number) + Math.PI;
          const teleportDist = 2.5; // 2.5 grids
          tank.transform!.position = {
            x: tank.transform!.position.x + Math.cos(oppositeAngle) * teleportDist,
            y: tank.transform!.position.y + Math.sin(oppositeAngle) * teleportDist,
          };
          this.collisionSystem.resolveTankMapCollision(tank, this.gameState);

          // 3. Apply stealth window (0.5s)
          tank.tankState!.stealthRemainingMs = 500;
          return true;
        } else if (slot === 'Space' && tank.tankIdentity!.tankId === TankId.Naruto) {
          // Naruto Rasengan (Space) - Dash forward in turret aim angle for 0.4s at 3x speed
          const aimAngle = tank.turret!.aimAngle as number;
          this.triggerDash(tank, skillDef, aimAngle, 3.0, 400, 'rasengan');
          return true;
        } else if (slot === 'E' && tank.tankIdentity!.tankId === TankId.ThanhGiong) {
          // ThanhGiong Charge (E) - Dash forward in hull rotation for 0.5s at 2.5x speed
          const hullAngle = tank.transform!.rotation as number;
          this.triggerDash(tank, skillDef, hullAngle, 2.5, 500, 'charge');
          return true;
        }
        return false;
      }

      case ProjectileArchetype.Hitscan: {
        if (skillDef.castTimeSec && skillDef.castTimeSec > 0) {
          tank.tankState!.current = TankState.Casting;
          tank.tankState!.enteredAt = Date.now() as any;
          tank.castState = {
            isCasting: true,
            skillSlot: slot,
            remainingMs: skillDef.castTimeSec * 1000,
            rootSelf: skillDef.rootSelfDuringCast ?? false,
            skillDef,
          };
        } else {
          // Instant execution
          this.hitscanSystem.executeHitscanSkill(tank, skillDef, em, this.combatSystem);
        }
        return true;
      }

      case ProjectileArchetype.Linear: {
        // SpiderMan Web Pull (E) is ProjectileArchetype.Linear but behaves as a projectile skill!
        const rangeGrids = (skillDef.range ?? 320) / 32;
        const aimAngle = tank.turret!.aimAngle as number;
        const rawDamage = skillDef.damageFormula.baseDamage + (tank.combatStats!.atk * skillDef.damageFormula.atkScaling);
        const speed = skillDef.projectileSpeed ?? tank.combatStats!.speed * 2;

        const proj = em.create('projectile');
        const spawnDist = 0.7;

        proj.transform = {
          position: {
            x: tank.transform!.position.x + Math.cos(aimAngle) * spawnDist,
            y: tank.transform!.position.y + Math.sin(aimAngle) * spawnDist,
          },
          rotation: aimAngle as any,
        };

        proj.velocity = {
          velocity: {
            x: Math.cos(aimAngle) * speed,
            y: Math.sin(aimAngle) * speed,
          },
          speed,
        };

        proj.projectile = {
          archetype: ProjectileArchetype.Linear,
          ownerId: tank.id,
          tankId: tank.tankIdentity!.tankId,
          damage: rawDamage,
          damageChannel: skillDef.damageFormula.channel,
          maxRange: rangeGrids,
          distanceTraveled: 0,
          phase: ProjectilePhase.Active,
          effects: [...(skillDef.effects ?? [])],
        };
        return true;
      }
    }
    return false;
  }

  private triggerDash(
    tank: GameEntity,
    skillDef: any,
    directionAngle: number,
    speedMultiplier: number,
    durationMs: number,
    dashType: 'rasengan' | 'charge'
  ): void {
    const rawDamage = skillDef.damageFormula.baseDamage + (tank.combatStats!.atk * skillDef.damageFormula.atkScaling);

    tank.tankState!.current = TankState.Dashing;
    tank.tankState!.enteredAt = Date.now() as any;

    tank.dashState = {
      isDashing: true,
      direction: { x: Math.cos(directionAngle), y: Math.sin(directionAngle) },
      speed: tank.combatStats!.speed * speedMultiplier,
      remainingMs: durationMs,
      dashType,
      damagePayload: rawDamage,
      damageChannel: skillDef.damageFormula.channel,
      onHitEffects: [...(skillDef.effects ?? [])],
      hitEntities: new Set(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SAFE ZONE & SPAWN PROTECTION
  // ═══════════════════════════════════════════════════════════════

  private processSafeZones(dt: number): void {
    const em = this.gameState.entityManager;
    const dtSec = dt / 1000;

    for (const tank of em.getTanks()) {
      if (!tank.health?.isAlive || !tank.transform || !tank.tankIdentity) continue;
      const { x, y } = tank.transform.position;
      const team = tank.tankIdentity.team as string;

      for (const [zoneTeam, zone] of Object.entries(SAFE_ZONES)) {
        const inside = x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY;
        if (!inside) continue;

        if (team === zoneTeam) {
          // Ally in own safe zone: heal 10% maxHP/sec
          const healAmount = Math.floor(tank.health.maxHp * SAFE_ZONE_HEAL_PER_SEC * dtSec);
          tank.health.hp = Math.min(tank.health.maxHp, tank.health.hp + healAmount);
        } else {
          // Enemy in our safe zone: 2000 True DPS
          const dmg = Math.floor(SAFE_ZONE_ENEMY_DPS * dtSec);
          tank.health.hp = Math.max(0, tank.health.hp - dmg);
          if (tank.health.hp <= 0) {
            tank.health.isAlive = false;
            if (tank.tankState) {
              tank.tankState.current = TankState.Dead;
            }
          }
        }
      }
    }
  }

  private processSpawnProtection(dt: number): void {
    const em = this.gameState.entityManager;
    for (const tank of em.getTanks()) {
      if (tank.spawnProtectionMs == null || tank.spawnProtectionMs <= 0) continue;

      // Cancel immediately if firing or using skill (GDD §7.1)
      if (tank.input?.fire || tank.input?.skillE || tank.input?.skillSpace) {
        tank.spawnProtectionMs = 0;
        continue;
      }

      // Tick down
      tank.spawnProtectionMs -= dt;
      if (tank.spawnProtectionMs <= 0) {
        tank.spawnProtectionMs = 0;
      }
    }
  }

  private sendToPlayer(player: RoomPlayer, msg: ServerMessage): void {
    if (player.ws.readyState === player.ws.OPEN) {
      player.ws.send(JSON.stringify(msg));
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private assignTeam(): TeamId {
    let redCount = 0;
    let blueCount = 0;
    for (const p of this.players.values()) {
      if (p.team === TeamId.Red) redCount++;
      if (p.team === TeamId.Blue) blueCount++;
    }
    return redCount <= blueCount ? TeamId.Red : TeamId.Blue;
  }

  private getSpawnPosition(team: TeamId): { x: number; y: number } {
    // Randomize spawn within team area (40×30 grid)
    const jitterX = Math.random() * 4 - 2;
    const jitterY = Math.random() * 4 - 2;
    if (team === TeamId.Red) {
      return { x: 5 + jitterX, y: 5 + jitterY };
    }
    return { x: 35 + jitterX, y: 25 + jitterY };
  }

  private createDefaultMap(): GameMap {
    return loadCollisionMap(ARCTIC_COLLISION);
  }
}
