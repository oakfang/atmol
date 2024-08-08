import type { Particle } from './particle';

const DEPENDENT_TO_DEPENDENCIES = new WeakMap<
  Particle<unknown>,
  Set<Particle<unknown>>
>();
const DEPENDENCY_TO_DEPENDENTS = new WeakMap<
  Particle<unknown>,
  Set<Particle<unknown>>
>();
const CONTEXT_STACK = Array<Particle<unknown>>();

export function runInContext<T>(particle: Particle<unknown>, fn: () => T): T {
  try {
    CONTEXT_STACK.push(particle);
    return fn();
  } finally {
    CONTEXT_STACK.pop();
  }
}

export function markDependency(dependency: Particle<unknown>) {
  const dependent = CONTEXT_STACK[CONTEXT_STACK.length - 1];
  if (!dependent) return;
  if (!DEPENDENT_TO_DEPENDENCIES.has(dependent)) {
    DEPENDENT_TO_DEPENDENCIES.set(dependent, new Set());
  }
  DEPENDENT_TO_DEPENDENCIES.get(dependent)?.add(dependency);
  if (!DEPENDENCY_TO_DEPENDENTS.has(dependency)) {
    DEPENDENCY_TO_DEPENDENTS.set(dependency, new Set());
  }
  DEPENDENCY_TO_DEPENDENTS.get(dependency)?.add(dependent);
}

export function releaseDependencies(particle: Particle<unknown>) {
  const dependents = DEPENDENT_TO_DEPENDENCIES.get(particle);
  if (!dependents) return;
  for (const dependent of dependents) {
    DEPENDENCY_TO_DEPENDENTS.get(dependent)?.delete(particle);
  }
  DEPENDENT_TO_DEPENDENCIES.delete(particle);
}

export function getDependents(dependency: Particle<unknown>) {
  return DEPENDENCY_TO_DEPENDENTS.get(dependency) ?? new Set();
}
