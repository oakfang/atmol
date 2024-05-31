import type { Getter } from "../molecule";
import { get } from "../ops";
import {
  markAsDependent,
  notifySym,
  readSym,
  type Particle,
} from "../particle";
import type { WaveScheduler } from "./scheduler";
import { sync } from "./sync";
import type { Unsubscribe, Wave } from "./types";

let DEFAULT_SCHEDULER: WaveScheduler = sync;

/**
 * Sets the default scheduler to be used by the wave function.
 *
 * @param scheduler - The WaveScheduler implementation to set as the default scheduler.
 */
export function setDefaultScheduler(scheduler: WaveScheduler) {
  DEFAULT_SCHEDULER = scheduler;
}

/**
 * Declare a wave effect that will be run immediately, and when any of its dependencies change.
 *
 * @param effect A function that runs after the wave's creation and every time one of its dependencies changes. It accepts a unique "get" operator that marks the particle as a dependency.
 * @param scheduler The {@link WaveScheduler} to use for scheduling the effect to run.
 * @returns An Unsubscribe function that can be used to stop the effect and clean up any dependencies.
 */
export function wave<T>(
  effect: (get: Getter) => T,
  scheduler: WaveScheduler = DEFAULT_SCHEDULER
): Unsubscribe {
  const unwatchers = new Map<Particle<any>, Unsubscribe>();
  const waveParticle = {
    [readSym]() {},
    [notifySym]() {
      scheduler.schedule(waveParticle);
    },
  } satisfies Wave;
  scheduler.register(waveParticle, () => effect(getter));

  function getter<T>(p: Particle<T>): T {
    unwatchers.set(p, markAsDependent(p, waveParticle));
    return get(p);
  }

  scheduler.schedule(waveParticle);

  return () => {
    unwatchers.forEach((u) => u());
    unwatchers.clear();
  };
}
