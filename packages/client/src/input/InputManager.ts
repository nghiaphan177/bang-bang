// ═══════════════════════════════════════════════════════════════════
// InputManager.ts — WASD + Mouse → Input struct
// GDD §1: 8-directional free movement, turret follows mouse
// Keybinds: LMB = Attack (hold for continuous), E = Skill, SPACE = Ult
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import type { Vector2, Radians } from '@bang-bang/shared';

export interface LocalInput {
  moveDir: Vector2 | null;
  aimAngle: Radians;
  fire: boolean;
  skillE: boolean;
  skillSpace: boolean;
}

export class InputManager {
  private keys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  /**
   * Sample current input state.
   * @param target - Player container/sprite for aim angle calculation
   */
  getInput(target: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite): LocalInput {
    // ─── Movement Direction (8-way WASD) ────────────────────
    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy -= 1;
    if (this.keys.S.isDown) dy += 1;
    if (this.keys.A.isDown) dx -= 1;
    if (this.keys.D.isDown) dx += 1;

    let moveDir: Vector2 | null = null;
    if (dx !== 0 || dy !== 0) {
      const mag = Math.sqrt(dx * dx + dy * dy);
      moveDir = { x: dx / mag, y: dy / mag };
    }

    // ─── Turret Aim (mouse world position relative to tank) ──
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const aimAngle = Phaser.Math.Angle.Between(
      target.x,
      target.y,
      worldPoint.x,
      worldPoint.y,
    ) as Radians;

    // ─── Actions ────────────────────────────────────────────
    const fire = pointer.isDown; // Hold LMB = continuous fire
    const skillE = Phaser.Input.Keyboard.JustDown(this.keys.E);
    const skillSpace = Phaser.Input.Keyboard.JustDown(this.keys.SPACE);

    return { moveDir, aimAngle, fire, skillE, skillSpace };
  }
}
