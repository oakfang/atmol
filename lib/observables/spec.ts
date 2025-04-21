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
  subscribe(
    observer: Observer<T>,
    options?: { signal?: AbortSignal },
  ): Subscription;
  subscribe(
    onNext: Observer<T>['next'],
    onError?: Observer<T>['error'],
    onComplete?: Observer<T>['complete'],
  ): Subscription;
  [Symbol.observable](): IObservable<T>;
}

export type ObservableLike<T> = IObservable<T> | AsyncIterable<T> | Iterable<T> | Promise<T>