/**
 * HUDController.ts — In-game HUD overlay
 */

import { _decorator, Component, Graphics, Label, Color } from 'cc';

const { ccclass, property } = _decorator;

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
  }

  updateHP(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? hp / maxHp : 0;

    if (this.hpBar) {
      this.hpBar.clear();
      // Draw background
      this.hpBar.fillColor = new Color(40, 40, 45, 200);
      this.hpBar.rect(-100, -10, 200, 20);
      this.hpBar.fill();

      // Draw fill
      if (ratio > 0) {
        this.hpBar.fillColor = new Color(46, 204, 113, 255); // Green HP bar
        this.hpBar.rect(-100, -10, 200 * ratio, 20);
        this.hpBar.fill();
      }

      // Draw 100 HP dividers
      if (maxHp <= 10000 && maxHp > 0) {
        this.hpBar.strokeColor = new Color(0, 0, 0, 180);
        this.hpBar.lineWidth = 1.5;
        const numIntervals = Math.floor((maxHp - 1) / 100);
        for (let i = 1; i <= numIntervals; i++) {
          const divRatio = (i * 100) / maxHp;
          const x = -100 + 200 * divRatio;
          this.hpBar.moveTo(x, -10);
          this.hpBar.lineTo(x, 10);
          this.hpBar.stroke();
        }
      }

      // Draw border
      this.hpBar.strokeColor = new Color(120, 120, 120, 255);
      this.hpBar.lineWidth = 2;
      this.hpBar.rect(-100, -10, 200, 20);
      this.hpBar.stroke();
    }
    if (this.hpLabel) {
      this.hpLabel.string = `${Math.ceil(hp)} / ${maxHp}`;
    }
  }

  updateNetworkStatus(ping: number, mode: string, playerCount: number): void {
    if (this.pingLabel) {
      this.pingLabel.string = `Ping: ${ping}ms`;
    }
    if (this.modeLabel) {
      this.modeLabel.string = mode.toUpperCase();
    }
    if (this.playerCountLabel) {
      this.playerCountLabel.string = `Players: ${playerCount}`;
    }
  }

  updateMatchInfo(timerSec: number, redScore: number, blueScore: number): void {
    if (this.matchTimerLabel) {
      this.matchTimerLabel.node.active = true;
      const mins = Math.floor(timerSec / 60);
      const secs = Math.floor(timerSec % 60);
      const secStr = secs < 10 ? `0${secs}` : `${secs}`;
      this.matchTimerLabel.string = `${mins}:${secStr}`;
    }
    if (this.scoreLabel) {
      this.scoreLabel.node.active = true;
      this.scoreLabel.string = `${redScore} - ${blueScore}`;
    }
  }

  updateSkillCooldowns(eRatio: number, spaceRatio: number, eSec: number, spaceSec: number): void {
    this.drawSkillSlot(this.skillEGraphics, 60, 60, new Color(40, 40, 50, 180), new Color(52, 152, 219, 255), 1 - eRatio);
    this.drawSkillSlot(this.skillSpaceGraphics, 80, 60, new Color(40, 40, 50, 180), new Color(155, 89, 182, 255), 1 - spaceRatio);

    if (this.skillELabel) this.skillELabel.string = eRatio > 0 ? `${Math.ceil(eSec)}s` : 'E';
    if (this.skillSpaceLabel) this.skillSpaceLabel.string = spaceRatio > 0 ? `${Math.ceil(spaceSec)}s` : 'SPACE';
  }

  private drawSkillSlot(g: Graphics | null, w: number, h: number, bgColor: Color, fillColor: Color, progress: number): void {
    if (!g) return;
    g.clear();

    const halfW = w / 2;
    const halfH = h / 2;

    // Draw background
    g.fillColor = bgColor;
    g.rect(-halfW, -halfH, w, h);
    g.fill();

    // Draw progress fill
    if (progress > 0) {
      g.fillColor = fillColor;
      g.rect(-halfW, -halfH, w * progress, h);
      g.fill();
    }

    // Draw border outline
    g.strokeColor = new Color(120, 120, 120, 255);
    g.lineWidth = 2;
    g.rect(-halfW, -halfH, w, h);
    g.stroke();
  }
}
