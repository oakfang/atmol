import { async, atom, get, peek, set, wave, type Particle } from "..";
import { createQuantumPair } from "./quantum-pair";

/**
 * Defines a Reaction type that represents a set of particles for result, error, and state,
 * along with methods to observe and unobserve the reaction.
 */
export type Reaction<Result> = {
  result: Particle<Result | null>;
  error: Particle<unknown | null>;
  state: Particle<"idle" | "pending" | "success" | "error">;
  observe: () => void;
  unobserve: () => void;
};

/**
 * Defines the ReactionOptions type representing options for creating a reaction.
 *
 * @property autoObserve - A boolean indicating whether the reaction should automatically observe itself.
 * @property keepPrevious - A boolean indicating whether the previous result or error should be kept.
 */
export type ReactionOptions = {
  autoObserve: boolean;
  keepPrevious: boolean;
};

/**
 * Creates a reaction that triggers an asynchronous action based on a given trigger particle.
 * The reaction manages the state of the action (idle, pending, success, error) and provides
 * particles for the result and error values.
 *
 * @param trigger The trigger particle that initiates the action.
 * @param action The asynchronous function to be executed when the trigger changes.
 * @param options Additional options for configuring the reaction ({@link ReactionOptions}).
 * @returns An {@link Reaction} object containing the result particle, error particle, state particle, and methods to observe/unobserve the reaction.
 */
export function createReaction<Trigger, Result>(
  trigger: Particle<Trigger>,
  action: (input: Trigger) => Promise<Result>,
  { autoObserve = true, keepPrevious = false }: Partial<ReactionOptions> = {}
): Reaction<Result> {
  const observerCount = atom(autoObserve ? 1 : 0);
  const [state, setState] = createQuantumPair<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [result, setResult] = createQuantumPair<Result | null>(null);
  const [error, setError] = createQuantumPair<unknown | null>(null);
  let ctrl: AbortController | null = null;

  wave(() => {
    get(trigger);
    setState("idle");
  });

  wave(() => {
    const currentController = ctrl;
    if (!get(observerCount)) return;
    switch (get(state)) {
      case "idle":
        if (ctrl) {
          ctrl.abort();
        }
        ctrl = new AbortController();
        setState("pending");
        break;
      case "pending":
        action(peek(trigger)).then(
          (v) => {
            if (currentController?.signal.aborted) {
              return;
            }
            setResult(v);
            setState("success");
          },
          (e) => {
            if (currentController?.signal.aborted) {
              return;
            }
            setError(e);
            setState("error");
          }
        );
        if (!keepPrevious) {
          setResult(null);
          setError(null);
        }
        break;
      case "success":
        setError(null);
        break;
      case "error":
        setResult(null);
        break;
    }
  }, async);

  return {
    result,
    error,
    state,
    observe() {
      set(observerCount, get(observerCount) + 1);
    },
    unobserve() {
      set(observerCount, get(observerCount) - 1);
    },
  };
}
