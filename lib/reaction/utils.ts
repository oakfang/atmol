import { get } from "../ops";
import { type Particle } from "../particle";
import { wave } from "../wave";

export function waitForParticleValue<T>(particle: Particle<T>, value: T) {
  return new Promise<void>((resolve) => {
    wave(() => {
      if (get(particle) === value) {
        resolve();
      }
    });
  });
}
