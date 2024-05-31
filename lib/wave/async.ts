import type { WaveScheduler } from "./scheduler";
import type { Wave } from "./types";

/**
 * Represents an asynchronous wave scheduler that implements the WaveScheduler interface.
 * 
 * This scheduler allows registering waves with associated effects and scheduling them to run asynchronously.
 * It keeps track of pending waves and ensures that each wave's effect is executed only once.
 * 
 * @implements {WaveScheduler}
 */
class AsyncWaveScheduler implements WaveScheduler {
  #waves = new WeakMap<Wave, () => void>();
  #hadInitialRun = new WeakSet<Wave>();
  #pendingWaves = new Set<Wave>();
  #isRunning = false;

  register(wave: Wave, effect: () => void): void {
    this.#waves.set(wave, effect);
  }

  schedule(wave: Wave): void {
    if (!this.#hadInitialRun.has(wave)) {
      this.#hadInitialRun.add(wave);
      return this.#waves.get(wave)?.();
    }
    this.#pendingWaves.add(wave);
    if (!this.#isRunning) {
      this.#isRunning = true;
      queueMicrotask(() => {
        while (this.#pendingWaves.size) {
          const currentlyPending = [...this.#pendingWaves];
          this.#pendingWaves.clear();
          currentlyPending.forEach((wave) => {
            this.#waves.get(wave)?.();
          });
        }
        this.#isRunning = false;
      });
    }
  }
}

/**
 * A default instance of the {@link AsyncWaveScheduler} class.
 */
export const async = new AsyncWaveScheduler();
