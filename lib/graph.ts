import type { Particle } from "./particle";

const DEPENDENT_TO_DEPENDENCIES = new WeakMap<
  Particle<any>,
  Set<Particle<any>>
>();
const DEPENDENCY_TO_DEPENDENTS = new WeakMap<
  Particle<any>,
  Set<Particle<any>>
>();
const CONTEXT_STACK = Array<Particle<any>>();

export function runInContext<T>(particle: Particle<any>, fn: () => T): T {
  try {
    CONTEXT_STACK.push(particle);
    return fn();
  } finally {
    CONTEXT_STACK.pop();
  }
}

export function markDependency(depencency: Particle<any>) {
  const dependent = CONTEXT_STACK[CONTEXT_STACK.length - 1];
  if (!dependent) return;
  if (!DEPENDENT_TO_DEPENDENCIES.has(dependent)) {
    DEPENDENT_TO_DEPENDENCIES.set(dependent, new Set());
  }
  DEPENDENT_TO_DEPENDENCIES.get(dependent)?.add(depencency);
  if (!DEPENDENCY_TO_DEPENDENTS.has(depencency)) {
    DEPENDENCY_TO_DEPENDENTS.set(depencency, new Set());
  }
  DEPENDENCY_TO_DEPENDENTS.get(depencency)?.add(dependent);
}

export function releaseDependencies(particle: Particle<any>) {
  const dependents = DEPENDENT_TO_DEPENDENCIES.get(particle);
  if (!dependents) return;
  for (const dependent of dependents) {
    DEPENDENCY_TO_DEPENDENTS.get(dependent)?.delete(particle);
  }
  DEPENDENT_TO_DEPENDENCIES.delete(particle);
}

export function getDependents(dependency: Particle<any>) {
  return DEPENDENCY_TO_DEPENDENTS.get(dependency) ?? new Set();
}
