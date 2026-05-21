# 💥 IMPLEMENTATION PLAN — Bang Bang CMM Remake

> **Purpose:** This is the living project plan. Any AI agent starting work on this project should read this file AFTER `AGENT_CONTEXT.md` to understand what's done, what's next, and pick up a task.
>
> **Last updated:** 2026-05-21
>
> **How to use:** Find the first `[ ]` task that has all its dependencies marked `[x]`. Do that task. When done, mark it `[x]` and commit this file.

---

## 📊 PROJECT STATUS OVERVIEW

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Foundation | ✅ DONE | Monorepo, shared types (11 files), TypeScript strict |
| Phase 2: Local Prototype | ✅ DONE | Phaser 3 client (legacy, previously in `packages/client/`, now deleted) |
| Phase 3: Networking | ✅ DONE | WebSocketServer, Room (60Hz), InputBuffer, ClientPrediction, EntityInterpolation |
| Phase 4: Match Lifecycle | ✅ DONE | Waiting→Countdown→Playing→MatchEnd, kill/death tracking, 5s respawn |
| Phase 5: Collision Map | ✅ DONE | Arctic map, box tiles, minimap |
| Phase 6: Cocos Migration | ✅ DONE | All client tasks complete — see task list below |
| Phase 7: Skill Systems | ❌ NOT STARTED | Dash, Hitscan, Homing, Lob execution |
| Phase 8: Evolution | ❌ NOT STARTED | EXP, levels, stat scaling |
| Phase 9: Game Modes | ❌ NOT STARTED | TDM complete, Base Destroy, CTF |
| Phase 10: PVE | ❌ NOT STARTED | Mob AI, wave system, boss fights |

---

## 🔍 CURRENT GAPS (What Looks Done But Isn't)

> **CRITICAL:** Read this section carefully. Some systems appear complete but have major gaps.

### Gap 1: Skills Don't Fire (Server)
`Room.ts` line 643-647 explicitly **skips** Dash and Hitscan archetypes in `spawnProjectilesForFiringTanks()`. Skills E and Space are never checked for cooldown or activation. **Only basic attacks with Linear/Bouncing/Piercing projectiles actually work.**

### Gap 2: UI Exists But Is Never Wired (Client)
`HUDController.ts`, `MatchOverlayController.ts`, `MinimapController.ts` exist as classes with proper methods, but **GameManager never creates or calls them**. No HUD, no countdown, no score display.

### Gap 3: GameManager Is a 500-line God Object (Client)
`GameManager.ts` does everything: scene building, material caching, collision map spawning, networking, prediction, interpolation, rendering, camera follow, projectile rendering. Must be decomposed before other client work.

### Gap 4: Match State Ignored (Client)
Server sends `matchState` in every snapshot (phase, countdown, timer, scores). Client's `onSnapshot()` never reads it.

### Gap 5: Team Not Used (Client)
All remote tanks rendered as red. `TeamId` from snapshot is ignored.

---

## 📋 TASK LIST

### Legend
- `[ ]` — Not started
- `[/]` — In progress
- `[x]` — Complete
- `[B]` — Blocked (see notes)
- **Deps:** — Tasks that must be `[x]` before starting this one

---

### Work Stream 1: Client — GameManager Decomposition

#### Task 1.1 — Extract SceneBuilder from GameManager
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🔴 P0
- **Effort:** Small (1-2 hours)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts`
  - NEW: `packages/client-cocos/bangbang/assets/scripts/game/SceneBuilder.ts`

**What to do:**
1. Create a plain TypeScript class `SceneBuilder` (NOT a Cocos Component — design decision confirmed by user).
2. Move from GameManager into SceneBuilder:
   - All `COL_*` color constants
   - `matCache` map and `makeMat()` method
   - `buildScene()` method
   - `createTankNode()` method
   - `spawnCollisionMap()` method
   - `loadMapBgTexture()` and `applyMapTexture()` methods
3. `SceneBuilder.build(rootNode: Node)` should return a typed struct:
   ```typescript
   interface SceneRefs {
     gameCamera: Camera;
     inputManager: InputManager;
     mapController: MapController;
     projectileController: ProjectileController;
     playerTankController: TankController;
     remoteTanksContainer: Node;
     // Add HUD/UI refs when Task 1.2 is done
   }
   ```
4. GameManager.start() calls `new SceneBuilder().build(this.node)` and stores the references.
5. `createTankNode()` must remain accessible (used by `renderRemotes()` for dynamic remote tank creation). Either expose it as a public method on SceneBuilder, or pass a factory function.

**Acceptance:** GameManager drops to ~250 lines. SceneBuilder handles all scene construction. Game still runs identically.

---

#### Task 1.2 — Wire HUD, MatchOverlay, and Minimap into GameManager
- **Status:** `[x]`
- **Deps:** Task 1.1
- **Priority:** 🟠 P1
- **Effort:** Medium (2-3 hours)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts`
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/SceneBuilder.ts` (add UI node creation)
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/ui/HUDController.ts`

