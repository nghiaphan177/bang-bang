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
      const mins = Math.floor(timerSec / 60);
      const secs = Math.floor(timerSec % 60);
      const secStr = secs < 10 ? `0${secs}` : `${secs}`;
      this.matchTimerLabel.string = `${mins}:${secStr}`;
    }
    if (this.scoreLabel) {
      this.scoreLabel.string = `${redScore} - ${blueScore}`;
    }
  }
}
