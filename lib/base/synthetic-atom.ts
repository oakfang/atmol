import { type Atom, writeSym } from './atom';
import { getDependents } from './graph';
import { notifySym, readSym } from './particle';

type Subscribe = (listener: () => void) => () => void;
type GetSnapshot<T> = () => T;
type SendUpdate<T> = (value: T) => void;

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
): Atom<T> {
  let unsubscribe: null | (() => void) = null;

  function reSubscribe() {
    unsubscribe?.();
    unsubscribe = subscribe(notify);
  }

  const atm = {
    [readSym]: () => {
      if (getDependents(atm).size && !unsubscribe) {
        reSubscribe();
      }
      return getSnapshot();
    },
    [writeSym](f) {
      const nextValue =
        typeof f === 'function' ? (f as (v: T) => T)(getSnapshot()) : f;
      if (!unsubscribe) {
        reSubscribe();
      }

      sendUpdate(nextValue);
    },
    [notifySym]() {},
  } satisfies Atom<T>;

  function notify() {
    const deps = getDependents(atm);
    if (deps.size === 0) {
      unsubscribe?.();
      unsubscribe = null;
    }
    for (const p of deps) {
      p[notifySym]();
    }
  }

  reSubscribe();

  return atm;
}