**What to do:**
1. In SceneBuilder, create a 2D Canvas node hierarchy:
   ```
   UICanvas (Canvas component, renderMode: OVERLAY)
   ├── HUD (Node)
   │   ├── HPBar (ProgressBar)
   │   ├── HPLabel (Label)
   │   ├── PingLabel (Label)
   │   ├── ModeLabel (Label)
   │   ├── PlayerCountLabel (Label)
   │   ├── MatchTimerLabel (Label)
   │   └── ScoreLabel (Label)
   ├── MatchOverlay (Node)
   │   ├── CountdownLabel (Label, fontSize: 72, bold)
   │   ├── ResultsPanel (Node, default inactive)
   │   │   ├── ResultsTitleLabel (Label)
   │   │   └── ResultsDetailsLabel (Label)
   └── MinimapContainer (Node, anchored bottom-right)
       └── MinimapGraphics (Graphics component)
   ```
2. Attach the controller components and wire `@property` references programmatically.
3. In GameManager `update()`, add these calls:
   ```typescript
   // HUD
   this.hudController?.updateHP(hp, maxHp);
   this.hudController?.updateNetworkStatus(
     this.networkClient?.getRTT() ?? 0,
     this.mode,
     this.latestSnapshot?.tanks.length ?? 0
   );
   // Minimap
   this.minimapController?.updateEntities(
     this.prediction!.position,
     remotes.map(e => ({ x: e.position.x, y: e.position.y, isAlly: false }))
   );
   ```
4. In `onSnapshot()`:
   ```typescript
   const ms = snapshot.matchState;
   if (ms) {
     if (ms.phase === 'Countdown') this.matchOverlay?.showCountdown(ms.countdownSec);
     if (ms.phase === 'Playing') this.hudController?.updateMatchInfo(ms.matchTimeSec, ms.teamScores['Red'] ?? 0, ms.teamScores['Blue'] ?? 0);
     if (ms.phase === 'MatchEnd') this.matchOverlay?.showResults(ms.winnerId, ms.scores);
   }
   ```

**Acceptance:** HP bar visible. Ping displayed. Countdown plays 3-2-1-GO. Score and timer show during match. Results appear on match end. Minimap shows dots.

---

### Work Stream 2: Server — Skill Execution

#### Task 2.1 — Implement Skill E/Space Activation in Room.ts
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🔴 P0
- **Effort:** Medium (2-3 hours)
- **Files:**
  - MODIFY: `packages/server/src/network/Room.ts`

**What to do:**
1. Add `processSkillActivations(dt: number)` method in Room.ts.
2. Call it in `tickPlaying()` between `applyInputs()` and `spawnProjectilesForFiringTanks()`.
3. Logic for each tank entity:
   ```
   IF input.skillE === true AND cooldowns.skillE.isReady AND tankState !== Stunned/Dead:
     → Read TANK_ROSTER[tankId].skillE
     → Based on archetype, delegate to system (see Tasks 2.2-2.5)
     → Set cooldowns.skillE.remainingMs = cooldowns.skillE.cooldownMs
     → Set cooldowns.skillE.isReady = false
   Same for input.skillSpace with cooldowns.skillSpace
   ```
4. Add cooldown tick in `tickPlaying()`:
   ```typescript
   // Tick cooldowns for all tanks
   for (const tank of em.getTanks()) {
     if (!tank.cooldowns) continue;
     if (!tank.cooldowns.skillE.isReady) {
       tank.cooldowns.skillE.remainingMs -= dt;
       if (tank.cooldowns.skillE.remainingMs <= 0) {
         tank.cooldowns.skillE.remainingMs = 0;
         tank.cooldowns.skillE.isReady = true;
       }
     }
     // Same for skillSpace
   }
   ```
5. Also tick `attackTiming.lastFireElapsedMs += dt` for all tanks (currently may not be happening).

