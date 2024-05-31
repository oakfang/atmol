import { get } from "./ops";
import {
  getDependents,
  markAsDependent,
  notifySym,
  readSym,
  type Particle,
} from "./particle";

export type Getter = <T>(atom: Particle<T>) => T;

/**
 * Creates a new particle representing a molecule with the given factory function.
 * The molecule tracks its dependencies and updates its value when needed.
 * The molecule will attempt to defer its computation until it is necessary (e.g. when it's another particle's depencency, or when its value is being read).
 *
 * @param factory A function computes the value of the molecule. It accepts a unique "get" operator that marks the particle as a dependency.
 * @returns A {@link Particle} representing the molecule with the specified behavior.
 */
export function molecule<T>(factory: (get: Getter) => T): Particle<T> {
  let isDirty = true;
  let cachedValue: T;

  const mol = {
    [notifySym]() {
      isDirty = true;
      const deps = getDependents(mol);
      if (deps.size === 0) return;
      const oldValue = cachedValue;
      const newValue = get(mol);
      if (newValue !== oldValue) {
        deps.forEach((p) => p[notifySym]());
      }
    },
    [readSym]() {
      if (!isDirty) return cachedValue;
      cachedValue = factory(getter);
      isDirty = false;
      return cachedValue;
    },
  } satisfies Particle<T>;

  function getter<T>(p: Particle<T>): T {
    markAsDependent(p, mol);
    return get(p);
  }

  return mol;
}
