/**
 * HUDController.ts — Premium in-game HUD overlay
 * 
 * Features:
 * - Gradient HP bar with color-coded health (green/yellow/red)
 * - Rounded-corner skill cooldown slots with radial sweep
 * - Team score display with color coding
 * - Color-coded ping indicator
 * - Spawn protection indicator
 */

import { _decorator, Component, Graphics, Label, Color } from 'cc';

const { ccclass, property } = _decorator;

// ─── Color Palette ────────────────────────────────────────────────
const COL_HP_HIGH       = new Color(46, 204, 113, 255);    // Green > 50%
const COL_HP_MED        = new Color(241, 196, 15, 255);    // Yellow 25-50%
const COL_HP_LOW        = new Color(231, 76, 60, 255);     // Red < 25%
const COL_HP_BG         = new Color(20, 22, 30, 220);      // Dark background
const COL_HP_BORDER     = new Color(80, 85, 100, 255);     // Border
const COL_HP_GLOW_HIGH  = new Color(46, 204, 113, 40);     // Glow green
const COL_HP_GLOW_MED   = new Color(241, 196, 15, 40);     // Glow yellow
const COL_HP_GLOW_LOW   = new Color(231, 76, 60, 40);      // Glow red

const COL_SKILL_BG      = new Color(18, 18, 35, 220);      // Dark navy
const COL_SKILL_E       = new Color(52, 152, 219, 255);    // Blue
const COL_SKILL_E_DIM   = new Color(52, 152, 219, 60);
const COL_SKILL_SPC     = new Color(155, 89, 182, 255);    // Purple
const COL_SKILL_SPC_DIM = new Color(155, 89, 182, 60);
const COL_SKILL_READY   = new Color(46, 204, 113, 255);    // Ready glow green
const COL_SKILL_BORDER  = new Color(60, 65, 80, 255);

const COL_SCORE_RED     = new Color(231, 76, 60, 255);
const COL_SCORE_BLUE    = new Color(52, 152, 219, 255);
const COL_TIMER_BG      = new Color(15, 15, 25, 200);
const COL_TIMER_TEXT     = new Color(220, 220, 230, 255);

const COL_INVULN        = new Color(100, 200, 255, 180);   // Cyan glow for spawn protection

const HP_BAR_W = 240;
const HP_BAR_H = 22;
const CORNER_R = 6;

@ccclass('HUDController')
export class HUDController extends Component {
  @property(Graphics)
  hpBar: Graphics | null = null;

  @property(Label)
  hpLabel: Label | null = null;

  @property(Graphics)
  skillEGraphics: Graphics | null = null;

  @property(Graphics)
  skillSpaceGraphics: Graphics | null = null;

  @property(Label)
  skillELabel: Label | null = null;

  @property(Label)
  skillSpaceLabel: Label | null = null;

  @property(Label)
  pingLabel: Label | null = null;

  @property(Label)
  modeLabel: Label | null = null;

  @property(Label)
  playerCountLabel: Label | null = null;

  @property(Label)
  matchTimerLabel: Label | null = null;

  @property(Label)
  scoreLabel: Label | null = null;

  @property(Label)
  waitingLabel: Label | null = null;

  @property(Label)
  killTargetLabel: Label | null = null;

  private _spawnProtected = false;

  setWaitingStatus(visible: boolean): void {
    if (this.waitingLabel) {
      this.waitingLabel.node.active = visible;
    }
  }

  hideMatchInfo(): void {
    if (this.matchTimerLabel) {
      this.matchTimerLabel.node.active = false;
    }
    if (this.scoreLabel) {
      this.scoreLabel.node.active = false;
    }
    if (this.killTargetLabel) {
      this.killTargetLabel.node.active = false;
    }
  }

  setSpawnProtected(active: boolean): void {
    this._spawnProtected = active;
  }

  updateHP(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    const hpColor = ratio > 0.5 ? COL_HP_HIGH : ratio > 0.25 ? COL_HP_MED : COL_HP_LOW;
    const glowColor = ratio > 0.5 ? COL_HP_GLOW_HIGH : ratio > 0.25 ? COL_HP_GLOW_MED : COL_HP_GLOW_LOW;

    if (this.hpBar) {
      this.hpBar.clear();
      const halfW = HP_BAR_W / 2;
      const halfH = HP_BAR_H / 2;

      // Glow background (slightly larger, semi-transparent)
      this.hpBar.fillColor = glowColor;
      this.roundRect(this.hpBar, -halfW - 3, -halfH - 3, HP_BAR_W + 6, HP_BAR_H + 6, CORNER_R + 2);
      this.hpBar.fill();

      // Dark background
      this.hpBar.fillColor = COL_HP_BG;
      this.roundRect(this.hpBar, -halfW, -halfH, HP_BAR_W, HP_BAR_H, CORNER_R);
      this.hpBar.fill();

      // HP fill
      if (ratio > 0) {
        const fillW = HP_BAR_W * ratio;
        this.hpBar.fillColor = hpColor;
        // Clipping: use rect constrained by corner radius
        this.roundRect(this.hpBar, -halfW, -halfH, fillW, HP_BAR_H, CORNER_R);
        this.hpBar.fill();

        // Bright top highlight for gradient feel
        const highlightColor = new Color(hpColor.r, hpColor.g, hpColor.b, 60);
        this.hpBar.fillColor = highlightColor;
        this.hpBar.rect(-halfW + 2, 1, fillW - 4, halfH - 2);
        this.hpBar.fill();
      }

      // HP segment dividers (every 100 HP)
      if (maxHp <= 10000 && maxHp > 0) {
        this.hpBar.strokeColor = new Color(0, 0, 0, 120);
        this.hpBar.lineWidth = 1;
        const numIntervals = Math.floor((maxHp - 1) / 100);
        for (let i = 1; i <= numIntervals; i++) {
          const divRatio = (i * 100) / maxHp;
          const x = -halfW + HP_BAR_W * divRatio;
          this.hpBar.moveTo(x, -halfH + 2);
          this.hpBar.lineTo(x, halfH - 2);
          this.hpBar.stroke();
        }
      }

      // Border
      this.hpBar.strokeColor = COL_HP_BORDER;
      this.hpBar.lineWidth = 1.5;
      this.roundRect(this.hpBar, -halfW, -halfH, HP_BAR_W, HP_BAR_H, CORNER_R);
      this.hpBar.stroke();

      // Spawn Protection indicator
      if (this._spawnProtected) {
        this.hpBar.strokeColor = COL_INVULN;
        this.hpBar.lineWidth = 3;
        this.roundRect(this.hpBar, -halfW - 2, -halfH - 2, HP_BAR_W + 4, HP_BAR_H + 4, CORNER_R + 1);
        this.hpBar.stroke();
      }
    }

    if (this.hpLabel) {
      const pct = Math.round(ratio * 100);
      this.hpLabel.string = `${Math.ceil(hp)} / ${maxHp}  (${pct}%)`;
    }
  }

