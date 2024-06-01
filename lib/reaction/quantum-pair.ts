import { getDependents } from "../graph";
import { notifySym, readSym, type Particle } from "../particle";

export function createQuantumPair<T>(initialValue: T) {
  let value = initialValue;

  const prt = {
    [readSym]: () => value,
    [notifySym]() {},
  } satisfies Particle<T>;

  const write = (nextValue: T) => {
    if (nextValue !== value) {
      value = nextValue;
      getDependents(prt).forEach((p) => p[notifySym]());
    }
  };

  return [prt, write] as const;
}
