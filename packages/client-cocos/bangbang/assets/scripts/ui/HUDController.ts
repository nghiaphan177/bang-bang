/**
 * HUDController.ts — In-game HUD overlay
 */

import { _decorator, Component, ProgressBar, Label, Color } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HUDController')
export class HUDController extends Component {
  @property(ProgressBar)
  hpBar: ProgressBar | null = null;

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
      this.hpBar.progress = ratio;
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
      this.matchTimerLabel.string = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    if (this.scoreLabel) {
      this.scoreLabel.string = `${redScore} - ${blueScore}`;
    }
  }
}
