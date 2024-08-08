import type { Wave } from './types';

/**
 * Interface representing a WaveScheduler with methods to register a wave with an effect and to schedule a wave's effect to run.
 */
export interface WaveScheduler {
  register(wave: Wave, effect: () => void): void;
  schedule(wave: Wave): void;
}
