// ═══════════════════════════════════════════════════════════════════
// MatchOverlay.ts — Match phase UI overlays
//
// Renders match state on top of gameplay:
//   - WaitingForPlayers: "Waiting for players..." text
//   - Countdown: Large "3... 2... 1... GO!" with scale animation
//   - Playing: Match timer + team scores (top center)
//   - MatchEnd: Results screen with scoreboard
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import { type MatchState, type PlayerScore, MatchPhase } from '@bang-bang/shared';

export class MatchOverlay {
  private scene: Phaser.Scene;

  // ─── Waiting ──────────────────────────────────────────────
  private waitingText: Phaser.GameObjects.Text;

  // ─── Countdown ────────────────────────────────────────────
  private countdownText: Phaser.GameObjects.Text;
  private lastCountdownVal = -1;

  // ─── Playing ──────────────────────────────────────────────
  private timerText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private killTargetText: Phaser.GameObjects.Text;

  // ─── Match End ────────────────────────────────────────────
  private resultContainer: Phaser.GameObjects.Container;
  private resultTitle: Phaser.GameObjects.Text;
  private resultScoreboard: Phaser.GameObjects.Text;
  private resultTimer: Phaser.GameObjects.Text;

  private lastPhase: MatchPhase | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.scale;
    const cx = width / 2;
    const cy = height / 2;

    const depth = 200; // Above everything

    // ─── Waiting Text ───────────────────────────────────────
    this.waitingText = scene.add.text(cx, cy, 'Waiting for players...', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '24px',
      color: '#aaaaaa',
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth).setVisible(false);

    // ─── Countdown Text ─────────────────────────────────────
    this.countdownText = scene.add.text(cx, cy, '', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#ffffff',
      shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 6, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth).setVisible(false);

    // ─── Timer (top center during Playing) ──────────────────
    this.timerText = scene.add.text(cx, 10, '5:00', {
      fontFamily: '"Outfit", monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, fill: true },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth).setVisible(false);

    // ─── Team Scores (below timer) ──────────────────────────
    this.scoreText = scene.add.text(cx, 32, 'RED 0 — 0 BLUE', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '14px',
      color: '#cccccc',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, fill: true },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth).setVisible(false);

    // ─── Kill Target (below scores) ─────────────────────────
    this.killTargetText = scene.add.text(cx, 50, '', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth).setVisible(false);

    // ─── Match End Container ────────────────────────────────
    this.resultContainer = scene.add.container(cx, cy)
      .setScrollFactor(0).setDepth(depth + 1).setVisible(false);

    // Background dimmer
    const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.65);
    this.resultContainer.add(bg);

    // Winner title
    this.resultTitle = scene.add.text(0, -80, '', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#ffd700',
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5);
    this.resultContainer.add(this.resultTitle);

    // Scoreboard
    this.resultScoreboard = scene.add.text(0, 0, '', {
      fontFamily: '"Outfit", monospace',
      fontSize: '14px',
      color: '#cccccc',
      lineSpacing: 6,
      align: 'center',
    }).setOrigin(0.5);
    this.resultContainer.add(this.resultScoreboard);

    // "Next match in..." timer
    this.resultTimer = scene.add.text(0, 110, '', {
      fontFamily: '"Outfit", sans-serif',
      fontSize: '13px',
      color: '#888888',
    }).setOrigin(0.5);
    this.resultContainer.add(this.resultTimer);
  }

  update(matchState: MatchState | undefined): void {
    if (!matchState) return;

    const phase = matchState.phase;
    const phaseChanged = phase !== this.lastPhase;
    this.lastPhase = phase;

    // Hide all by default
    this.waitingText.setVisible(false);
    this.countdownText.setVisible(false);
    this.timerText.setVisible(false);
    this.scoreText.setVisible(false);
    this.killTargetText.setVisible(false);
    this.resultContainer.setVisible(false);

    switch (phase) {
      case MatchPhase.WaitingForPlayers:
        this.waitingText.setVisible(true);
        break;

      case MatchPhase.Countdown:
        this.showCountdown(matchState.countdownSec, phaseChanged);
        break;

      case MatchPhase.Playing:
        this.showPlaying(matchState);
        break;

      case MatchPhase.MatchEnd:
        this.showMatchEnd(matchState);
        break;
    }
  }

  // ─── Countdown ────────────────────────────────────────────────

  private showCountdown(countdownSec: number, phaseChanged: boolean): void {
    this.countdownText.setVisible(true);

    const displayVal = Math.max(0, countdownSec);
    const label = displayVal > 0 ? String(displayVal) : 'GO!';
    const color = displayVal > 0 ? '#ffffff' : '#2ecc71';

    if (displayVal !== this.lastCountdownVal || phaseChanged) {
      this.lastCountdownVal = displayVal;
      this.countdownText.setText(label);
      this.countdownText.setColor(color);

      // Pulse animation
      this.countdownText.setScale(1.5);
      this.scene.tweens.add({
        targets: this.countdownText,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
  }

  // ─── Playing ──────────────────────────────────────────────────

  private showPlaying(matchState: MatchState): void {
    this.timerText.setVisible(true);
    this.scoreText.setVisible(true);
    this.killTargetText.setVisible(true);

    // Timer — show remaining time
    const remainingSec = Math.max(0, matchState.matchTimeLimitSec - matchState.matchTimeSec);
    const min = Math.floor(remainingSec / 60);
    const sec = remainingSec % 60;
    const timerStr = `${min}:${String(sec).padStart(2, '0')}`;
    this.timerText.setText(timerStr);

    // Flash red in last 30s
    if (remainingSec <= 30) {
      this.timerText.setColor('#e74c3c');
    } else {
      this.timerText.setColor('#ffffff');
    }

    // Team scores
    const redKills = matchState.teamScores['Red'] ?? 0;
    const blueKills = matchState.teamScores['Blue'] ?? 0;
    this.scoreText.setText(`🔴 ${redKills}  —  ${blueKills} 🔵`);

    // Kill target
    this.killTargetText.setText(`First to ${matchState.killTarget} kills`);
  }

  // ─── Match End ────────────────────────────────────────────────

  private showMatchEnd(matchState: MatchState): void {
    this.resultContainer.setVisible(true);

    // Winner title
    if (matchState.winnerId === 'Draw') {
      this.resultTitle.setText('DRAW!');
      this.resultTitle.setColor('#aaaaaa');
    } else if (matchState.winnerId === 'Red') {
      this.resultTitle.setText('🔴 RED TEAM WINS!');
      this.resultTitle.setColor('#e74c3c');
    } else {
      this.resultTitle.setText('🔵 BLUE TEAM WINS!');
      this.resultTitle.setColor('#3498db');
    }

    // Scoreboard
    const lines: string[] = [];
    const redPlayers = matchState.scores.filter(s => (s.team as string) === 'Red');
    const bluePlayers = matchState.scores.filter(s => (s.team as string) === 'Blue');

    if (redPlayers.length > 0) {
      lines.push('— RED TEAM —');
      for (const p of redPlayers) {
        lines.push(`  ${(p.playerId as string).slice(-6)}  K:${p.kills}  D:${p.deaths}`);
      }
    }
    if (bluePlayers.length > 0) {
      lines.push('');
      lines.push('— BLUE TEAM —');
      for (const p of bluePlayers) {
        lines.push(`  ${(p.playerId as string).slice(-6)}  K:${p.kills}  D:${p.deaths}`);
      }
    }

    this.resultScoreboard.setText(lines.join('\n'));

    // "Next match" timer
    this.resultTimer.setText('Next match starting soon...');
  }
}
