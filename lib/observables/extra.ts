import { Observable as BaseObservable } from './base';
import type { ObservableLike } from './spec';

export class Observable<T> extends BaseObservable<T> {
  static from<T>(source: ObservableLike<T>): Observable<T> {
    // biome-ignore lint/complexity/noThisInStatic: I know what I'm doing
    return BaseObservable.from.call(this, source) as Observable<T>;
  }
  static of<T>(...args: T[]): Observable<T> {
    // biome-ignore lint/complexity/noThisInStatic: I know what I'm doing
    return BaseObservable.of.call(this, ...args) as Observable<T>;
  }

  catch<V>(onError: (error: unknown) => ObservableLike<V>): Observable<T | V> {
    return new Observable<T | V>((observer) => {
      return this.subscribe({
        next(value) {
          observer.next(value);
        },
        error(error) {
          try {
            const result = onError(error);
            const observable = Observable.from(result);
            observable.subscribe(observer);
          } catch (e) {
            observer.error(e);
          }
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  finally(onFinally: () => void): Observable<T> {
    return new Observable<T>((observer) => {
      return this.subscribe({
        next(value) {
          observer.next(value);
        },
        error(error) {
          observer.error(error);
          onFinally();
        },
        complete() {
          observer.complete();
          onFinally();
        },
      });
    });
  }

  takeUntil(other: ObservableLike<unknown>): Observable<T> {
    return new Observable<T>((observer) => {
      const ctrl = new AbortController();
      this.subscribe(
        {
          next(value) {
            observer.next(value);
          },
          error(error) {
            observer.error(error);
            ctrl.abort();
          },
          complete() {
            observer.complete();
            ctrl.abort();
          },
        },
        { signal: ctrl.signal },
      );

      Observable.from(other).subscribe(
        {
          next() {
            observer.complete();
          },
          error() {
            observer.complete();
          },
        },
        { signal: ctrl.signal },
      );

      return () => {
        ctrl.abort();
      };
    });
  }

  take(limit: number): Observable<T> {
    if (!Number.isInteger(limit)) throw new TypeError();
    if (limit < 0) throw new RangeError();
    return new Observable<T>((observer) => {
      let count = 0;
      return this.subscribe({
        next(value) {
          if (count < limit) {
            observer.next(value);
            count++;
          }
          if (count === limit) {
            observer.complete();
          }
        },
        error(error) {
          observer.error(error);
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  drop(limit: number): Observable<T> {
    if (!Number.isInteger(limit)) throw new TypeError();
    if (limit < 0) throw new RangeError();
    return new Observable<T>((observer) => {
      let count = 0;
      return this.subscribe({
        next(value) {
          if (count < limit) {
            count++;
            return;
          }
          observer.next(value);
        },
        error(error) {
          observer.error(error);
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  map<V>(fn: (value: T, idx: number) => V): Observable<V> {
    return new Observable<V>((observer) => {
      let idx = 0;
      return this.subscribe({
        next(value) {
          observer.next(fn(value, idx++));
        },
        error(error) {
          observer.error(error);
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  filter(fn: (value: T, idx: number) => boolean): Observable<T> {
    return new Observable<T>((observer) => {
      let idx = 0;
      return this.subscribe({
        next(value) {
          if (fn(value, idx++)) {
            observer.next(value);
          }
        },
        error(error) {
          observer.error(error);
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  flatMap<V>(fn: (value: T, idx: number) => ObservableLike<V>): Observable<V> {
    return new Observable<V>((observer) => {
      const ctrl = new AbortController();
      const queue: T[] = [];
      let idx = 0;
      let outerComplete = false;
      let innerActive = false;

      function runFlatmap(value: T) {
        const observable = Observable.from(fn(value, idx++));
        observable.subscribe(
          {
            next(value) {
              observer.next(value);
            },
            error(error) {
              observer.error(error);
            },
            complete() {
              if (queue.length) {
                // biome-ignore lint/style/noNonNullAssertion: is fine
                runFlatmap(queue.shift()!);
              } else {
                innerActive = false;
                if (outerComplete) {
                  observer.complete();
                }
              }
            },
          },
          { signal: ctrl.signal },
        );
      }

      return this.subscribe(
        {
          next(value) {
            if (innerActive) {
              queue.push(value);
              return;
            }
            innerActive = true;
            runFlatmap(value);
          },
          error(error) {
            observer.error(error);
            ctrl.abort();
          },
          complete() {
            outerComplete = true;
            if (queue.length === 0) {
              observer.complete();
              ctrl.abort();
            }
          },
        },
        { signal: ctrl.signal },
      );
    });
  }

  reduce<V>(
    reducer: (accumulator: V, value: T, idx: number) => V,
    initialValue: V,
  ): Promise<V> {
    return new Promise<V>((resolve, reject) => {
      let value = initialValue;
      let idx = 0;

      this.subscribe({
        next(v) {
          value = reducer(value, v, idx++);
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve(value);
        },
      });
    });
  }

  toArray(): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const values: T[] = [];
      this.subscribe({
        next(value) {
          values.push(value);
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve(values);
        },
      });
    });
  }

  forEach(fn: (value: T, idx: number) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let idx = 0;
      this.subscribe({
        next(value) {
          fn(value, idx++);
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        },
      });
    });
  }

  some(fn: (value: T, idx: number) => boolean): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const ctrl = new AbortController();
      let idx = 0;
      this.subscribe(
        {
          next(value) {
            if (fn(value, idx++)) {
              resolve(true);
              ctrl.abort();
              return;
            }
          },
          error(error) {
            reject(error);
          },
          complete() {
            resolve(false);
          },
        },
        { signal: ctrl.signal },
      );
    });
  }

  every(fn: (value: T, idx: number) => boolean): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const ctrl = new AbortController();
      let idx = 0;
      this.subscribe(
        {
          next(value) {
            if (!fn(value, idx++)) {
              resolve(false);
              ctrl.abort();
              return;
            }
          },
          error(error) {
            reject(error);
          },
          complete() {
            resolve(true);
          },
        },
        { signal: ctrl.signal },
      );
    });
  }

  find(fn: (value: T, idx: number) => boolean): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, reject) => {
      const ctrl = new AbortController();
      let idx = 0;
      this.subscribe(
        {
          next(value) {
            if (fn(value, idx++)) {
              resolve(value);
              ctrl.abort();
              return;
            }
          },
          error(error) {
            reject(error);
          },
          complete() {
            resolve(undefined);
          },
        },
        { signal: ctrl.signal },
      );
    });
  }
}
