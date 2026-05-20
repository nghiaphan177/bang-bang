// ═══════════════════════════════════════════════════════════════════
// HUD.ts — Skill cooldowns + Network status + Player HP bar overlay
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';

interface HUDEntity {
  cooldowns?: {
    skillE: { remainingMs: number; cooldownMs: number; isReady: boolean };
    skillSpace: { remainingMs: number; cooldownMs: number; isReady: boolean };
  };
  health?: {
    hp: number;
    maxHp: number;
    isAlive: boolean;
  };
}

export interface NetworkStatus {
  connected: boolean;
  rtt: number;
  playerCount: number;
}

export class HUD {
  // ─── HUD Background Panel ──────────────────────────────────
  private readonly bottomPanel: Phaser.GameObjects.NineSlice;
  
  // ─── Player HP Bar ─────────────────────────────────────────
  private readonly hudHpFrame: Phaser.GameObjects.Image;
  private readonly hudHpFill: Phaser.GameObjects.Image;
  private readonly hudHpText: Phaser.GameObjects.Text;

  // ─── Skill Slots ───────────────────────────────────────────
  private readonly hudSkillEFrame: Phaser.GameObjects.Image;
  private readonly hudSkillEIcon: Phaser.GameObjects.Image;
  private readonly hudSkillEOverlay: Phaser.GameObjects.Graphics;
  private readonly hudSkillEText: Phaser.GameObjects.Text;
  private readonly hudSkillELabel: Phaser.GameObjects.Text;

  private readonly hudSkillSpaceFrame: Phaser.GameObjects.Image;
  private readonly hudSkillSpaceIcon: Phaser.GameObjects.Image;
  private readonly hudSkillSpaceOverlay: Phaser.GameObjects.Graphics;
  private readonly hudSkillSpaceText: Phaser.GameObjects.Text;
  private readonly hudSkillSpaceLabel: Phaser.GameObjects.Text;

  // ─── Network Status Panel ──────────────────────────────────
  private readonly netPanel: Phaser.GameObjects.NineSlice;
  private readonly netStatusText: Phaser.GameObjects.Text;
  private readonly modeText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const cx = 480; // 960 / 2
    const cy = 590; // Bottom HUD panel center

    // ─── Bottom Center Panel ────────────────────────────────
    this.bottomPanel = scene.add.nineslice(cx, cy, 'ui_hud_panel', undefined, 460, 80, 10, 10, 10, 10)
      .setScrollFactor(0)
      .setDepth(100);

    // ─── HUD Player HP Bar (Left-aligned in bottom panel) ───
    const hpX = 210; // Left-edge offset inside bottom panel
    this.hudHpFrame = scene.add.image(hpX, cy, 'ui_hp_frame')
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setScale(1.8, 1.33); // Displays at 180x16

    this.hudHpFill = scene.add.image(hpX + 4, cy, 'ui_hp_fill')
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setScale(1.792, 1.25); // Displays at 172x10

