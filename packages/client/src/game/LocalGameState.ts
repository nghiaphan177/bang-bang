// ═══════════════════════════════════════════════════════════════════
// LocalGameState.ts — Client-side game simulation (Phase 2 testing)
//
// KEY CHANGES FROM REVIEW:
//   1. Map is 80x60 grid (2560x1920px) — much larger than viewport
//   2. NO AMMO/RELOAD system — infinite attacks with attackSpeed
//   3. Free-movement (not grid-locked)
//   4. Proper dummy targets for shooting practice
// ═══════════════════════════════════════════════════════════════════

import {
  type GameMap,
  type TileDefinition,
  TileType,
  TankState,
  ProjectilePhase,
  BushVisibilityState,
  type GridUnits,
  loadCollisionMap,
  ARCTIC_COLLISION,
} from '@bang-bang/shared';
import type { LocalInput } from '../input/InputManager';

interface Vec2 { x: number; y: number }

// ─── Tank Entity ────────────────────────────────────────────────

interface TankEntity {
  id: string;
  transform: { position: Vec2; rotation: number };
  velocity: { velocity: Vec2; speed: number };
  turret: { aimAngle: number };
  health: { hp: number; maxHp: number; isAlive: boolean };
  tankState: { current: TankState; enteredAt: number; durationMs: number };
  /** Attacks per second (e.g., 2.5 = fires every 400ms) */
  attackSpeed: number;
  /** Time since last shot in ms */
  fireCooldownMs: number;
  cooldowns: {
    skillE: { cooldownMs: number; remainingMs: number; isReady: boolean };
    skillSpace: { cooldownMs: number; remainingMs: number; isReady: boolean };
  };
  combatStats: {
    atkP: number; atkE: number; defP: number; defE: number;
    defPConstant: number; defEConstant: number; spdM: number;
    projectileSpeed: number;
  };
  collider: { halfWidth: number; halfHeight: number };
  hover: boolean;
}

// ─── Projectile Entity ─────────────────────────────────────────

interface ProjectileEntity {
  id: string;
  transform: { position: Vec2; rotation: number };
  velocity: { velocity: Vec2; speed: number };
  projectile: {
    projectileType: string; ownerId: string;
    damage: number; damageChannel: string;
    piercing: boolean; maxRange: number;
    distanceTraveled: number; phase: ProjectilePhase;
  };
}

let nextProjId = 0;

// ═══════════════════════════════════════════════════════════════════
// MAP: 40x30 grid = 1280×960 pixels (world bounds)
// map_bg.png extends beyond this for visual clarity
// ═══════════════════════════════════════════════════════════════════

function createArenaMap(): GameMap {
  return loadCollisionMap(ARCTIC_COLLISION);
}

// ─── Dummy Target ───────────────────────────────────────────────

function createDummy(x: number, y: number, id: string): TankEntity {
  return {
    id,
    transform: { position: { x, y }, rotation: 0 },
    velocity: { velocity: { x: 0, y: 0 }, speed: 0 },
    turret: { aimAngle: 0 },
    health: { hp: 3000, maxHp: 3000, isAlive: true },
    tankState: { current: TankState.Idle, enteredAt: 0, durationMs: 0 },
    attackSpeed: 0,
    fireCooldownMs: 0,
    cooldowns: {
      skillE: { cooldownMs: 0, remainingMs: 0, isReady: false },
      skillSpace: { cooldownMs: 0, remainingMs: 0, isReady: false },
    },
    combatStats: { atkP: 0, atkE: 0, defP: 80, defE: 60, defPConstant: 400, defEConstant: 350, spdM: 0, projectileSpeed: 0 },
    collider: { halfWidth: 0.55, halfHeight: 0.65 },
    hover: false,
  };
}

// ═══════════════════════════════════════════════════════════════════

export class LocalGameState {
  private map: GameMap;
  private player: TankEntity;
  private dummies: TankEntity[];
  private projectiles: ProjectileEntity[] = [];
  /** Queue of grid positions where walls were destroyed this frame */
  private destroyedTiles: { col: number; row: number }[] = [];

  constructor() {
    this.map = createArenaMap();

    // Player tank — Iron Man (Hover/ADC)
    this.player = {
      id: 'player',
      transform: { position: { x: 5, y: 5 }, rotation: 0 },
      velocity: { velocity: { x: 0, y: 0 }, speed: 0 },
      turret: { aimAngle: 0 },
      health: { hp: 3200, maxHp: 3200, isAlive: true },
      tankState: { current: TankState.Idle, enteredAt: 0, durationMs: 0 },
      // 2.5 attacks per second = fires every 400ms
      attackSpeed: 2.5,
      fireCooldownMs: 0,
      cooldowns: {
        skillE: { cooldownMs: 9000, remainingMs: 0, isReady: true },
        skillSpace: { cooldownMs: 42000, remainingMs: 0, isReady: true },
      },
      combatStats: { atkP: 180, atkE: 220, defP: 80, defE: 120, defPConstant: 400, defEConstant: 350, spdM: 8, projectileSpeed: 50 },
      collider: { halfWidth: 0.55, halfHeight: 0.65 },
      hover: true, // Iron Man hovers over water
    };

    // Spread dummy targets across the 40×30 map
    this.dummies = [
      createDummy(12, 8, 'dummy_1'),
      createDummy(20, 15, 'dummy_2'),
      createDummy(28, 12, 'dummy_3'),
      createDummy(10, 22, 'dummy_4'),
      createDummy(32, 25, 'dummy_5'),
    ];
  }