**Acceptance:** Pressing E/Space consumes cooldown. Cooldown ticks down. Cooldown resets to ready when expired. Skills can't be used while stunned/dead or on cooldown.

---

#### Task 2.2 — Implement DashSystem + Clone Decoy (Naruto Shadow Clone)
- **Status:** `[x]`
- **Deps:** Task 2.1
- **Priority:** 🟠 P1
- **Effort:** Medium-Large (3-4 hours)
- **Files:**
  - NEW: `packages/server/src/engine/systems/DashSystem.ts`
  - MODIFY: `packages/server/src/engine/components.ts` (add `dashState` component)
  - MODIFY: `packages/server/src/network/Room.ts` (integrate DashSystem)

**What to do:**

There are 3 Dash-archetype skills with DIFFERENT behaviors:

**A. Naruto — Shadow Clone (E):** Clone decoy system (confirmed by user — NOT a pure dash)
1. When activated:
   - Spawn a **clone entity** at the player's current position (looks like the player's tank)
   - Teleport the real player a short distance backward/sideways (opposite of aim direction)
   - Clone entity is a dummy that:
     - Moves forward slowly in the aim direction for 3 seconds
     - Has 1 HP (dies in one hit)
     - Appears as a normal tank to enemies (same `TankSnapshot` shape)
     - Auto-destroys after 3 seconds
   - Real player becomes briefly invisible (0.5s stealth window)
2. Add `clone` entity type to EntityManager or reuse `tank` type with a `isClone: true` flag
3. Clone appears in snapshots so enemies see it as a real tank

**B. Naruto — Rasengan (Space):** Dash + damage + stun on contact
1. Set `tankState.current = TankState.Dashing`
2. Dash forward in `turret.aimAngle` direction for 0.4 seconds at 3x normal speed
3. On collision with enemy tank during dash:
   - Apply damage: `baseDamage=0, atkScaling=4.0, channel=Physical`
   - Apply STUN 1.8 seconds
   - End dash immediately after hitting first enemy
4. During dash: immune to Slow, all input locked

**C. ThanhGiong — Charge (E):** Dash + stun on contact
1. Set `tankState.current = TankState.Dashing`
2. Dash forward in `hullRotation` direction (NOT turret) for 0.5 seconds at 2.5x speed
3. On collision with enemy: apply STUN 0.5s
4. During dash: immune to Slow, all input locked

**Common DashSystem logic:**
- Add `dashState` component to `GameEntity`:
  ```typescript
  dashState?: {
    isDashing: boolean;
    direction: { x: number; y: number };
    speed: number;
    remainingMs: number;
    dashType: 'rasengan' | 'charge' | 'clone';
    damagePayload?: number;
    damageChannel?: DamageChannel;
    onHitEffects?: StatusEffectDef[];
    hitEntities: Set<string>; // prevent multi-hit
  };
  ```
- DashSystem.update(): move tank along dash vector, check collision with enemies, expire dash

**Acceptance:** Naruto E creates a clone decoy + teleports player. Naruto Space dashes and stuns on hit. ThanhGiong E charges and stuns.

---

#### Task 2.3 — Implement HitscanSystem
- **Status:** `[x]`
- **Deps:** Task 2.1
- **Priority:** 🟠 P1
- **Effort:** Medium (2-3 hours)
- **Files:**
  - NEW: `packages/server/src/engine/systems/HitscanSystem.ts`
  - MODIFY: `packages/server/src/network/Room.ts` (integrate)
  - MODIFY: `packages/server/src/engine/components.ts` (add `castState` component)

**What to do:**

Two Hitscan skills exist:

**A. IronMan — Unibeam (Space):**
1. When activated: set `tankState = Casting`, `castState = { remainingMs: 1200 }`
2. During cast: `rootSelfDuringCast: true` → velocity forced to 0, movement input ignored
3. After 1.2s cast completes:
   - Raycast from tank position in `turret.aimAngle` direction
   - `ignoresWalls: true` → ray passes through walls
   - Hit ALL enemies along the ray within `range: 999` (effectively infinite)
   - For each hit: `damage = ATK * 3.50`, channel = Energy
   - Apply BURN effect: True Damage DoT for 4 seconds (2% ATK per tick)
4. Return to `tankState = Idle`

**B. ThanhGiong — Bamboo Sweep (Space):**
1. When activated (instant, no cast time):
   - `TargetingType.PointBlank` → AoE circle around self, radius = 160px (5 grids)
   - Check all enemies within radius
   - For each: `damage = ATK * 3.80`, channel = Physical
   - Apply SLOW 30% for 5 seconds
