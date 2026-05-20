// ═══════════════════════════════════════════════════════════════════
// main.ts — Phaser 3 Game Entry Point
// ═══════════════════════════════════════════════════════════════════

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  pixelArt: false, // Smooth bilinear filtering for cel-shaded AI sprites
  fps: {
    target: 0, // Uncapped — use monitor's native refresh rate
    forceSetTimeOut: false,
  },
  render: {
    antialias: true,
    antialiasGL: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
