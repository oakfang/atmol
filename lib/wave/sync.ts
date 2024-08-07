import type { WaveScheduler } from './scheduler';
import type { Wave } from './types';

/**
 * Represents a synchronous wave scheduler that implements the {@link WaveScheduler} interface.
 *
 * This scheduler allows registering waves with associated effects and scheduling them to run synchronously.
 * It keeps track of pending waves and ensures that each wave's effect is executed only once.
 *
 * @implements {WaveScheduler}
 */
export const sync = ((): WaveScheduler => {
  const waves = new WeakMap<Wave, () => void>();

  return {
    register(wave: Wave, effect: () => void) {
      waves.set(wave, effect);
    },
    schedule(wave: Wave) {
      waves.get(wave)?.();
    },
  };
})();
