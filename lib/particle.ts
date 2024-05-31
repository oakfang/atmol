export const readSym = Symbol("read");
export const notifySym = Symbol("notify");

const GLOBAL_GRAPH = new WeakMap<Particle<any>, Set<Particle<any>>>();

export function markAsDependent(parent: Particle<any>, child: Particle<any>) {
  if (!GLOBAL_GRAPH.has(parent)) {
    GLOBAL_GRAPH.set(parent, new Set());
  }
  GLOBAL_GRAPH.get(parent)?.add(child);

  return () => {
    GLOBAL_GRAPH.get(parent)?.delete(child);
  };
}

export function getDependents(parent: Particle<any>) {
  return GLOBAL_GRAPH.get(parent) ?? new Set();
}

/**
 * A particle is a lightweight object that represents a value that can be read and tracked for changes.
 */
export type Particle<T> = {
  readonly [readSym]: () => T;
  readonly [notifySym]: () => void;
};
