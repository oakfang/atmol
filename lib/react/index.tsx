import { get } from '@/base/ops';
import type { Particle } from '@/base/particle';
import { async, wave } from '@/base/wave';
import type { Reaction } from '@/reaction';
import {
  createContext,
  isValidElement,
  memo,
  useContext,
  useInsertionEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

type ExternalStore<T> = {
  subscribe: Parameters<typeof useSyncExternalStore<T>>[0];
  getState: Parameters<typeof useSyncExternalStore<T>>[1];
};

function createParticleStore<T>(particle: Particle<T>): ExternalStore<T> {
  return {
    getState() {
      return get(particle);
    },
    subscribe(callback) {
      return wave(() => {
        get(particle);
        callback();
      }, async);
    },
  };
}

/**
 * Custom React hook that returns the current value of a given {@link Particle} and updates the component when the value changes.
 *
 * @template T The type of value stored in the Particle
 * @param {Particle<T>} particle The Particle whose value is to be retrieved
 * @returns {T} The current value of the Particle
 */
export function useParticleValue<T>(particle: Particle<T>): T {
  const [store] = useState(() => createParticleStore(particle));
  const value = useSyncExternalStore(store.subscribe, store.getState);
  return value;
}

const COMPONENTS_CACHE = new WeakMap<
  Particle<ReactNode>,
  ComponentType<Record<string, never>>
>();

/**
 * Inline a particle with a renderable value within a component.
 *
 * @example
 * const count = atom(0);
 * function Component() {
 *   return (
 *     <div>
 *       <span>Count: {$(count)}</span>
 *     </div>
 *   );
 * }
 *
 * @param particle the particle to inline
 * @returns an anonymous component that tracks the particle's value and renders it
 */
export function $<T extends ReactNode>(particle: Particle<T>) {
  if (!COMPONENTS_CACHE.has(particle)) {
    COMPONENTS_CACHE.set(
      particle,
      memo(
        () => {
          const value = useParticleValue(particle);

          if (isValidElement(value)) return value;
          switch (typeof value) {
            case 'boolean':
            case 'string':
            case 'number':
              return value;
            case 'object':
              if (!value) return value;
          }

          throw new Error('Not a react node');
        },
        () => false,
      ),
    );
  }
  const Component = COMPONENTS_CACHE.get(particle);
  if (!Component) throw new Error('Component not found in cache');
  return <Component />;
}

/**
 * Custom React hook that manages the observation of a reaction so that it becomes unobserved when all observing components unmount.
 *
 * @template Value - The type of value stored in the reaction.
 * @param reaction - The {@link Reaction} object containing the result, error, state, observe, and unobserve functions.
 * @returns The {@link Reaction} object whose observation is now managed by the hook.
 */
export function useReaction<Value>(reaction: Reaction<Value>) {
  useInsertionEffect(() => {
    reaction.observe();
    return () => reaction.unobserve();
  }, [reaction]);
  return reaction;
}

export function createOrganism<T>(organismFactory: () => T) {
  const OrganismContext = createContext<T | null>(null);
  function Organism({ children }: PropsWithChildren) {
    const [organism] = useState(organismFactory);
    return (
      <OrganismContext.Provider value={organism}>
        {children}
      </OrganismContext.Provider>
    );
  }

  return Object.assign(Organism, {
    use() {
      const organism = useContext(OrganismContext);
      if (!organism) throw new Error('Organism not found');
      return organism;
    },
  });
}
