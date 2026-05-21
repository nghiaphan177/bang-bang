/**
 * MatchOverlayController.ts — Match state overlay UI
 */

import { _decorator, Component, Label, Node, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('MatchOverlayController')
export class MatchOverlayController extends Component {
  @property(Label)
  countdownLabel: Label | null = null;

  @property(Node)
  resultsPanel: Node | null = null;

  @property(Label)
  resultsTitleLabel: Label | null = null;

  @property(Label)
  resultsDetailsLabel: Label | null = null;

  showCountdown(secondsLeft: number): void {
    if (!this.countdownLabel) return;

    this.countdownLabel.node.active = true;
    this.countdownLabel.string = secondsLeft > 0 ? `${secondsLeft}` : 'GO!';

    const node = this.countdownLabel.node;
    node.setScale(0.1, 0.1, 0.1);

    tween(node)
      .to(0.3, { scale: new Vec3(1.5, 1.5, 1.5) })
      .to(0.4, { scale: new Vec3(1, 1, 1) })
      .start();

    if (secondsLeft <= 0) {
      this.scheduleOnce(() => {
        if (this.countdownLabel) {
          this.countdownLabel.node.active = false;
        }
      }, 1.0);
    }
  }

  hideCountdown(): void {
    if (this.countdownLabel) {
      this.countdownLabel.node.active = false;
    }
  }

  showResults(winnerTeam: string, scores: Array<{ name: string; kills: number; deaths: number }>): void {
    if (!this.resultsPanel) return;
    this.resultsPanel.active = true;

    if (this.resultsTitleLabel) {
      this.resultsTitleLabel.string = `${winnerTeam} WINS!`;
    }
    if (this.resultsDetailsLabel) {
      const lines = scores.map((s) => `${s.name}: ${s.kills}K / ${s.deaths}D`);
      this.resultsDetailsLabel.string = lines.join('\n');
    }
  }

  hideResults(): void {
    if (this.resultsPanel) {
      this.resultsPanel.active = false;
    }
  }
}
