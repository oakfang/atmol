import { get, peek, wave, type Particle } from '@/base';

export function asAsyncIterable<T>(particle: Particle<T>): AsyncIterable<T, T> {
  return {
    [Symbol.asyncIterator]() {
      let { promise, resolve } = Promise.withResolvers<T>();
      const unsubscribe = wave(() => {
        const value = get(particle);
        resolve(value);
      });
      return {
        async next(): Promise<IteratorResult<T, T>> {
          const value = await promise;
          const next = Promise.withResolvers<T>();
          promise = next.promise;
          resolve = next.resolve;
          return { value, done: false };
        },
        async return(): Promise<IteratorResult<T, T>> {
          unsubscribe();
          return { done: true, value: peek(particle) };
        },
      };
    },
  };
}
