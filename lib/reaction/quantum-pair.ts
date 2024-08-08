import { getDependents } from '@/base/graph';
import { type Particle, notifySym, readSym } from '@/base/particle';

/**
 * Creates a "quantum pair" consisting of a particle and a write function.
 *
 * @param initialValue The initial value of the quantum pair.
 * @returns A tuple containing the particle and the write function.
 */
export function createQuantumPair<T>(initialValue: T) {
  let value = initialValue;

  const prt = {
    [readSym]: () => value,
    [notifySym]() {},
  } satisfies Particle<T>;

  const write = (nextValue: T) => {
    if (nextValue !== value) {
      value = nextValue;
      for (const p of getDependents(prt)) {
        p[notifySym]();
      }
    }
  };

  return [prt, write] as const;
}