  updateNetworkStatus(ping: number, mode: string, playerCount: number): void {
    if (this.pingLabel) {
      this.pingLabel.string = `${ping}ms`;
      // Color code ping
      if (ping < 50) {
        this.pingLabel.color = new Color(46, 204, 113, 255);
      } else if (ping < 100) {
        this.pingLabel.color = new Color(241, 196, 15, 255);
      } else {
        this.pingLabel.color = new Color(231, 76, 60, 255);
      }
    }
    if (this.modeLabel) {
      this.modeLabel.string = mode.toUpperCase();
    }
    if (this.playerCountLabel) {
      this.playerCountLabel.string = `${playerCount}P`;
    }
  }

  updateMatchInfo(timerSec: number, timeLimitSec: number, redScore: number, blueScore: number, killTarget: number): void {
    if (this.matchTimerLabel) {
      this.matchTimerLabel.node.active = true;
      const remaining = Math.max(0, timeLimitSec - timerSec);
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      const secStr = secs < 10 ? `0${secs}` : `${secs}`;
      this.matchTimerLabel.string = `${mins}:${secStr}`;
      // Flash red when < 30 seconds
      if (remaining < 30) {
        this.matchTimerLabel.color = COL_HP_LOW;
      } else {
        this.matchTimerLabel.color = COL_TIMER_TEXT;
      }
    }
    if (this.scoreLabel) {
      this.scoreLabel.node.active = true;
      this.scoreLabel.string = `RED  ${redScore}  :  ${blueScore}  BLUE`;
    }
    if (this.killTargetLabel) {
      this.killTargetLabel.node.active = true;
      this.killTargetLabel.string = `First to ${killTarget}`;
    }
  }

  updateSkillCooldowns(eRatio: number, spaceRatio: number, eSec: number, spaceSec: number): void {
    this.drawSkillSlotPremium(this.skillEGraphics, 60, 60, COL_SKILL_BG, COL_SKILL_E, COL_SKILL_E_DIM, 1 - eRatio);
    this.drawSkillSlotPremium(this.skillSpaceGraphics, 80, 60, COL_SKILL_BG, COL_SKILL_SPC, COL_SKILL_SPC_DIM, 1 - spaceRatio);

    if (this.skillELabel) this.skillELabel.string = eRatio > 0 ? `${Math.ceil(eSec)}s` : 'E';
    if (this.skillSpaceLabel) this.skillSpaceLabel.string = spaceRatio > 0 ? `${Math.ceil(spaceSec)}s` : 'SPC';
  }

  private drawSkillSlotPremium(
    g: Graphics | null,
    w: number,
    h: number,
    bgColor: Color,
    fillColor: Color,
    dimColor: Color,
    progress: number,
  ): void {
    if (!g) return;
    g.clear();

    const halfW = w / 2;
    const halfH = h / 2;
    const r = 8; // corner radius

    // Glow when ready
    if (progress >= 1) {
      g.fillColor = new Color(fillColor.r, fillColor.g, fillColor.b, 30);
      this.roundRect(g, -halfW - 3, -halfH - 3, w + 6, h + 6, r + 2);
      g.fill();
    }

    // Background
    g.fillColor = bgColor;
    this.roundRect(g, -halfW, -halfH, w, h, r);
    g.fill();

    // Progress fill from bottom
    if (progress > 0) {
      const fillH = h * progress;
      const fillColor2 = progress >= 1 ? fillColor : dimColor;
      g.fillColor = fillColor2;
      this.roundRect(g, -halfW, halfH - fillH, w, fillH, r);
      g.fill();
    }

    // Inner highlight (top)
    if (progress >= 1) {
      g.fillColor = new Color(255, 255, 255, 15);
      g.rect(-halfW + 3, -halfH + 3, w - 6, h / 3);
      g.fill();
    }

    // Border
    g.strokeColor = progress >= 1 ? fillColor : COL_SKILL_BORDER;
    g.lineWidth = progress >= 1 ? 2 : 1;
    this.roundRect(g, -halfW, -halfH, w, h, r);
    g.stroke();
  }

  /** Draw a rounded rectangle path */
  private roundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    g.lineTo(x + w, y + h - r);
    g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    g.lineTo(x + r, y + h);
    g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    g.close();
  }
}
