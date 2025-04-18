import type {
  IObservable,
  SubscriberFunction,
  Observer,
  Subscription,
  SubscriptionObserver,
} from './spec';

if (!('observable' in Symbol)) {
  // @ts-expect-error
  Symbol.observable = Symbol('@observable');
}

export class Observable<T> implements IObservable<T> {
  static of<T>(...args: T[]): Observable<T> {
    // biome-ignore lint/complexity/noThisInStatic: by the spec
    const Ctor = typeof this === 'function' ? this : Observable;
    return new Ctor((observer) => {
      for (const x of args) {
        observer.next(x);
      }
    });
  }

  static from<T>(
    source: Observable<T> | AsyncIterable<T> | Iterable<T> | Promise<T>,
  ): Observable<T> {
    if (!source || typeof source !== 'object') throw new TypeError();
    // biome-ignore lint/complexity/noThisInStatic: by the spec
    const Ctor = typeof this === 'function' ? this : Observable;
    if (Symbol.observable in source) {
      const origin = source[Symbol.observable]();
      if (typeof origin !== 'object' || origin === null) throw new TypeError();
      if ('constructor' in origin && origin.constructor === Ctor) {
        return origin;
      }
      return new Ctor((observer) => origin.subscribe(observer));
    }
    if (Symbol.asyncIterator in source) {
      return new Ctor((observer) => {
        (async () => {
          try {
            for await (const x of source) {
              observer.next(x);
            }
            observer.complete();
          } catch (error) {
            observer.error(error);
          }
        })();
      });
    }
    if (Symbol.iterator in source) {
      return new Ctor((observer) => {
        for (const x of source) {
          observer.next(x);
        }
        observer.complete();
      });
    }
    if (source instanceof Promise) {
      return new Ctor((observer) => {
        source
          .then((v) => observer.next(v))
          .catch((e) => observer.error(e))
          .finally(() => observer.complete());
      });
    }
    throw new TypeError();
  }

  #observerFunction: SubscriberFunction<T>;

  constructor(subscriber: SubscriberFunction<T>) {
    if (typeof subscriber !== 'function') {
      throw new TypeError('Observable must be constructed with a function');
    }
    this.#observerFunction = subscriber;
  }

  [Symbol.observable]() {
    return this;
  }

  subscribe(
    observer: Observer<T>,
    options?: { signal?: AbortSignal },
  ): Subscription;
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
    const options =
      typeof onError === 'object'
        ? (onError as { signal?: AbortSignal })
        : undefined;
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        if (observer) cleanup();
      });
    }

    let cleanupFlag = false;
    let canRunCleanup = false;

    function cleanup() {
      cleanupFlag = true;
      observer = undefined;
      if (!canRunCleanup) return;
      canRunCleanup = false;
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
        try {
          const next = observer?.next;
          if (typeof next === 'function') {
            next.call(observer, value);
          }
        } catch (e) {
          console.error(
            'A call to an observer\' "next" method has thrown the following error:',
            e,
          );
        }
      },
      error(errorValue) {
        if (subscription.closed) return;
        const currentObserver = observer;
        observer = undefined;
        try {
          const error = currentObserver?.error;
          if (typeof error === 'function') {
            error.call(currentObserver, errorValue);
          }
        } catch (e) {
          console.error(
            'A call to an observer\' "error" method has thrown the following error:',
            e,
          );
        }
        cleanup();
      },
      complete() {
        if (subscription.closed) return;
        const currentObserver = observer;
        observer = undefined;
        try {
          const complete = currentObserver?.complete;
          if (typeof complete === 'function') {
            complete.call(currentObserver);
          }
        } catch (e) {
          console.error(
            'A call to an observer\' "complete" method has thrown the following error:',
            e,
          );
        }
        cleanup();
      },
      get closed() {
        return subscription.closed;
      },
    } satisfies SubscriptionObserver<T>;

    observer.start?.(subscription);

    try {
      if (!subscription.closed) {
        const initialCleanup = this.#observerFunction(subscriptionObserver);
        switch (typeof initialCleanup) {
          case 'function':
            teardowns.push(initialCleanup as () => void);
            break;
          case 'object':
            if (initialCleanup) {
              if (
                'unsubscribe' in initialCleanup &&
                typeof initialCleanup.unsubscribe === 'function'
              ) {
                teardowns.push(initialCleanup.unsubscribe.bind(initialCleanup));
              } else {
                subscriptionObserver.error(
                  new TypeError(
                    'Subscriber function must return a function, a subscription object, or nothing',
                  ),
                );
              }
            }
            break;
          case 'undefined':
            break;
          default:
            subscriptionObserver.error(
              new TypeError(
                'Subscriber function must return a function, a subscription object, or nothing',
              ),
            );
        }
      }
      canRunCleanup = true;
      if (cleanupFlag) {
        cleanup();
      }
    } catch (error) {
      subscriptionObserver.error(error);
    }

    return subscription;
  }

  #isObserver(value: unknown): value is Observer<T> {
    if (typeof value !== 'object' || !value) return false;
    return true;
  }
}
