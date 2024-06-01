import { async, atom, get, peek, set, wave, type Particle } from "..";
import { createQuantumPair } from "./quantum-pair";

export type Reaction<Result> = {
  result: Particle<Result | null>;
  error: Particle<unknown | null>;
  state: Particle<"idle" | "pending" | "success" | "error">;
  observe: () => void;
  unobserve: () => void;
};

export type ReactionOptions = {
  autoObserve: boolean;
  keepPrevious: boolean;
};

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