2. NOT actually a ray — it's a melee AoE. Despite archetype being "Hitscan", treat as instant AoE.

**Add `castState` component:**
```typescript
castState?: {
  isCasting: boolean;
  skillSlot: 'E' | 'Space';
  remainingMs: number;
  rootSelf: boolean;
};
```

**HitscanSystem.update():**
- Tick down castState.remainingMs
- When expires: execute the hitscan/AoE, clear castState, set tankState = Idle

**Acceptance:** IronMan Space channels 1.2s then fires beam line. ThanhGiong Space does instant AoE around self. Both apply correct damage + effects.

---

#### Task 2.4 — Implement Homing Projectile Logic
- **Status:** `[x]`
- **Deps:** Task 2.1
- **Priority:** 🟠 P1
- **Effort:** Medium (2 hours)
- **Files:**
  - MODIFY: `packages/server/src/engine/systems/ProjectileSystem.ts`
  - MODIFY: `packages/server/src/engine/components.ts` (extend projectile component)

**What to do:**

IronMan's Micro-Missiles (E) uses `ProjectileArchetype.Homing`.

1. Extend projectile component:
   ```typescript
   // Add to projectile component
   targetEntityId?: EntityId;
   turnRate?: number; // radians/sec, e.g. Math.PI * 2
   ```
2. When spawning a Homing projectile in Room.ts `processSkillActivations()`:
   - Find nearest enemy tank within skill range
   - Set `targetEntityId` to that enemy
   - Set initial velocity toward target
   - `turnRate = Math.PI * 2` (can turn 360°/sec — configurable)
   - Spawn 3 missiles with slight angle spread (e.g., -15°, 0°, +15°)
3. In `ProjectileSystem.update()`, for Homing projectiles:
   ```typescript
   if (proj.archetype === ProjectileArchetype.Homing && proj.targetEntityId) {
     const target = em.get(proj.targetEntityId);
     if (target?.transform && target?.health?.isAlive) {
       const desiredAngle = Math.atan2(
         target.transform.position.y - proj.transform.position.y,
         target.transform.position.x - proj.transform.position.x
       );
       const currentAngle = Math.atan2(proj.velocity.y, proj.velocity.x);
       let diff = desiredAngle - currentAngle;
       // Normalize to [-π, π]
       while (diff > Math.PI) diff -= 2 * Math.PI;
       while (diff < -Math.PI) diff += 2 * Math.PI;
       // Apply turn rate limit
       const maxTurn = turnRate * (dt / 1000);
       const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, diff));
       const newAngle = currentAngle + actualTurn;
       const speed = proj.velocity.speed;
       proj.velocity.velocity = { x: Math.cos(newAngle) * speed, y: Math.sin(newAngle) * speed };
     }
     // If target dead/gone, continue straight (no tracking)
   }
   ```
4. Homing projectiles still collide with walls and have max range.

**Acceptance:** IronMan E fires 3 homing missiles. Missiles curve toward target. Can be dodged if player moves fast enough.

---

#### Task 2.5 — Implement Lob Projectile Logic
- **Status:** `[x]`
- **Deps:** Task 2.1
- **Priority:** 🟠 P1
- **Effort:** Medium (2 hours)
- **Files:**
  - MODIFY: `packages/server/src/engine/systems/ProjectileSystem.ts`
  - MODIFY: `packages/server/src/engine/components.ts` (extend projectile component)

**What to do:**

SpiderMan's Web Prison (Space) uses `ProjectileArchetype.Lob`.

1. Extend projectile component:
   ```typescript
   // Add to projectile component
   targetPosition?: { x: number; y: number };
   airTimeMs?: number;
   airTimeRemainingMs?: number;
   aoeRadius?: number;
   aoeEffects?: StatusEffectDef[];
   ```
2. When spawning a Lob projectile:
   - Calculate `targetPosition` = point at `range` distance in `aimAngle` direction from tank
   - Set `airTimeMs = 1000` (1 second for Web Prison)
   - Set `airTimeRemainingMs = 1000`
   - Set `aoeRadius = 3` (grid units)
   - Store effects: ROOT 2s + SLOW 60% 7s
