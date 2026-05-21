import { EntityManager } from '../engine/EntityManager';
import { EvolutionSystem } from '../engine/systems/EvolutionSystem';
import { TankId, TeamId, type EntityId, type PlayerId } from '@bang-bang/shared';
import { TANK_ROSTER } from '../data/tank-roster';

function createMockTank(em: EntityManager, tankId: TankId, playerId: string, team: TeamId) {
  const entity = em.create('tank');
  const def = TANK_ROSTER[tankId];
  
  entity.tankIdentity = {
    tankId,
    playerId: playerId as PlayerId,
    team,
    hover: def.hover,
    hitboxRadius: def.hitboxRadius,
  };
  entity.health = { hp: def.attributes.hp, maxHp: def.attributes.hp, isAlive: true };
  entity.attackTiming = {
    attackSpeed: def.attributes.attackSpeed,
    fireIntervalMs: 1000 / def.attributes.attackSpeed,
    lastFireElapsedMs: 0,
  };
  entity.combatStats = {
    atk: def.attributes.atk,
    range: def.attributes.range,
    defP: def.attributes.defP,
    defE: def.attributes.defE,
    attackSpeed: def.attributes.attackSpeed,
    speed: def.attributes.speed as number,
  };
  entity.collider = { radius: def.hitboxRadius / 32, isStatic: false };
  entity.evolution = { level: 1, currentExp: 0, expToNextLevel: 100 };
  entity.recentDamage = [];

  return entity;
}

function runTests() {
  console.log('[Evolution Test] Starting Evolution System unit tests...');
  const em = new EntityManager();
  const evolutionSystem = new EvolutionSystem();

  // Test 1: Passive EXP Tick
  console.log(' - Test 1: Passive EXP Tick...');
  const player1 = createMockTank(em, TankId.IronMan, 'player_1', TeamId.Red);
  
  // Update by 10 seconds. Expect 20 EXP (2 EXP per second)
  evolutionSystem.update(em, 10000);
  
  if (!player1.evolution || player1.evolution.currentExp !== 20) {
    throw new Error(`Expected currentExp to be 20, but got ${player1.evolution?.currentExp}`);
  }
  console.log('   PASSED');

  // Test 2: Level up trigger and scaling
  console.log(' - Test 2: Level up trigger and scaling...');
  const baseDef = TANK_ROSTER[TankId.IronMan];
  
  // Award 100 EXP -> Should trigger level 2 (threshold for level 2 is 100)
  player1.evolution.currentExp = 100;
  
  // Damage player 1 so we can verify if level up fully heals
  if (player1.health) {
    player1.health.hp = 1000;
  }
  
  evolutionSystem.update(em, 0);

  const levelVal = player1.evolution.level as number;
  if (levelVal !== 2) {
    throw new Error(`Expected level to be 2, but got ${levelVal}`);
  }

  // Level 2 expects STAT_SCALE[1] = 1.1x and HITBOX_SCALE[1] = 1.05x
  const expectedHp = Math.floor(baseDef.attributes.hp * 1.1);
  if (!player1.health || player1.health.maxHp !== expectedHp) {
    throw new Error(`Expected maxHp to be scaled to ${expectedHp}, but got ${player1.health?.maxHp}`);
  }
  if (player1.health.hp !== expectedHp) {
    throw new Error(`Expected level-up to fully heal tank to ${expectedHp}, but got ${player1.health.hp}`);
  }

  const expectedAtk = Math.floor(baseDef.attributes.atk * 1.1);
  if (player1.combatStats?.atk !== expectedAtk) {
    throw new Error(`Expected atk to be scaled to ${expectedAtk}, but got ${player1.combatStats?.atk}`);
  }

  const expectedRadius = (baseDef.hitboxRadius / 32) * 1.05;
  if (Math.abs((player1.collider?.radius ?? 0) - expectedRadius) > 0.0001) {
    throw new Error(`Expected collider radius to be ${expectedRadius}, but got ${player1.collider?.radius}`);
  }

  // Check attack timing fire interval
  const expectedAttackSpeed = baseDef.attributes.attackSpeed * 1.1;
  const expectedFireInterval = 1000 / expectedAttackSpeed;
  if (Math.abs((player1.attackTiming?.fireIntervalMs ?? 0) - expectedFireInterval) > 0.0001) {
    throw new Error(`Expected fireIntervalMs to be ${expectedFireInterval}, but got ${player1.attackTiming?.fireIntervalMs}`);
  }
  
  console.log('   PASSED');

  // Test 3: Multiple Level up trigger
  console.log(' - Test 3: Multiple level ups up to max Level 5...');
  // Max Level threshold is 900 for Level 5
  player1.evolution.currentExp = 1000;
  evolutionSystem.update(em, 0);

  const finalLevelVal = player1.evolution.level as number;
  if (finalLevelVal !== 5) {
    throw new Error(`Expected level to be 5, but got ${finalLevelVal}`);
  }
  console.log('   PASSED');

  console.log('[Evolution Test] All unit tests PASSED successfully!');
}

try {
  runTests();
  process.exit(0);
} catch (error) {
  console.error('[Evolution Test] Test failed:', error);
  process.exit(1);
}
