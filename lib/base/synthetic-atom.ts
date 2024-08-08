import { type Atom, writeSym } from './atom';
import { getDependents } from './graph';
import { notifySym, readSym } from './particle';

type Subscribe = (listener: () => void) => () => void;
type GetSnapshot<T> = () => T;
type SendUpdate<T> = (value: T) => void;

export const disposeSym: typeof Symbol.dispose =
  Symbol.dispose ?? Symbol('dispose');

interface Disposable {
  readonly [disposeSym]: () => void;
}

/**
 * Interface extending {@link Atom<T>} that syncs with a non-particle data store.
 */
export type SyntheticAtom<T> = Disposable & Atom<T>;

/**
 * Create a {@link SyntheticAtom} that syncs with a non-particle data store, using very similar APIs to React's `syncExternalStore`.
 * https://react.dev/reference/react/useSyncExternalStore#usesyncexternalstore
 *
 * @param subscribe A function which takes callback argument and subscribes it to the store (invoking it when the store's value changes). It should return an "unsubscribe" function.
 * @param getSnapshot A function which returns the current value of the store.
 * @param sendUpdate A function which accepts a new value and updates the store.
 * @returns A {@link SyntheticAtom} object with read and write capabilities.
 */
export function synth<T>(
  subscribe: Subscribe,
  getSnapshot: GetSnapshot<T>,
  sendUpdate: SendUpdate<T>,
): SyntheticAtom<T> {
  let currentValue = getSnapshot();

  const atm = {
    [readSym]: () => currentValue,
    [writeSym](f) {
      const nextValue =
        typeof f === 'function' ? (f as (v: T) => T)(currentValue) : f;
      sendUpdate(nextValue);
    },
    [notifySym]() {},
    [disposeSym]() {
      unsubscribe();
    },
  } satisfies SyntheticAtom<T>;

  function notify() {
    for (const p of getDependents(atm)) {
      p[notifySym]();
    }
  }

  const unsubscribe = subscribe(() => {
    const nextValue = getSnapshot();
    if (nextValue !== currentValue) {
      currentValue = nextValue;
      notify();
    }
  });

  return atm;
}
