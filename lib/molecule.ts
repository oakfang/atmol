import { getDependents, runInContext } from "./graph";
import { get } from "./ops";
import { notifySym, readSym, type Particle } from "./particle";

/**
 * Creates a new particle representing a molecule with the given factory function.
 * The molecule tracks its dependencies and updates its value when needed.
 * The molecule will attempt to defer its computation until it is necessary (e.g. when it's another particle's depencency, or when its value is being read).
 *
 * @param factory A function computes the value of the molecule.
 * @returns A {@link Particle} representing the molecule with the specified behavior.
 */
export function molecule<T>(factory: () => T): Particle<T> {
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
      cachedValue = runInContext(mol, factory);
      isDirty = false;
      return cachedValue;
    },
  } satisfies Particle<T>;

  return mol;
}