3. In ProjectileSystem.update(), for Lob:
   ```typescript
   if (proj.archetype === ProjectileArchetype.Lob) {
     proj.airTimeRemainingMs -= dt;
     // Move projectile toward target (visual only — it ignores all collisions)
     // Skip ALL collision checks for this projectile
     if (proj.airTimeRemainingMs <= 0) {
       // LAND: teleport to target position
       proj.transform.position = { ...proj.targetPosition };
       // Apply AoE effects to all enemies in radius
       for (const tank of em.getTanks()) {
         if (!tank.health?.isAlive) continue;
         if (tank.id === proj.ownerId) continue; // skip self
         const dist = distance(tank.transform.position, proj.targetPosition);
         if (dist <= proj.aoeRadius) {
           // Apply effects (ROOT, SLOW)
           applyStatusEffects(tank, proj.aoeEffects);
         }
       }
       proj.phase = ProjectilePhase.Expired;
     }
   }
   ```
4. The Lob projectile should NOT collide with walls or entities during flight.

**Acceptance:** SpiderMan Space lobs a projectile that ignores obstacles, lands after 1s, and applies ROOT + SLOW in area.

---

### Work Stream 3: Client — Match State & Team Awareness

#### Task 3.1 — Handle Match State from Snapshots
- **Status:** `[x]`
- **Deps:** Task 1.2
- **Priority:** 🟡 P2
- **Effort:** Small (1 hour)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts`

**What to do:**
1. In `onSnapshot()`, read `snapshot.matchState` (already typed in shared types as `MatchState`)
2. Switch on `matchState.phase`:
   - `WaitingForPlayers` → show waiting label via HUD
   - `Countdown` → `this.matchOverlay.showCountdown(matchState.countdownSec)`
   - `Playing` → `this.hudController.updateMatchInfo(matchState.matchTimeSec, teamScores.Red, teamScores.Blue)`
   - `MatchEnd` → `this.matchOverlay.showResults(matchState.winnerId, matchState.scores)`
3. During `MatchEnd` phase, optionally disable player input (set a flag, skip input in update())

**Acceptance:** Countdown animation plays. Timer and scores display. Match end results show.

---

#### Task 3.2 — Team-Aware Tank Coloring
- **Status:** `[x]`
- **Deps:** Task 1.2
- **Priority:** 🟡 P2
- **Effort:** Small (1 hour)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts` — `renderRemotes()`
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/rendering/TankController.ts` — add `setTeamColor()`

**What to do:**
1. `TankSnapshot` has a `team: TeamId` field. The local player's team is found from their own snapshot entry.
2. When creating remote tank nodes, determine if ally or enemy:
   ```typescript
   const myTeam = this.latestSnapshot.tanks.find(t => t.playerId === this.playerId)?.team;
   const isAlly = e.team === myTeam;
   ```
3. Pass appropriate colors to `createTankNode()`: allies → blue palette, enemies → red palette
4. Add `setTeamColor(hullColor: Color, turretColor: Color)` to `TankController` that swaps materials on MeshRenderer components.

**Acceptance:** Allies are blue, enemies are red, player is green.

---

#### Task 3.3 — Kill Feed UI
- **Status:** `[x]`
- **Deps:** None (independent)
- **Priority:** 🟡 P2
- **Effort:** Small (1-2 hours)
- **Files:**
  - NEW: `packages/client-cocos/bangbang/assets/scripts/ui/KillFeedController.ts`
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts` (wire it in)

**What to do:**
1. Create `KillFeedController` Cocos Component
2. Hook into `NetworkClient.onGameEvent()` (callback already exists but unused)
3. On kill event: create a Label with "🔫 {killerName} → {victimName}"
4. Animate: slide in from right, hold 4 seconds, fade out
5. Stack max 5 entries vertically
6. Use `cc.tween` for slide and fade animations

**Acceptance:** Kill notifications appear in top-right corner with smooth animations.

---

### Work Stream 4: Client — Skill Cooldown UI

#### Task 4.1 — Skill Cooldown Display
- **Status:** `[x]`
- **Deps:** Task 1.2
- **Priority:** 🟡 P2
- **Effort:** Medium (2 hours)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts`
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/ui/HUDController.ts`

**What to do:**
1. In GameManager, add local cooldown tracking:
   ```typescript
   private skillECooldownMs = 0;
   private skillEMaxCooldownMs = 9000; // load from roster based on selected tank
   private skillSpaceCooldownMs = 0;
   private skillSpaceMaxCooldownMs = 42000;
   ```
