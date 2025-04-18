if (!('observable' in Symbol)) {
  // @ts-expect-error
  Symbol.observable = Symbol('@observable');
}

declare global {
  interface SymbolConstructor {
    readonly observable: unique symbol;
  }
}

export interface Subscription {
  unsubscribe(): void;
  get closed(): boolean;
}

export interface Observer<T> {
  start?(subscription: Subscription): void;
  next?(value: T): void;
  error?(errorValue: unknown): void;
  complete?(): void;
}

export type SubscriptionObserver<T> = {
  next(value: T): void;
  error(errorValue: unknown): void;
  complete(): void;
  get closed(): boolean;
};

export type SubscriberFunction<T> = (
  observer: SubscriptionObserver<T>,
  // biome-ignore lint/complexity/noBannedTypes: is okay
) => (() => void) | null | undefined | {};

export interface IObservable<T> {
  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    onNext: Observer<T>['next'],
    onError?: Observer<T>['error'],
    onComplete?: Observer<T>['complete'],
  ): Subscription;
  [Symbol.observable](): IObservable<T>;
}

export class Observable<T> implements IObservable<T> {
  static of<T>(...args: T[]): Observable<T> {
    return new Observable((observer) => {
      for (const x of args) {
        observer.next(x);
      }
    });
  }

  static from<T>(
    source: Observable<T> | AsyncIterable<T> | Iterable<T> | Promise<T>,
  ): Observable<T> {
    if (!source || typeof source !== 'object') throw new TypeError();
    if (Symbol.observable in source) {
      return new Observable((observer) => {
        const sub = source[Symbol.observable]().subscribe(observer);
        return () => sub.unsubscribe();
      });
    }
    if (Symbol.asyncIterator in source) {
      return new Observable(async (observer) => {
        for await (const x of source) {
          observer.next(x);
        }
      });
    }
    if (Symbol.iterator in source) {
      return new Observable((observer) => {
        for (const x of source) {
          observer.next(x);
        }
      });
    }
    return new Observable((observer) =>
      source
        .then((v) => observer.next(v))
        .catch((e) => observer.error(e))
        .finally(() => observer.complete()),
    );
  }

  #observerFunction: SubscriberFunction<T>;

  constructor(subscriber: SubscriberFunction<T>) {
    this.#observerFunction = subscriber;
  }

  [Symbol.observable]() {
    return this;
  }

  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    onNext: (value: T) => void,
    onError?: (errorValue: unknown) => void,
    onComplete?: () => void,
  ): Subscription;
  subscribe(
    onNext: unknown,
    onError?: unknown,
    onComplete?: unknown,
  ): Subscription {
    const teardowns: Array<() => void> = [];
    let observer: Observer<T> | undefined = this.#isObserver(onNext)
      ? onNext
      : ({ next: onNext, error: onError, complete: onComplete } as Observer<T>);

    function cleanup() {
      observer = undefined;
      for (const fn of teardowns) {
        fn();
      }
    }

    const subscription = {
      unsubscribe() {
        if (observer) cleanup();
      },
      get closed() {
        return !observer;
      },
    } satisfies Subscription;

    const subscriptionObserver = {
      next(value) {
        if (subscription.closed) return;
        observer?.next?.(value);
      },
      error(errorValue) {
        if (subscription.closed) return;
        observer?.error?.(errorValue);
        cleanup();
      },
      complete() {
        if (subscription.closed) return;
        observer?.complete?.();
        cleanup();
      },
      get closed() {
        return subscription.closed;
      },
    } satisfies SubscriptionObserver<T>;

    const initialCleanup = this.#observerFunction(subscriptionObserver);
    if (typeof initialCleanup === 'function') {
      teardowns.push(initialCleanup as () => void);
    }

    return subscription;
  }

  #isObserver(value: unknown): value is Observer<T> {
    if (typeof value !== 'object' || !value) return false;
    return true;
  }
}
