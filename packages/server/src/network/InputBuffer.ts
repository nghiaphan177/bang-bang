// ═══════════════════════════════════════════════════════════════════
// InputBuffer.ts — Per-player latest input storage
// Server stores the latest PlayerInput per player per tick.
// ═══════════════════════════════════════════════════════════════════

import type { PlayerId } from '@bang-bang/shared';
import type { PlayerInput } from '@bang-bang/shared';

export class InputBuffer {
  /** Latest input per player */
  private readonly inputs = new Map<PlayerId, PlayerInput>();
  /** Last processed seq per player (for client reconciliation) */
  private readonly lastProcessedSeq = new Map<PlayerId, number>();

  /**
   * Buffer a new input from a player. Overwrites previous input.
   */
  setInput(playerId: PlayerId, input: PlayerInput): void {
    this.inputs.set(playerId, input);
  }

  /**
   * Get the current buffered input for a player.
   * Returns null if no input has been received this tick.
   */
  getInput(playerId: PlayerId): PlayerInput | null {
    return this.inputs.get(playerId) ?? null;
  }

  /**
   * Mark a player's input as processed for this tick.
   * Records the seq number for client reconciliation.
   */
  markProcessed(playerId: PlayerId): void {
    const input = this.inputs.get(playerId);
    if (input) {
      this.lastProcessedSeq.set(playerId, input.seq);
    }
  }

  /**
   * Get last processed seq for a player.
   */
  getLastProcessedSeq(playerId: PlayerId): number {
    return this.lastProcessedSeq.get(playerId) ?? 0;
  }

  /**
   * Get all last processed seqs as a Map (for snapshot creation).
   */
  getAllLastProcessedSeqs(): Map<PlayerId, number> {
    return new Map(this.lastProcessedSeq);
  }

  /**
   * Get all buffered inputs for iteration.
   */
  getAllInputs(): ReadonlyMap<PlayerId, PlayerInput> {
    return this.inputs;
  }

  /**
   * Clear all buffered inputs (call after processing a tick).
   * NOTE: We DON'T clear lastProcessedSeq — those persist for reconciliation.
   */
  clearTick(): void {
    this.inputs.clear();
  }

  /**
   * Remove a player from the buffer entirely.
   */
  removePlayer(playerId: PlayerId): void {
    this.inputs.delete(playerId);
    this.lastProcessedSeq.delete(playerId);
  }
}