  getMap(): GameMap { return this.map; }
  getPlayerEntity(): TankEntity { return this.player; }
  getProjectiles(): ProjectileEntity[] { return this.projectiles; }
  getDummies(): TankEntity[] { return this.dummies; }

  /** Drain and return destroyed tile positions (call once per frame) */
  drainDestroyedTiles(): { col: number; row: number }[] {
    const result = this.destroyedTiles;
    this.destroyedTiles = [];
    return result;
  }

  processInput(input: LocalInput): void {
    if (!this.player.health.isAlive) return;

    // ─── Turret always tracks mouse ─────────────────────────
    this.player.turret.aimAngle = input.aimAngle as number;

    // ─── Movement (free, not grid-locked) ───────────────────
    const blocked = this.player.tankState.current === TankState.Stunned ||
                    this.player.tankState.current === TankState.Dead;

    if (input.moveDir && !blocked) {
      const dir = input.moveDir;
      const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
      if (mag > 0) {
        this.player.velocity.velocity = {
          x: (dir.x / mag) * this.player.combatStats.spdM,
          y: (dir.y / mag) * this.player.combatStats.spdM,
        };
        this.player.transform.rotation = Math.atan2(dir.y, dir.x);
      }
    } else {
      this.player.velocity.velocity = { x: 0, y: 0 };
    }

    // ─── Fire (hold LMB = continuous fire based on attackSpeed) ─
    if (input.fire && this.player.fireCooldownMs <= 0) {
      this.spawnProjectile();
      // fireDelay = 1000 / attackSpeed
      this.player.fireCooldownMs = 1000 / this.player.attackSpeed;
    }
  }

  tick(dt: number): void {
    // ─── Player movement ────────────────────────────────────
    this.player.transform.position = {
      x: this.player.transform.position.x + this.player.velocity.velocity.x * (dt / 1000),
      y: this.player.transform.position.y + this.player.velocity.velocity.y * (dt / 1000),
    };
    this.resolveCollision(this.player);

    // ─── Fire cooldown ──────────────────────────────────────
    if (this.player.fireCooldownMs > 0) {
      this.player.fireCooldownMs -= dt;
    }

    // ─── Skill cooldowns ────────────────────────────────────
    const cd = this.player.cooldowns;
    if (cd.skillE.remainingMs > 0) {
      cd.skillE.remainingMs = Math.max(0, cd.skillE.remainingMs - dt);
      cd.skillE.isReady = cd.skillE.remainingMs <= 0;
    }
    if (cd.skillSpace.remainingMs > 0) {
      cd.skillSpace.remainingMs = Math.max(0, cd.skillSpace.remainingMs - dt);
      cd.skillSpace.isReady = cd.skillSpace.remainingMs <= 0;
    }

    // ─── Projectiles ────────────────────────────────────────
    this.updateProjectiles(dt);

    // ─── Dummy respawn after 5s ─────────────────────────────
    for (const dummy of this.dummies) {
      if (!dummy.health.isAlive) {
        dummy.tankState.durationMs += dt;
        if (dummy.tankState.durationMs >= 5000) {
          dummy.health.hp = dummy.health.maxHp;
          dummy.health.isAlive = true;
          dummy.tankState.current = TankState.Idle;
          dummy.tankState.durationMs = 0;
        }
      }
    }
  }

  // ─── Projectile spawning (infinite, attackSpeed-gated) ──────

  private spawnProjectile(): void {
    const angle = this.player.turret.aimAngle;
    const speed = this.player.combatStats.projectileSpeed;
    const spawnDist = 0.7;

    // GDD §3 Iron Man: Damage = 80% ATK_P + 20% ATK_E (Mixed)
    const damage = this.player.combatStats.atkP * 0.80 + this.player.combatStats.atkE * 0.20;

    const proj: ProjectileEntity = {
      id: `proj_${nextProjId++}`,
      transform: {
        position: {
          x: this.player.transform.position.x + Math.cos(angle) * spawnDist,
          y: this.player.transform.position.y + Math.sin(angle) * spawnDist,
        },
        rotation: angle,
      },
      velocity: {
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        speed,
      },
      projectile: {
        projectileType: 'ironman',
        ownerId: this.player.id,
        damage,
        damageChannel: 'Mixed',
        piercing: false,
        maxRange: 20,
        distanceTraveled: 0,
        phase: ProjectilePhase.Active,
      },
    };
    this.projectiles.push(proj);
  }

