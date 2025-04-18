import { type Atom, type Writer, writeSym } from './atom';
import { markDependency } from './graph';
import { type Particle, readSym } from './particle';

/**
 * Retrieves the current value from the given {@link Particle} and mark it as a dependency in the current context.
 *
 * @param particle The {@link Particle} object from which to retrieve the value.
 * @returns The current value of the particle.
 */
export function get<T>(particle: Particle<T>): T {
  markDependency(particle);
  return peek(particle);
}

/**
 * Retrieves the current value from the given {@link Particle} without marking it as a dependency in the current context.
 *
 * @param particle The {@link Particle} object from which to retrieve the value.
 * @returns The current value of the particle.
 */
export function peek<T>(particle: Particle<T>): T {
  return particle[readSym]();
}

/**
 * Sets the value of the given {@link Atom} using the provided Writer function.
 *
 * @param atom The {@link Atom} to set the value for.
 * @param value either a new value to set, or a function that accepts the current value and returns a new value.
 */
export function set<T>(atom: Atom<T>, value: Writer<T>) {
  atom[writeSym](value);
}

export function isParticle(x: unknown): x is Particle<unknown> {
  if (x && typeof x === 'object') {
    return readSym in x;
  }
  return false;
}
