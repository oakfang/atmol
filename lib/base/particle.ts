export const readSym = Symbol();
export const notifySym = Symbol();

/**
 * A particle is a lightweight object that represents a value that can be read and tracked for changes.
 */
export type Particle<T> = {
  readonly [readSym]: () => T;
  readonly [notifySym]: () => void;
};