  // ─── Projectile physics + hit detection ─────────────────────

  private updateProjectiles(dt: number): void {
    const dtSec = dt / 1000;
    const toRemove: number[] = [];

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i]!;
      const pc = proj.projectile;
      if (pc.phase !== ProjectilePhase.Active) { toRemove.push(i); continue; }

      // Move
      proj.transform.position = {
        x: proj.transform.position.x + proj.velocity.velocity.x * dtSec,
        y: proj.transform.position.y + proj.velocity.velocity.y * dtSec,
      };
      pc.distanceTraveled += proj.velocity.speed * dtSec;

      // Range check
      if (pc.distanceTraveled >= pc.maxRange) { pc.phase = ProjectilePhase.Expired; toRemove.push(i); continue; }

      // Wall collision
      const col = Math.floor(proj.transform.position.x);
      const row = Math.floor(proj.transform.position.y);
      const tile = this.map.tiles[row]?.[col];
      if (tile) {
        if (tile.type === TileType.SteelWall || tile.type === TileType.SteelBox) {
          pc.phase = ProjectilePhase.Hit; toRemove.push(i); continue;
        }
        if (tile.type === TileType.BrickWall && !tile.destroyed) {
          tile.hp -= pc.damage;
          if (tile.hp <= 0) {
            tile.destroyed = true;
            this.destroyedTiles.push({ col, row });
            (this.map.tiles[row] as TileDefinition[])[col] = { type: TileType.Ground };
          }
          pc.phase = ProjectilePhase.Hit; toRemove.push(i); continue;
        }
        if (tile.type === TileType.WoodBox && !tile.destroyed) {
          tile.hp -= pc.damage;
          if (tile.hp <= 0) {
            tile.destroyed = true;
            this.destroyedTiles.push({ col, row });
            (this.map.tiles[row] as TileDefinition[])[col] = { type: TileType.Ground };
          }
          pc.phase = ProjectilePhase.Hit; toRemove.push(i); continue;
        }
      }

      // Hit dummies (circle collision)
      for (const dummy of this.dummies) {
        if (!dummy.health.isAlive) continue;
        const dx = proj.transform.position.x - dummy.transform.position.x;
        const dy = proj.transform.position.y - dummy.transform.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.6) {
          // GDD §2 damage formula: Actual = Raw * (1 - DEF / (DEF + DEF_CONSTANT))
          const rawDmg = pc.damage;
          const defP = dummy.combatStats.defP;
          const defConst = dummy.combatStats.defPConstant;
          const actual = rawDmg * (1 - defP / (defP + defConst));
          dummy.health.hp = Math.max(0, dummy.health.hp - actual);
          if (dummy.health.hp <= 0) {
            dummy.health.isAlive = false;
            dummy.tankState.current = TankState.Dead;
            dummy.tankState.durationMs = 0;
          }
          pc.phase = ProjectilePhase.Hit; toRemove.push(i); break;
        }
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.projectiles.splice(toRemove[i]!, 1);
    }
  }

  // ─── AABB collision with map tiles ──────────────────────────

  private resolveCollision(tank: TankEntity): void {
    const pos = tank.transform.position;
    const hw = tank.collider.halfWidth;
    const hh = tank.collider.halfHeight;

    const minCol = Math.floor(pos.x - hw);
    const maxCol = Math.floor(pos.x + hw);
    const minRow = Math.floor(pos.y - hh);
    const maxRow = Math.floor(pos.y + hh);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = this.map.tiles[row]?.[col];
        if (!tile) { this.pushOut(tank, col, row); continue; }
        if (tile.type === TileType.SteelWall || tile.type === TileType.SteelBox) {
          this.pushOut(tank, col, row);
        } else if (tile.type === TileType.BrickWall && !tile.destroyed) {
          this.pushOut(tank, col, row);
        } else if (tile.type === TileType.WoodBox && !tile.destroyed) {
          this.pushOut(tank, col, row);
        } else if (tile.type === TileType.Water && !tank.hover) {
          this.pushOut(tank, col, row);
        }
      }
    }
  }

  private pushOut(tank: TankEntity, tileCol: number, tileRow: number): void {
    const pos = tank.transform.position;
    const hw = tank.collider.halfWidth;
    const hh = tank.collider.halfHeight;
    const tcx = tileCol + 0.5;
    const tcy = tileRow + 0.5;
    const dx = pos.x - tcx;
    const dy = pos.y - tcy;
    const overlapX = (hw + 0.5) - Math.abs(dx);
    const overlapY = (hh + 0.5) - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return;
    if (overlapX < overlapY) {
      tank.transform.position = { x: pos.x + (dx > 0 ? overlapX : -overlapX), y: pos.y };
    } else {
      tank.transform.position = { x: pos.x, y: pos.y + (dy > 0 ? overlapY : -overlapY) };
    }
  }
}
