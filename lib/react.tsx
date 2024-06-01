import {
  isValidElement,
  memo,
  useInsertionEffect,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ElementType,
  type JSXElementConstructor,
  type ReactNode,
} from "react";
import { molecule } from "./molecule";
import { get } from "./ops";
import type { Particle } from "./particle";
import { wave } from "./wave";
import type { Reaction } from "./reaction";

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
      });
    },
  };
}

/**
 * Custom React hook that returns the current value of a given {@link Particle} and updates it when the value changes.
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

const COMPONENTS_CACHE = new WeakMap<Particle<any>, ComponentType<{}>>();

type Reactive<T> = {
  [k in Exclude<keyof T, symbol> as `$${k}`]?: () => T[k];
};

/**
 * Creates a reactive component based on the provided element type and props.
 * Marking any prop with the `$` prefix will make it reactive, changing its type to a molecule's factory function
 *
 * @example
 * const count = atom(0);
 * function Component() {
 *   return (
 *     <Reactive
 *        as="button"
 *        $style={get => ({ padding: `${get(count)}em` })}
 *        onClick={() => set(count, c => c + 1)}
 *     >
 *       <span>Count: {$(count)}</span>
 *     </Reactive>
 *   );
 * }
 * @template T The type of the reactive component.
 */
export function Reactive<T extends ElementType>({
  as: As,
  ...props
}: { as: T } & ComponentPropsWithoutRef<T> &
  Reactive<ComponentPropsWithoutRef<T>>) {
  const [atm] = useState(() =>
    molecule(() => {
      const modProps = { ...props };
      for (const key of Object.keys(props)) {
        if (key.startsWith("$")) {
          const reactiveKey = key as keyof Reactive<
            ComponentPropsWithoutRef<T>
          > &
            keyof typeof props;
          const passiveKey = key.slice(1) as keyof ComponentPropsWithoutRef<T> &
            keyof typeof props;
          modProps[passiveKey] = (
            props[
              reactiveKey
            ] as () => ComponentPropsWithoutRef<T>[typeof passiveKey]
          )();
          delete modProps[reactiveKey];
        }
      }
      return (
        <As
          {...(modProps as T extends JSXElementConstructor<infer P>
            ? P extends JSX.IntrinsicAttributes
              ? P
              : never
            : never)}
        />
      );
    })
  );

  return $(atm);
}

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
 * @returns an annonymous component that tracks the particle's value and renders it
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
            case "boolean":
            case "string":
            case "number":
              return value;
            case "object":
              if (!value) return value;
          }

          throw new Error("Not a react node");
        },
        () => false
      )
    );
  }
  const Component = COMPONENTS_CACHE.get(particle)!;
  return <Component />;
}

/**
 * Custom React hook that manages the observation of a reaction so that it becomes unobserved when all observing components unmount.
 *
 * @template Value - The type of value stored in the reaction.
 * @param {Reaction<Value>} reaction - The reaction object containing the result, error, state, observe, and unobserve functions.
 * @returns {Reaction<Value>} The reaction object with observation side effects managed by the hook.
 */
export function useReaction<Value>(reaction: Reaction<Value>) {
  useInsertionEffect(() => {
    reaction.observe();
    return () => reaction.unobserve();
  }, [reaction]);
  return reaction;
}