    // Centered text on top of HP bar (210 + 90)
    this.hudHpText = this.createRetroText(scene, 300, cy, '', '13px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(102);

    // ─── Skill E Slot (Right side of bottom panel) ──────────
    const skillEX = 530;
    this.hudSkillEFrame = scene.add.image(skillEX, cy, 'ui_skill_frame')
      .setScrollFactor(0)
      .setDepth(101)
      .setScale(0.75); // 48x48

    this.hudSkillEIcon = scene.add.image(skillEX, cy, 'ui_skill_icon_e')
      .setScrollFactor(0)
      .setDepth(101)
      .setScale(0.625); // 40x40

    this.hudSkillEOverlay = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(102);

    this.hudSkillEText = this.createRetroText(scene, skillEX, cy, '', '16px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(103);

    this.hudSkillELabel = this.createRetroText(scene, skillEX, cy + 24, 'E', '10px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(103);

    // ─── Skill Space Slot (Right side of bottom panel) ──────
    const skillSpX = 600;
    this.hudSkillSpaceFrame = scene.add.image(skillSpX, cy, 'ui_skill_frame')
      .setScrollFactor(0)
      .setDepth(101)
      .setScale(0.75); // 48x48

    this.hudSkillSpaceIcon = scene.add.image(skillSpX, cy, 'ui_skill_icon_space')
      .setScrollFactor(0)
      .setDepth(101)
      .setScale(0.625); // 40x40

    this.hudSkillSpaceOverlay = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(102);

    this.hudSkillSpaceText = this.createRetroText(scene, skillSpX, cy, '', '16px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(103);

    this.hudSkillSpaceLabel = this.createRetroText(scene, skillSpX, cy + 24, 'SPC', '10px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(103);

    // ─── Network Status Panel (Top-Right) ───────────────────
    this.netPanel = scene.add.nineslice(860, 40, 'ui_hud_panel', undefined, 180, 60, 10, 10, 10, 10)
      .setScrollFactor(0)
      .setDepth(100);

    this.netStatusText = this.createRetroText(scene, 860, 28, '', '12px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    this.modeText = this.createRetroText(scene, 860, 52, '', '11px')
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
  }

  /**
   * Helper to create retro stylized webgame text.
   */
  private createRetroText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    fontSize: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, text, {
      fontFamily: 'Impact, Arial Black',
      fontSize: fontSize,
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 0,
        stroke: true,
        fill: true,
      },
    });
  }

  update(entity: HUDEntity, networkStatus?: NetworkStatus): void {
    // ─── Player HP Bar ──────────────────────────────────────
    if (entity.health) {
      const hp = entity.health.hp;
      const maxHp = entity.health.maxHp;
      const hpRatio = Math.max(0, hp / maxHp);

      this.hudHpText.setText(`${hp} / ${maxHp}`);

      // Change HP fill key dynamically based on thresholds
      let fillKey = 'ui_hp_fill'; // green
      if (hpRatio < 0.6) fillKey = 'ui_hp_fill_yellow';
      if (hpRatio < 0.3) fillKey = 'ui_hp_fill_red';
      
      this.hudHpFill.setTexture(fillKey);
      
      // Deplete HP bar using setCrop (original fill texture width is 96)
      this.hudHpFill.setCrop(0, 0, 96 * hpRatio, 8);

      this.hudHpFrame.setVisible(true);
      this.hudHpFill.setVisible(true);
      this.hudHpText.setVisible(true);
    } else {
      this.hudHpFrame.setVisible(false);
      this.hudHpFill.setVisible(false);
      this.hudHpText.setVisible(false);
    }

    // ─── Skill Cooldowns (Wipe Effect) ──────────────────────
    if (entity.cooldowns) {
      // Skill E
      const e = entity.cooldowns.skillE;
      const eRatio = e.isReady ? 0 : Math.max(0, e.remainingMs / e.cooldownMs);
      
      this.hudSkillEOverlay.clear();
      if (eRatio > 0) {
        this.hudSkillEOverlay.fillStyle(0x000000, 0.6);
        // Wipe overlay from bottom to top. Center: 530, 590. Icon size: 40x40.
        // Bounds: x from 510 to 550, y from 570 to 610.
        const h = 40 * eRatio;
        this.hudSkillEOverlay.fillRect(510, 610 - h, 40, h);
        
        this.hudSkillEText.setText(`${(e.remainingMs / 1000).toFixed(1)}s`);
      } else {
        this.hudSkillEText.setText('');
      }

      // Skill Space
      const sp = entity.cooldowns.skillSpace;
      const spRatio = sp.isReady ? 0 : Math.max(0, sp.remainingMs / sp.cooldownMs);

      this.hudSkillSpaceOverlay.clear();
      if (spRatio > 0) {
        this.hudSkillSpaceOverlay.fillStyle(0x000000, 0.6);
        // Center: 600, 590. Bounds: x from 580 to 620, y from 570 to 610.
        const h = 40 * spRatio;
        this.hudSkillSpaceOverlay.fillRect(580, 610 - h, 40, h);

        this.hudSkillSpaceText.setText(`${(sp.remainingMs / 1000).toFixed(1)}s`);
      } else {
        this.hudSkillSpaceText.setText('');
      }
    } else {
      this.hudSkillEText.setText('');
      this.hudSkillSpaceText.setText('');
      this.hudSkillEOverlay.clear();
      this.hudSkillSpaceOverlay.clear();
    }

    // ─── Network Status ─────────────────────────────────────
    if (networkStatus) {
      if (networkStatus.connected) {
        const rttColor = networkStatus.rtt < 50 ? '#2ecc71'
          : networkStatus.rtt < 120 ? '#f39c12'
          : '#e74c3c';
        this.netStatusText.setText(`PING ${networkStatus.rtt}ms`);
        this.netStatusText.setColor(rttColor);
        this.modeText.setText(`ONLINE · ${networkStatus.playerCount} PLAYERS`);
        this.modeText.setColor('#3498db');
      } else {
        this.netStatusText.setText('DISCONNECTED');
        this.netStatusText.setColor('#e74c3c');
        this.modeText.setText('RECONNECTING...');
        this.modeText.setColor('#f39c12');
      }
    } else {
      // Local mode
      this.netStatusText.setText('LOCAL PLAY');
      this.netStatusText.setColor('#f1c40f');
      this.modeText.setText('OFFLINE TEST');
      this.modeText.setColor('#95a5a6');
    }
  }
}