2. When `input.skillE === true` and `skillECooldownMs <= 0`: set `skillECooldownMs = skillEMaxCooldownMs`
3. Each frame: `skillECooldownMs = Math.max(0, skillECooldownMs - dt * 1000)`
4. In HUDController, add:
   ```typescript
   @property(ProgressBar) skillEBar: ProgressBar | null = null;
   @property(ProgressBar) skillSpaceBar: ProgressBar | null = null;
   @property(Label) skillELabel: Label | null = null;
   @property(Label) skillSpaceLabel: Label | null = null;

   updateSkillCooldowns(eRatio: number, spaceRatio: number, eSec: number, spaceSec: number): void {
     if (this.skillEBar) this.skillEBar.progress = 1 - eRatio; // fills up as cooldown expires
     if (this.skillSpaceBar) this.skillSpaceBar.progress = 1 - spaceRatio;
     if (this.skillELabel) this.skillELabel.string = eRatio > 0 ? `${Math.ceil(eSec)}s` : 'E';
     if (this.skillSpaceLabel) this.skillSpaceLabel.string = spaceRatio > 0 ? `${Math.ceil(spaceSec)}s` : 'SPACE';
   }
   ```
5. Create the skill slot UI nodes in SceneBuilder (two panels with ProgressBar + Label each)

**Acceptance:** Two skill indicators show cooldown progress. Shows remaining seconds when on CD. Bright when ready.

---

### Work Stream 5: VFX & Polish

> All tasks in this stream are **independent** — can be done in any order, in parallel.

#### Task 5.1 — Muzzle Flash VFX
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟢 P3
- **Effort:** Small (30 min)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/rendering/TankController.ts`

**What to do:**
1. Add `fireEffect()` method to TankController
2. Create a small temporary mesh (sphere, scale 0→3→0 over 0.1s) at turret barrel tip, color yellow/orange
3. Use `cc.tween` for the scale animation, then destroy the node
4. Call from GameManager when fire input is active and attack cooldown ready

**Acceptance:** Small flash appears at barrel tip on each shot.

---

#### Task 5.2 — Projectile Hit Explosion VFX
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟢 P3
- **Effort:** Small (30 min)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/rendering/ProjectileController.ts`

