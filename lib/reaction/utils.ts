import { get } from "../ops";
import { type Particle } from "../particle";
import { wave } from "../wave";

/**
 * Waits for a Particle to have a specific value and resolves the Promise when the value matches.
 * 
 * @param particle The Particle to monitor for the value.
 * @param value The value to wait for the Particle to have.
 * @returns A Promise that resolves when the Particle's value matches the specified value.
 */
export function waitForParticleValue<T>(particle: Particle<T>, value: T) {
  return new Promise<void>((resolve) => {
    wave(() => {
      if (get(particle) === value) {
        resolve();
      }
    });
  });
}
