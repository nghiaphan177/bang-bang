// ═══════════════════════════════════════════════════════════════════
// tank-roster.ts — Concrete stat data for all 4 tanks
// Stats: hp, atk, range, defP, defE, attackSpeed, speed
// 3 Skill Slots: Attack(LMB), E, Space
// ═══════════════════════════════════════════════════════════════════

import {
  TankId,
  TankRole,
  type TankRosterMap,
} from '../types/tank';
import {
  SkillSlot,
  TargetingType,
  ProjectileArchetype,
  DamageChannel,
} from '../types/skills';
import type { GridUnits, Seconds } from '../types/core';

export const TANK_ROSTER: TankRosterMap = {
  // ─── IRON MAN (Hover/ADC) ─────────────────────────────────────
  [TankId.IronMan]: {
    id: TankId.IronMan,
    name: 'Iron Man',
    role: TankRole.HoverADC,
    hover: true,
    hitboxRadius: 18,
    attributes: {
      hp: 3200,
      atk: 200,
      range: 384,    // 12 grids * 32px
      defP: 80,
      defE: 120,
      attackSpeed: 2.5,
      speed: 8 as GridUnits,
      projectileSpeed: 50,
    },
    passive: {
      name: 'Repulsor Flight',
      description: 'Hover=True. If Time_Since_Last_Attack > 5s -> SPD += 15%. Crit Rate +10%.',
    },
    attack: {
      slot: SkillSlot.Attack,
      name: 'Repulsor Beam',
      cooldownSec: 0 as Seconds,
      archetype: ProjectileArchetype.Linear,
      targetingType: TargetingType.Linear,
      range: 384,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 1.0,
        channel: DamageChannel.Energy,
      },
      effects: [],
    },
    skillE: {
      slot: SkillSlot.E,
      name: 'Micro-Missiles',
      cooldownSec: 9 as Seconds,
      archetype: ProjectileArchetype.Homing,
      targetingType: TargetingType.Homing,
      range: 320,
      damageFormula: {
        baseDamage: 120,
        atkScaling: 0,
        channel: DamageChannel.Physical,
      },
      effects: [],
    },
    skillSpace: {
      slot: SkillSlot.Space,
      name: 'Unibeam',
      cooldownSec: 42 as Seconds,
      archetype: ProjectileArchetype.Hitscan,
      targetingType: TargetingType.Linear,
      range: 999,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 3.50,
        channel: DamageChannel.Energy,
      },
      effects: [
        { effectType: 'BURN', durationSec: 4 as Seconds, magnitude: 0.02 },
      ],
      castTimeSec: 1.2 as Seconds,
      ignoresWalls: true,
      rootSelfDuringCast: true,
    },
  },

  // ─── NARUTO (Assassin) ────────────────────────────────────────
  [TankId.Naruto]: {
    id: TankId.Naruto,
    name: 'Naruto',
    role: TankRole.Assassin,
    hover: false,
    hitboxRadius: 16,
    attributes: {
      hp: 2800,
      atk: 260,
      range: 256,    // 8 grids
      defP: 60,
      defE: 50,
      attackSpeed: 2.0,
      speed: 7 as GridUnits,
      projectileSpeed: 40,
    },
    passive: {
      name: 'Nine-Tails Rage',
      description: 'IF HP < 35% -> ATK +25%, SPD +30%, True Damage. 6s. CD 90s. Crit Rate +15%, Crit Damage 2.0.',
    },
    attack: {
      slot: SkillSlot.Attack,
      name: 'Boomerang Shuriken',
      cooldownSec: 0 as Seconds,
      archetype: ProjectileArchetype.Bouncing,
      targetingType: TargetingType.Linear,
      range: 256,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 1.05,
        channel: DamageChannel.Physical,
      },
      effects: [],
      maxBounces: 1,
    },
    skillE: {
      slot: SkillSlot.E,
      name: 'Shadow Clone',
      cooldownSec: 14 as Seconds,
      archetype: ProjectileArchetype.Dash,
      targetingType: TargetingType.Self,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 0,
        channel: DamageChannel.Physical,
      },
      effects: [],
    },
    skillSpace: {
      slot: SkillSlot.Space,
      name: 'Rasengan',
      cooldownSec: 38 as Seconds,
      archetype: ProjectileArchetype.Dash,
      targetingType: TargetingType.Dash,
      range: 224,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 4.00,
        channel: DamageChannel.Physical,
      },
      effects: [
        { effectType: 'STUN', durationSec: 1.8 as Seconds },
      ],
    },
  },

  // ─── SPIDER-MAN (Support/CC) ──────────────────────────────────
  [TankId.SpiderMan]: {
    id: TankId.SpiderMan,
    name: 'Spider-Man',
    role: TankRole.SupportCC,
    hover: false,
    hitboxRadius: 17,
    attributes: {
      hp: 3000,
      atk: 150,
      range: 288,    // 9 grids
      defP: 90,
      defE: 100,
      attackSpeed: 2.2,
      speed: 6.5 as GridUnits,
      projectileSpeed: 42,
    },
    passive: {
      name: 'Spider-Sense',
      description: 'IF Enemy(Stealth) in 12 Grids -> Warning UI. Crit Rate +5%.',
    },
    attack: {
      slot: SkillSlot.Attack,
      name: 'Web Pellet',
      cooldownSec: 0 as Seconds,
      archetype: ProjectileArchetype.Linear,
      targetingType: TargetingType.Linear,
      range: 288,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 0.85,
        channel: DamageChannel.Physical,
      },
      effects: [],
    },
    skillE: {
      slot: SkillSlot.E,
      name: 'Web Pull',
      cooldownSec: 12 as Seconds,
      archetype: ProjectileArchetype.Linear,
      targetingType: TargetingType.Linear,
      range: 320,
      damageFormula: {
        baseDamage: 150,
        atkScaling: 0,
        channel: DamageChannel.Physical,
      },
      effects: [
        { effectType: 'STUN', durationSec: 0.5 as Seconds },
      ],
    },
    skillSpace: {
      slot: SkillSlot.Space,
      name: 'Web Prison',
      cooldownSec: 40 as Seconds,
      archetype: ProjectileArchetype.Lob,
      targetingType: TargetingType.Parabolic,
      range: 352,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 0,
        channel: DamageChannel.Physical,
      },
      effects: [
        { effectType: 'ROOT', durationSec: 2 as Seconds },
        { effectType: 'SLOW', durationSec: 7 as Seconds, magnitude: 0.60 },
      ],
      airTime: 1.0 as Seconds,
    },
  },

  // ─── THÁNH GIÓNG (Tanker/Bruiser) ────────────────────────────
  [TankId.ThanhGiong]: {
    id: TankId.ThanhGiong,
    name: 'Thánh Gióng',
    role: TankRole.TankerBruiser,
    hover: false,
    hitboxRadius: 22,
    attributes: {
      hp: 5000,
      atk: 200,
      range: 128,    // 4 grids (short range melee/flame)
      defP: 150,
      defE: 100,
      attackSpeed: 1.5,
      speed: 5.5 as GridUnits,
      projectileSpeed: 30,
    },
    passive: {
      name: 'Iron Bamboo Armor',
      description: 'Reduce incoming damage by 40% if source > 8 Grids away.',
    },
    attack: {
      slot: SkillSlot.Attack,
      name: 'Flamethrower',
      cooldownSec: 0 as Seconds,
      archetype: ProjectileArchetype.Piercing,
      targetingType: TargetingType.Hold,
      range: 128,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 0.25,
        channel: DamageChannel.Energy,
      },
      effects: [],
    },
    skillE: {
      slot: SkillSlot.E,
      name: 'Charge',
      cooldownSec: 13 as Seconds,
      archetype: ProjectileArchetype.Dash,
      targetingType: TargetingType.Dash,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 0,
        channel: DamageChannel.Physical,
      },
      effects: [
        { effectType: 'STUN', durationSec: 0.5 as Seconds },
      ],
    },
    skillSpace: {
      slot: SkillSlot.Space,
      name: 'Bamboo Sweep',
      cooldownSec: 50 as Seconds,
      archetype: ProjectileArchetype.Hitscan,
      targetingType: TargetingType.PointBlank,
      range: 160,
      damageFormula: {
        baseDamage: 0,
        atkScaling: 3.80,
        channel: DamageChannel.Physical,
      },
      effects: [
        { effectType: 'SLOW', durationSec: 5 as Seconds, magnitude: 0.30 },
      ],
    },
  },
};