**What to do:**
1. When removing a projectile from `activeProjectiles` (it's no longer in the server snapshot):
   - Record its last position before recycling
   - Spawn a small sphere mesh at that position
   - `cc.tween`: scale 0→2 over 0.15s, then destroy. Color: orange→white
2. Pool these explosion nodes for performance

**Acceptance:** Small orange flash where projectiles expire.

---

#### Task 5.3 — Damage Flash
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟢 P3
- **Effort:** Small (30 min)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/rendering/TankController.ts`

**What to do:**
1. Track `lastKnownHp` in TankController
2. When `updateFromState()` receives lower HP:
   - Swap hull + turret MeshRenderer materials to a cached bright red material
   - `this.scheduleOnce(() => { swapBack() }, 0.1)`
3. Cache the red material to avoid creating new ones each hit

**Acceptance:** Tanks briefly flash red when hit.

---

#### Task 5.4 — Screen Shake on Damage
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟢 P3
- **Effort:** Small (20 min)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts`

**What to do:**
1. Track player HP from snapshot
2. When HP decreases, shake camera:
   ```typescript
   const cam = this.gameCamera.node;
   const intensity = Math.min(10, (hpLost / maxHp) * 30);
   tween(cam)
     .by(0.03, { position: new Vec3(intensity, 0, intensity * 0.6) })
     .by(0.03, { position: new Vec3(-intensity * 2, 0, -intensity * 1.2) })
     .by(0.03, { position: new Vec3(intensity, 0, intensity * 0.6) })
     .start();
   ```

**Acceptance:** Camera shakes when player takes damage. Larger hits = stronger shake.

---

#### Task 5.5 — Death & Respawn Animations
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟢 P3
- **Effort:** Small (30 min)
- **Files:**
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/rendering/TankController.ts`

**What to do:**
1. On alive→dead transition:
   - `tween(node).to(0.3, { scale: new Vec3(0.01, 0.01, 0.01) }).call(() => { node.active = false; }).start()`
   - Spawn explosion particles (reuse from Task 5.2 pattern, but larger)
2. On dead→alive transition:
   - `node.active = true; node.setScale(0.01, 0.01, 0.01);`
   - `tween(node).to(0.4, { scale: new Vec3(1, 1, 1) }).start()`
   - Invulnerability shimmer: toggle `node.active` every 100ms for 3 seconds

**Note:** Current code already has partial death/respawn in TankController lines 61-70, but it's basic. Enhance it.

**Acceptance:** Tank shrinks + explodes on death, grows back with shimmer on respawn.

---

### Work Stream 6: Server — Evolution System

#### Task 6.1 — Add EXP Tracking Component
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟡 P2
- **Effort:** Small (30 min)
- **Files:**
  - MODIFY: `packages/server/src/engine/components.ts`
  - MODIFY: `packages/server/src/network/Room.ts`

**What to do:**
1. Add to `GameEntity`:
   ```typescript
   evolution?: {
     level: number;        // 1-5
     currentExp: number;
     expToNextLevel: number;
   };
   ```
2. EXP thresholds (cumulative): `[100, 250, 500, 900]` (EXP needed to reach levels 2, 3, 4, 5)
3. In `addPlayer()`: `entity.evolution = { level: 1, currentExp: 0, expToNextLevel: 100 }`
4. Add `level` to the snapshot data for each tank (modify `TankSnapshot` type or add in snapshot serialization)

**Acceptance:** Every tank starts at Level 1 with EXP component. Level visible in snapshots.

---

#### Task 6.2 — Create EvolutionSystem
- **Status:** `[x]`
- **Deps:** Task 6.1
- **Priority:** 🟡 P2
- **Effort:** Medium (2 hours)
- **Files:**
  - NEW: `packages/server/src/engine/systems/EvolutionSystem.ts`
  - MODIFY: `packages/server/src/network/Room.ts` (integrate, call in tickPlaying)

**What to do:**
1. EXP award sources:
   - Passive: +2 EXP/second during Playing phase
   - Kill: +50 EXP (in `processDeaths()`)
   - Assist: +25 EXP (last damage within 5s, not killer)
   - WoodBox destroyed: +10 EXP
2. Level-up logic:
   ```typescript
   const STAT_SCALE = [1.0, 1.1, 1.25, 1.4, 1.6];
   const HITBOX_SCALE = [1.0, 1.05, 1.10, 1.15, 1.20];
   const EXP_THRESHOLDS = [100, 250, 500, 900];
   
   if (evo.currentExp >= evo.expToNextLevel && evo.level < 5) {
     evo.level++;
     evo.expToNextLevel = EXP_THRESHOLDS[evo.level - 2] ?? Infinity;
     // Apply stat scaling
     const baseDef = TANK_ROSTER[tankId].attributes;
     const scale = STAT_SCALE[evo.level - 1];
     entity.health.maxHp = Math.floor(baseDef.hp * scale);
     entity.health.hp = entity.health.maxHp; // full heal on level up
     entity.combatStats.atk = Math.floor(baseDef.atk * scale);
     // ... scale all 7 stats
     entity.collider.radius = (baseDef.hitboxRadius / 32) * HITBOX_SCALE[evo.level - 1];
   }
   ```
3. On level 3: unlock passive (future task — log it for now)

**Acceptance:** Tanks earn EXP over time and on kills. Level up triggers stat scaling and hitbox growth. Max level 5.

---

### Work Stream 7: Tank Selection & Lobby

#### Task 7.1 — Tank Selection UI
- **Status:** `[x]`
- **Deps:** None (independent but lower priority)
- **Priority:** 🟢 P3
- **Effort:** Medium (2-3 hours)
- **Files:**
  - NEW: `packages/client-cocos/bangbang/assets/scripts/ui/TankSelectionController.ts`
  - MODIFY: `packages/client-cocos/bangbang/assets/scripts/game/GameManager.ts`

**What to do:**
1. Create a full-screen 2D Canvas overlay showing 4 tank panels
2. Each panel: tank name, role text, 7 stat bars (use ProgressBar), small 3D preview
3. On click: store selected `tankId`, hide selection, proceed to connect
4. GameManager currently hardcodes `tankId: 'IronMan'` in line 266 — replace with selected value
5. Add a local tank roster data file for the client (subset of stats for display)

**Acceptance:** 4 tanks shown at start, clickable, selected tank used for join message.

---

### Work Stream 8: Build & Testing

#### Task 8.1 — Type-Check CI Scripts
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🔴 P0
- **Effort:** Small (15 min)
- **Files:**
  - MODIFY: `packages/package.json` (root)

**What to do:**
1. Add to root `package.json` scripts:
   ```json
   "check:shared": "tsc --project packages/shared/tsconfig.json --noEmit",
   "check:server": "tsc --project packages/server/tsconfig.json --noEmit",
   "check:all": "npm run build:shared && npm run check:server"
   ```
2. Run `npm run check:all` and fix any type errors found.

**Acceptance:** `npm run check:all` passes with zero errors.

---

#### Task 8.2 — Server Smoke Test
- **Status:** `[x]`
- **Deps:** None
- **Priority:** 🟢 P3
- **Effort:** Small (1 hour)
- **Files:**
  - NEW: `packages/server/src/__tests__/smoke.test.ts`
  - MODIFY: `packages/server/package.json` (add test script)

**What to do:**
1. Create a smoke test script using Node.js:
   - Start server programmatically on a random port
   - Connect a WebSocket client
   - Send Join message (`{ type: 'join', playerId: 'test', tankId: 'IronMan', playerName: 'Tester' }`)
   - Wait for first Snapshot message
   - Assert snapshot has: `tick` (number), `tanks` (array), `projectiles` (array), `mapDelta` (array)
   - Disconnect and shut down
2. Add script: `"test": "npx tsx src/__tests__/smoke.test.ts"`

**Acceptance:** Smoke test connects, receives valid snapshot, exits clean.

---

## 📐 TASK DEPENDENCY GRAPH

```
INDEPENDENT (can start immediately):
  1.1  Extract SceneBuilder
  2.1  Skill E/Space Activation
  3.3  Kill Feed UI
  5.1  Muzzle Flash
  5.2  Hit Explosion
  5.3  Damage Flash
  5.4  Screen Shake
  5.5  Death Animation
  6.1  EXP Component
  7.1  Tank Selection
  8.1  Type-Check CI
  8.2  Smoke Test

AFTER 1.1:
  └── 1.2  Wire HUD/Overlay/Minimap

AFTER 1.2:
  ├── 3.1  Match State UI
  ├── 3.2  Team Coloring
  └── 4.1  Skill Cooldown UI

AFTER 2.1:
  ├── 2.2  DashSystem + Clone Decoy
  ├── 2.3  HitscanSystem
  ├── 2.4  Homing Projectile
  └── 2.5  Lob Projectile

AFTER 6.1:
  └── 6.2  EvolutionSystem
```

---

## 📌 RULES FOR AGENTS

> **Copy of the critical rules from AGENT_CONTEXT.md § 9. ALWAYS follow these.**

1. Read `docs/AGENT_CONTEXT.md` first when starting a new session
2. **3 skill slots only:** Attack (LMB), E, Space. NO R/Q/Slot3
3. **7 base stats only:** hp, atk, range, defP, defE, attackSpeed, speed
4. **Root and Silence are StatusEffects**, NOT TankStates. Only Stun changes TankState
5. **No ammo/reload.** Attacks are infinite, gated by `attackSpeed`
6. **Circle hitbox for tanks**, AABB for tiles
7. **5 levels = 5 visual tiers** (1:1 mapping)
8. **Build shared first:** `cd packages/shared && npx tsc`
9. **Use `.js` extensions** in barrel re-exports for ESM
10. **TypeScript strict mode** is on
11. **Server at 60Hz**, snapshots at 20Hz
12. **Damage formula:** `Mitigation = 100 / (100 + DEF)`
13. **Cocos 3D mode:** orthographic camera, 3D nodes, `cc` module
14. **3D Tank hierarchy:** TankRoot → HullMesh + TurretPivot → TurretMesh
15. **UI uses Cocos UI:** Canvas, Label, Sprite, ProgressBar. NOT DOM/HTML

---

## 📝 CHANGELOG

| Date | Agent | Changes |
|------|-------|---------|
| 2026-05-21 | Claude Opus (initial audit) | Created implementation plan with 21 tasks across 8 work streams. Full codebase audit completed. |
| 2026-05-21 | Antigravity | Completed Task 4.1 (Skill Cooldown UI) tracking client-side skill cooldowns and updating HUD bars/labels. |
| 2026-05-21 | Antigravity | Completed Work Stream 6 (Evolution System). Implemented server-side EXP, stat scaling, hitbox growth, and client visual sync. |
| 2026-05-21 | Antigravity | Completed remaining Phase 6 tasks: 3.3 (Kill Feed), 5.1-5.5 (VFX & Polish), 7.1 (Tank Selection), 8.2 (Smoke Test). Phase 6 fully complete. |
