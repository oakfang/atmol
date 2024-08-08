import type { Particle } from './particle';

const bucket = () => new WeakMap<Particle<unknown>, Set<Particle<unknown>>>();
const empty = () => new Set<Particle<unknown>>();

const DEPENDENT_TO_DEPENDENCIES = bucket();
const DEPENDENCY_TO_DEPENDENTS = bucket();
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
    DEPENDENT_TO_DEPENDENCIES.set(dependent, empty());
  }
  DEPENDENT_TO_DEPENDENCIES.get(dependent)?.add(dependency);
  if (!DEPENDENCY_TO_DEPENDENTS.has(dependency)) {
    DEPENDENCY_TO_DEPENDENTS.set(dependency, empty());
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
  return DEPENDENCY_TO_DEPENDENTS.get(dependency) ?? empty();
}
