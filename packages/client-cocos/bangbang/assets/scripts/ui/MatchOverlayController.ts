/**
 * MatchOverlayController.ts — Premium match state overlay UI
 *
 * Features:
 * - Large animated countdown numbers (gold) with dark overlay
 * - "GO!" in green with pop animation
 * - VICTORY/DEFEAT results with dark overlay
 * - Score table with team stripes, sorted by kills
 * - Match duration display
 */

import { _decorator, Component, Label, Node, tween, Vec3, Graphics, Color, UITransform, Layers, LabelOutline } from 'cc';

const { ccclass, property } = _decorator;

// Colors
const COL_OVERLAY      = new Color(8, 10, 18, 230);
const COL_GOLD         = new Color(255, 215, 0, 255);
const COL_GO           = new Color(46, 204, 113, 255);
const COL_VICTORY      = new Color(46, 204, 113, 255);
const COL_DEFEAT       = new Color(231, 76, 60, 255);
const COL_DRAW         = new Color(241, 196, 15, 255);
const COL_RED_STRIPE   = new Color(180, 50, 50, 120);
const COL_BLUE_STRIPE  = new Color(40, 100, 180, 120);
const COL_TABLE_BG     = new Color(20, 22, 35, 200);
const COL_TABLE_BORDER = new Color(60, 65, 85, 200);
const COL_TABLE_HDR    = new Color(30, 32, 48, 220);
const COL_DIVIDER      = new Color(60, 60, 80, 150);
const COL_TEXT_DIM     = new Color(140, 145, 160, 255);
const COL_TEXT_BRIGHT  = new Color(230, 230, 240, 255);

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

  @property(Graphics)
  overlayBg: Graphics | null = null;

  @property(Graphics)
  resultsBg: Graphics | null = null;

  private lastCountdown = -1;

  showCountdown(secondsLeft: number): void {
    if (!this.countdownLabel) return;

    // Show dark overlay
    if (this.overlayBg) {
      this.overlayBg.node.active = true;
      this.overlayBg.clear();
      this.overlayBg.fillColor = new Color(8, 10, 18, 160);
      this.overlayBg.rect(-640, -360, 1280, 720);
      this.overlayBg.fill();
    }

    this.countdownLabel.node.active = true;

    // Only animate on change
    if (secondsLeft !== this.lastCountdown) {
      this.lastCountdown = secondsLeft;

      if (secondsLeft > 0) {
        this.countdownLabel.string = `${secondsLeft}`;
        this.countdownLabel.color = COL_GOLD;
        this.countdownLabel.fontSize = 140;
      } else {
        this.countdownLabel.string = 'GO!';
        this.countdownLabel.color = COL_GO;
        this.countdownLabel.fontSize = 120;
      }

      const node = this.countdownLabel.node;
      node.setScale(0.1, 0.1, 0.1);

      tween(node)
        .to(0.15, { scale: new Vec3(1.6, 1.6, 1.6) })
        .to(0.2, { scale: new Vec3(1.0, 1.0, 1.0) })
        .start();
    }

    if (secondsLeft <= 0) {
      this.scheduleOnce(() => {
        if (this.countdownLabel) {
          this.countdownLabel.node.active = false;
        }
        if (this.overlayBg) {
          this.overlayBg.node.active = false;
        }
        this.lastCountdown = -1;
      }, 0.8);
    }
  }

  hideCountdown(): void {
    if (this.countdownLabel) {
      this.countdownLabel.node.active = false;
    }
    if (this.overlayBg) {
      this.overlayBg.node.active = false;
    }
    this.lastCountdown = -1;
  }

  showResults(
    winnerTeam: string,
    scores: Array<{ name: string; kills: number; deaths: number; team?: string; tankId?: string }>,
    myTeam?: string,
    matchDurationSec?: number,
  ): void {
    if (!this.resultsPanel) return;
    this.resultsPanel.active = true;

    // Draw dark full-screen overlay
    if (this.resultsBg) {
      this.resultsBg.node.active = true;
      this.resultsBg.clear();
      this.resultsBg.fillColor = COL_OVERLAY;
      this.resultsBg.rect(-640, -360, 1280, 720);
      this.resultsBg.fill();
    }

    // Title: VICTORY / DEFEAT / DRAW
    if (this.resultsTitleLabel) {
      if (winnerTeam === 'Draw') {
        this.resultsTitleLabel.string = 'DRAW';
        this.resultsTitleLabel.color = COL_DRAW;
      } else if (myTeam && winnerTeam === myTeam) {
        this.resultsTitleLabel.string = 'VICTORY';
        this.resultsTitleLabel.color = COL_VICTORY;
      } else if (myTeam) {
        this.resultsTitleLabel.string = 'DEFEAT';
        this.resultsTitleLabel.color = COL_DEFEAT;
      } else {
        this.resultsTitleLabel.string = `${winnerTeam} WINS!`;
        this.resultsTitleLabel.color = COL_GOLD;
      }
      this.resultsTitleLabel.fontSize = 52;

      // Animate title
      const titleNode = this.resultsTitleLabel.node;
      titleNode.setScale(0.3, 0.3, 0.3);
      tween(titleNode)
        .to(0.3, { scale: new Vec3(1.1, 1.1, 1.1) })
        .to(0.2, { scale: new Vec3(1.0, 1.0, 1.0) })
        .start();
    }

    // Build score table
    if (this.resultsDetailsLabel) {
      // Sort by kills descending
      const sorted = [...scores].sort((a, b) => b.kills - a.kills);

      // Header
      let text = '─────────────────────────────\n';
      text += '  Player              K / D\n';
      text += '─────────────────────────────\n';

      for (const s of sorted) {
        const teamTag = s.team === 'Red' ? '🔴' : s.team === 'Blue' ? '🔵' : '  ';
        let paddedName = s.name;
        while (paddedName.length < 16) {
          paddedName += ' ';
        }
        const name = paddedName.substring(0, 16);
        text += `${teamTag} ${name}    ${s.kills} / ${s.deaths}\n`;
      }

      text += '─────────────────────────────';

      if (matchDurationSec != null) {
        const mins = Math.floor(matchDurationSec / 60);
        const secs = matchDurationSec % 60;
        const secStr = secs < 10 ? `0${secs}` : `${secs}`;
        text += `\n\nMatch Duration: ${mins}:${secStr}`;
      }

      this.resultsDetailsLabel.string = text;
    }
  }

  hideResults(): void {
    if (this.resultsPanel) {
      this.resultsPanel.active = false;
    }
    if (this.resultsBg) {
      this.resultsBg.node.active = false;
    }
  }
}
