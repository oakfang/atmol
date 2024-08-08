import { getDependents } from './graph';
import { type Particle, notifySym, readSym } from './particle';

export const writeSym = Symbol();

export type Writer<T> = T | ((current: T) => T);

/**
 * Interface extending {@link Particle<T>} that enables write access with the `set` operator.
 */
export interface Atom<T> extends Particle<T> {
  readonly [writeSym]: (v: Writer<T>) => void;
}

/**
 * Creates an {@link Atom} object with the provided initial value.
 *
 * @param initialValue The initial value for the Atom.
 * @returns An {@link Atom} object with read and write capabilities.
 */
export function atom<T>(initialValue: T): Atom<T> {
  let value = initialValue;

  const atm = {
    [readSym]: () => value,
    [writeSym](f) {
      const nextValue = typeof f === 'function' ? (f as (v: T) => T)(value) : f;
      if (nextValue !== value) {
        value = nextValue;
        for (const p of getDependents(atm)) {
          p[notifySym]();
        }
      }
    },
    [notifySym]() {},
  } satisfies Atom<T>;

  return atm;
}
