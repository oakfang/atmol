import { test, expect, mock, describe, it, beforeEach, afterEach } from 'bun:test';
import { Observable, type Observer, type SubscriptionObserver } from '.';

let errMock: typeof console.error;
beforeEach(() => {
  errMock = console.error;
  console.error = mock();
});
afterEach(() => {
  console.error = errMock;
});

describe('Observable', () => {
  test('Argument types', () => {
    // @ts-expect-error
    expect(() => new Observable({})).toThrow(TypeError);
    // @ts-expect-error
    expect(() => new Observable(false)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => new Observable(null)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => new Observable(undefined)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => new Observable(1)).toThrow(TypeError);
    expect(() => new Observable(() => {})).not.toThrow(TypeError);
  });

  test('Observable.prototype has a constructor property', () => {
    expect(Observable.prototype.constructor).toBe(Observable);
  });

  test('Subscriber function is not called by constructor', () => {
    const spy = mock();
    new Observable(spy);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Observable.prototype.subscribe', () => {
  test('Observable.prototype has a subscribe property', () => {
    expect(
      Reflect.getOwnPropertyDescriptor(Observable.prototype, 'subscribe'),
    ).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Any value passed as observer will not cause subscribe to throw', () => {
    const x = new Observable(() => {});
    for (const option of [
      null,
      undefined,
      1,
      true,
      'string',
      {},
      Object(1),
      () => {},
    ]) {
      expect(() => x.subscribe(option)).not.toThrow();
    }
  });

  test('Function arguments', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const list: any[] = [];
    const error = new Error();

    new Observable((s) => {
      s.next(1);
      s.error(error);
    }).subscribe(
      (x) => list.push(`next:${x}`),
      (e) => list.push(e),
      () => list.push('complete:'),
    );

    new Observable((s) => {
      s.complete();
    }).subscribe(
      (x) => list.push(`next:${x}`),
      (e) => list.push(e),
      () => list.push('complete'),
    );

    expect(list).toEqual(['next:1', error, 'complete']);
  });

  test('Second and third arguments are optional', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const list: any[] = [];
    new Observable((s) => {
      s.next(1);
      s.complete();
    }).subscribe((x) => list.push(`next:${x}`));
    expect(list).toEqual(['next:1']);
  });

  test('Subscriber arguments', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    let observer: any;
    new Observable((x) => {
      observer = x;
    }).subscribe({});
    expect(typeof observer).toBe('object');
    expect(typeof observer.next).toBe('function');
    expect(typeof observer.error).toBe('function');
    expect(typeof observer.complete).toBe('function');
    expect(observer.constructor).toBe(Object);
  });

  test('Subscriber return types', () => {
    const sink = {};

    expect(() => new Observable(() => undefined).subscribe(sink)).not.toThrow();
    expect(() => new Observable(() => null).subscribe(sink)).not.toThrow();
    expect(() => new Observable(() => () => {}).subscribe(sink)).not.toThrow();
    expect(() =>
      new Observable(() => ({ unsubscribe() {} })).subscribe(sink),
    ).not.toThrow();

    let error: unknown;
    new Observable(() => ({})).subscribe({
      error(e) {
        error = e;
      },
    });
    expect(error).toBeInstanceOf(TypeError);

    error = undefined;
    new Observable(() => 0).subscribe({
      error(e) {
        error = e;
      },
    });
    expect(error).toBeInstanceOf(TypeError);

    error = undefined;
    new Observable(() => false).subscribe({
      error(e) {
        error = e;
      },
    });
    expect(error).toBeInstanceOf(TypeError);
  });

  test('Returns a subscription object', () => {
    let called = 0;
    const subscription = new Observable(() => {
      return () => called++;
    }).subscribe({});

    expect(
      Reflect.getOwnPropertyDescriptor(subscription, 'unsubscribe'),
    ).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );

    expect(Reflect.getOwnPropertyDescriptor(subscription, 'closed')).toEqual(
      expect.objectContaining({
        get: expect.any(Function),
        configurable: true,
      }),
    );

    expect(typeof subscription).toBe('object');
    expect(subscription.constructor).toBe(Object);
    expect(subscription.closed).toBe(false);
    expect(subscription.unsubscribe()).toBe(undefined);
    expect(called).toBe(1);
    expect(subscription.closed).toBe(true);
  });

  test('cleanup function', () => {
    let called = 0;
    let returned = 0;
    let subscription = new Observable(() => {
      return () => called++;
    }).subscribe({
      complete() {
        returned++;
      },
    });
    expect(called).toBe(0);
    expect(returned).toBe(0);

    subscription.unsubscribe();
    expect(called).toBe(1);
    expect(returned).toBe(0);
    subscription.unsubscribe();
    expect(called).toBe(1);

    called = 0;
    new Observable((sink) => {
      sink.error(1);
      return () => {
        called++;
      };
    }).subscribe({
      error() {},
    });
    expect(called).toBe(1);

    called = 0;
    new Observable((sink) => {
      sink.complete();
      return () => {
        called++;
      };
    }).subscribe({
      next() {},
    });
    expect(called).toBe(1);

    let unsubscribeArgs: unknown;
    called = 0;

    subscription = new Observable((sink) => {
      return {
        // @ts-expect-error
        unsubscribe(...args) {
          called = 1;
          unsubscribeArgs = args;
        },
      };
    }).subscribe({
      next() {},
    });

    // @ts-expect-error
    subscription.unsubscribe(1);
    expect(called).toBe(1);
    expect(unsubscribeArgs).toEqual([]);
  });

  test('Exception thrown from the subscriber', () => {
    const error = new Error();
    const subscription = new Observable(() => {
      throw error;
    });

    expect(() => subscription.subscribe({})).not.toThrow(error);

    let thrown: unknown;

    expect(() =>
      subscription.subscribe({
        error(e) {
          thrown = e;
        },
      }),
    ).not.toThrow(error);
    expect(thrown).toBe(error);
  });

  test('Start method', () => {
    let events: string[] = [];

    const observable = new Observable((observer) => {
      events.push('subscriber');
      observer.complete();
    });

    interface Test extends Observer<void> {
      startCalls: number;
      thisValue: unknown;
      subscription: unknown;
    }

    let observer: Test = {
      startCalls: 0,
      thisValue: null,
      subscription: null,

      start(subscription) {
        events.push('start');
        observer.startCalls++;
        observer.thisValue = this;
        observer.subscription = subscription;
      },
    };

    let subscription = observable.subscribe(observer);

    expect(observer.startCalls).toBe(1);
    expect(observer.thisValue).toBe(observer);
    expect(observer.subscription).toBe(subscription);
    expect(events).toEqual(['start', 'subscriber']);

    events = [];

    observer = {
      ...observer,
      start(subscription) {
        events.push('start');
        subscription.unsubscribe();
      },
    } satisfies Test;

    subscription = observable.subscribe(observer);
    expect(events).toEqual(['start']);
  });

  test('cleanup function is called when signal is aborted', () => {
    let observer!: SubscriptionObserver<void>;
    let called = 0;
    const observable = new Observable<void>((x) => {
      observer = x;
      return () => called++;
    });

    const ctrl = new AbortController();
    observable.subscribe({}, { signal: ctrl.signal });

    ctrl.abort();
    expect(called).toBe(1);
  });
});

describe('Observable.prototype[symbol-observable]', () => {
  test('Observable.prototype has a [symbol-observable] property', () => {
    expect(
      Reflect.getOwnPropertyDescriptor(Observable.prototype, Symbol.observable),
    ).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Return value', () => {
    const thisValue = {};
    expect(
      Reflect.getOwnPropertyDescriptor(
        Observable.prototype,
        Symbol.observable,
      )?.value?.call(thisValue),
    ).toBe(
      // @ts-expect-error
      thisValue,
    );
  });
});

describe('Observable.of', () => {
  test('Observable.of has a static property', () => {
    expect(Reflect.getOwnPropertyDescriptor(Observable, 'of')).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Uses the this value if it is callable', () => {
    let usesThis = false;
    Observable.of.call(function _() {
      usesThis = true;
    });
    expect(usesThis).toBe(true);
  });

  test('Uses Observable if this value is not callable', () => {
    const result = Observable.of.call({}, 1, 2, 3, 4);
    expect(result).toBeInstanceOf(Observable);
  });

  test('Arguments are delivered to next', () => {
    const list: unknown[] = [];
    Observable.of(1, 2, 3, 4).subscribe({
      next(x) {
        list.push(x);
      },
    });
    expect(list).toEqual([1, 2, 3, 4]);
  });
});

describe('Observable.from', () => {
  test('Observable.from has a static property', () => {
    expect(Reflect.getOwnPropertyDescriptor(Observable, 'from')).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Allowed argument types', () => {
    // @ts-expect-error
    expect(() => Observable.from(null)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => Observable.from(undefined)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => Observable.from()).toThrow(TypeError);
  });

  test('Uses the this value if it is callable', () => {
    let usesThis = false;
    Observable.from.call(function _() {
      usesThis = true;
    }, []);
    expect(usesThis).toBe(true);
  });

  test('Uses Observable if this value is not callable', () => {
    const result = Observable.from.call({}, [1, 2, 3, 4]);
    expect(result).toBeInstanceOf(Observable);
  });

  describe('Symbol.observable method', () => {
    it('is accessed', () => {
      let called = 0;
      Observable.from({
        // @ts-expect-error
        get [Symbol.observable]() {
          called++;
          return () => ({});
        },
      });

      expect(called).toBe(1);
    });

    it('must be a function', () => {
      for (const x of [{}, 0, null, undefined]) {
        expect(() =>
          Observable.from({
            // @ts-expect-error
            [Symbol.observable]: x,
          }),
        ).toThrow(TypeError);
      }
    });

    it('Is called', () => {
      let called = 0;
      Observable.from({
        // @ts-expect-error
        [Symbol.observable]() {
          called++;
          return {};
        },
      });

      expect(called).toBe(1);
    });
  });

  describe('Return value of Symbol.observable', () => {
    it('Throws if the return value of Symbol.observable is not an object', () => {
      expect(() =>
        Observable.from({
          // @ts-expect-error
          [Symbol.observable]() {
            return 0;
          },
        }),
      ).toThrow(TypeError);
      expect(() =>
        Observable.from({
          // @ts-expect-error
          [Symbol.observable]() {
            return null;
          },
        }),
      ).toThrow(TypeError);
      // @ts-expect-error
      expect(() => Observable.from({ [Symbol.observable]() {} })).toThrow(
        TypeError,
      );

      expect(() =>
        Observable.from({
          // @ts-expect-error
          [Symbol.observable]() {
            return {};
          },
        }),
      ).not.toThrow();
      expect(() =>
        Observable.from({
          // @ts-expect-error
          get [Symbol.observable]() {
            return () => ({});
          },
        }),
      ).not.toThrow();
    });

    it("Returns the result of Symbol.observable if the object's constructor property is the target", () => {
      function target() {}
      const returnValue = { constructor: target };

      const result = Observable.from.call(target, {
        // @ts-expect-error
        [Symbol.observable]() {
          return returnValue;
        },
      });

      // @ts-expect-error
      expect(result).toBe(returnValue);
    });

    it('Calls the constructor if returned object does not have matching constructor property', () => {
      const token = {};
      let input: unknown = null;

      function target(this: { fn: unknown; token: unknown }, fn: unknown) {
        this.fn = fn;
        this.token = token;
      }

      const result = Observable.from.call(target, {
        // @ts-expect-error
        [Symbol.observable]() {
          return {
            subscribe(x) {
              input = x;
              return token;
            },
          };
        },
      }) as unknown as { fn: (...args: unknown[]) => unknown; token: unknown };

      expect(result.token).toBe(token);
      expect(result.fn).toBeInstanceOf(Function);
      expect(result.fn(123)).toBe(token);
      expect(input).toBe(123);
    });

    test('Iterables: values are delivered to next', () => {
      const values: number[] = [];
      let complete = false;
      Observable.from([1, 2, 3, 4]).subscribe({
        next(x) {
          values.push(x);
        },
        complete() {
          complete = true;
        },
      });

      expect(values).toEqual([1, 2, 3, 4]);
      expect(complete).toBe(true);
    });

    test('AsyncIterables: values are delivered to next', async () => {
      const values: number[] = [];
      await new Promise<void>((resolve, reject) =>
        Observable.from(
          (async function* () {
            yield 1;
            yield 2;
            yield 3;
            yield 4;
          })(),
        ).subscribe({
          next(x) {
            values.push(x);
          },
          complete: resolve,
          error: reject,
        }),
      );
      expect(values).toEqual([1, 2, 3, 4]);
    });

    test('Promises: values are delivered to next', async () => {
      const values: number[] = [];
      await new Promise<void>((resolve, reject) =>
        Observable.from(
          Promise.resolve(1).then((x) => {
            values.push(x);
            return 2;
          }),
        ).subscribe({
          next(x) {
            values.push(x);
          },
          complete: resolve,
          error: reject,
        }),
      );
      expect(values).toEqual([1, 2]);
    });

    test('Promises: errors are delivered to error', async () => {
      const errors: unknown[] = [];
      await new Promise<void>((resolve) =>
        Observable.from(Promise.reject(1)).subscribe({
          next() {},
          complete: resolve,
          error(x) {
            errors.push(x);
            resolve();
          },
        }),
      );
      expect(errors).toEqual([1]);
    });

    test('Non-convertables throw', async () => {
      // @ts-expect-error
      expect(() => Observable.from({})).toThrow(TypeError);
    });
  });
});

describe('observer:next', () => {
  test('SubscriptionObserver.prototype has an next method', () => {
    let observer!: SubscriptionObserver<unknown>;
    new Observable((x) => {
      observer = x;
    }).subscribe({});
    expect(Reflect.getOwnPropertyDescriptor(observer, 'next')).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Input value', () => {
    const token = {};
    new Observable((observer) => {
      // @ts-expect-error
      observer.next(token, 1, 2);
    }).subscribe({
      next(x, ...args) {
        expect(x).toBe(token);
        expect(args).toEqual([]);
      },
    });
  });

  test('Return value', () => {
    const token = {};
    new Observable<void>((observer) => {
      expect(observer.next()).toBe(undefined);
      observer.complete();
      expect(observer.next()).toBe(undefined);
    }).subscribe({
      next() {
        return token;
      },
    });
  });

  test('Thrown errors are caught', () => {
    new Observable<void>((observer) => {
      expect(observer.next()).toBe(undefined);
    }).subscribe({
      next() {
        throw new Error();
      },
    });
  });

  describe('Method lookup', () => {
    let observer!: SubscriptionObserver<void>;
    const observable = new Observable<void>((x) => {
      observer = x;
    });

    test('bad next values', () => {
      observable.subscribe({});
      expect(observer.next()).toBe(undefined);
      observable.subscribe({ next: undefined });
      expect(observer.next()).toBe(undefined);
      // @ts-expect-error
      observable.subscribe({ next: null });
      expect(observer.next()).toBe(undefined);
      // @ts-expect-error
      observable.subscribe({ next: {} });
      expect(observer.next()).toBe(undefined);
    });

    test('Method is not accessed until next is called', () => {
      const actual: Observer<void> = {};
      let calls = 0;

      observable.subscribe(actual);
      actual.next = () => calls++;
      expect(observer.next() ?? calls).toBe(1);
    });

    test('Method is accessed after complete is called', () => {
      let called = 0;
      observable.subscribe({
        get next() {
          called++;
          return () => {};
        },
      });
      observer.complete();
      observer.next();
      expect(called).toBe(0);
    });

    test('Property is only accessed once during a lookup', () => {
      let called = 0;
      observable.subscribe({
        get next() {
          called++;
          return () => {};
        },
      });
      observer.next();
      expect(called).toBe(1);
    });
  });

  test('cleanup function', () => {
    let observer!: SubscriptionObserver<void>;

    const observable = new Observable<void>((x) => {
      observer = x;
      return () => {};
    });

    const subscription = observable.subscribe({
      next() {
        throw new Error();
      },
    });
    observer.next();

    expect(subscription.closed).toBe(false);
  });
});

describe('observer:error', () => {
  test('SubscriptionObserver.prototype has an error method', () => {
    let observer!: SubscriptionObserver<unknown>;
    new Observable((x) => {
      observer = x;
    }).subscribe({});
    expect(Reflect.getOwnPropertyDescriptor(observer, 'error')).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Input value', () => {
    const token = {};
    new Observable((observer) => {
      // @ts-expect-error
      observer.error(token, 1, 2);
    }).subscribe({
      error(x, ...args) {
        expect(x).toBe(token);
        expect(args).toEqual([]);
      },
    });
  });

  test('Return value', () => {
    const token = {};
    new Observable<void>((observer) => {
      expect(observer.error(undefined)).toBe(undefined);
      observer.complete();
      expect(observer.error(undefined)).toBe(undefined);
    }).subscribe({
      error() {
        return token;
      },
    });
  });

  test('Thrown errors are caught', () => {
    new Observable<void>((observer) => {
      expect(observer.error(undefined)).toBe(undefined);
    }).subscribe({
      error() {
        throw new Error();
      },
    });
  });

  describe('Method lookup', () => {
    let observer!: SubscriptionObserver<void>;
    const error = new Error();
    const observable = new Observable<void>((x) => {
      observer = x;
    });

    test('bad error values', () => {
      observable.subscribe({});
      expect(observer.error(error)).toBe(undefined);
      observable.subscribe({ error: undefined });
      expect(observer.error(error)).toBe(undefined);
      // @ts-expect-error
      observable.subscribe({ error: null });
      expect(observer.error(error)).toBe(undefined);
      // @ts-expect-error
      observable.subscribe({ error: {} });
      expect(observer.error(error)).toBe(undefined);
    });

    test('Method is not accessed until error is called', () => {
      const actual: Observer<void> = {};
      let calls = 0;

      observable.subscribe(actual);
      actual.error = () => calls++;
      expect(observer.error(error) ?? calls).toBe(1);
    });

    test('Method is accessed after complete is called', () => {
      let called = 0;
      observable.subscribe({
        get error() {
          called++;
          return () => {};
        },
      });
      observer.complete();
      observer.error(error);
      expect(called).toBe(0);
    });

    test('Property is only accessed once during a lookup', () => {
      let called = 0;
      observable.subscribe({
        get error() {
          called++;
          return () => {};
        },
      });
      observer.error(error);
      expect(called).toBe(1);
    });

    test('when lookup occurs, subscription is closed', () => {
      let called = 0;
      observable.subscribe({
        next() {
          called++;
        },
        get error() {
          called++;
          observer.next();
          return () => {};
        },
      });
      observer.error(error);
      expect(called).toBe(1);
    });
  });

  describe('cleanup function', () => {
    it('is called when observer does not have an error method', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({});
      observer.error(new Error());
      expect(called).toBe(1);
    });

    it('is called when observer has an error method', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({
        error(errorValue) {
          return errorValue;
        },
      });
      observer.error(new Error());
      expect(called).toBe(1);
    });

    it('is called when method lookup throws', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({
        // @ts-expect-error
        get error() {
          throw new Error();
        },
      });
      observer.error(new Error());
      expect(called).toBe(1);
    });

    it('is called when method throws', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({
        error() {
          throw new Error();
        },
      });
      observer.error(new Error());
      expect(called).toBe(1);
    });
  });
});

describe('observer:complete', () => {
  test('SubscriptionObserver.prototype has an complete method', () => {
    let observer!: SubscriptionObserver<unknown>;
    new Observable((x) => {
      observer = x;
    }).subscribe({});
    expect(Reflect.getOwnPropertyDescriptor(observer, 'complete')).toEqual(
      expect.objectContaining({
        configurable: true,
        writable: true,
      }),
    );
  });

  test('Input value', () => {
    const token = {};
    new Observable((observer) => {
      // @ts-expect-error
      observer.complete(token, 1, 2);
    }).subscribe({
      complete(...args) {
        expect(args).toEqual([]);
      },
    });
  });

  test('Return value', () => {
    const token = {};
    new Observable<void>((observer) => {
      expect(observer.complete()).toBe(undefined);
      expect(observer.complete()).toBe(undefined);
    }).subscribe({
      complete() {
        return token;
      },
    });
  });

  test('Thrown errors are caught', () => {
    new Observable<void>((observer) => {
      expect(observer.complete()).toBe(undefined);
    }).subscribe({
      complete() {
        throw new Error();
      },
    });
  });

  describe('Method lookup', () => {
    let observer!: SubscriptionObserver<void>;
    const observable = new Observable<void>((x) => {
      observer = x;
    });

    test('bad complete values', () => {
      observable.subscribe({});
      expect(observer.complete()).toBe(undefined);
      observable.subscribe({ complete: undefined });
      expect(observer.complete()).toBe(undefined);
      // @ts-expect-error
      observable.subscribe({ complete: null });
      expect(observer.complete()).toBe(undefined);
      // @ts-expect-error
      observable.subscribe({ complete: {} });
      expect(observer.complete()).toBe(undefined);
    });

    test('Method is not accessed until complete is called', () => {
      const actual: Observer<void> = {};
      let calls = 0;

      observable.subscribe(actual);
      actual.complete = () => calls++;
      expect(observer.complete() ?? calls).toBe(1);
    });

    test('Method is accessed after complete is called', () => {
      let called = 0;
      observable.subscribe({
        get complete() {
          called++;
          return () => {};
        },
      });
      observer.error(new Error());
      observer.complete();
      expect(called).toBe(0);
    });

    test('Property is only accessed once during a lookup', () => {
      let called = 0;
      observable.subscribe({
        get complete() {
          called++;
          return () => {};
        },
      });
      observer.complete();
      expect(called).toBe(1);
    });

    test('when lookup occurs, subscription is closed', () => {
      let called = 0;
      observable.subscribe({
        next() {
          called++;
        },
        get complete() {
          called++;
          observer.next();
          return () => {};
        },
      });
      observer.complete();
      expect(called).toBe(1);
    });
  });

  describe('cleanup function', () => {
    it('is called when observer does not have a complete method', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({});
      observer.complete();
      expect(called).toBe(1);
    });

    it('is called when observer has a complete method', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({
        complete() {
          return;
        },
      });
      observer.complete();
      expect(called).toBe(1);
    });

    it('is called when method lookup throws', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({
        // @ts-expect-error
        get complete() {
          throw new Error();
        },
      });
      observer.complete();
      expect(called).toBe(1);
    });

    it('is called when method throws', () => {
      let observer!: SubscriptionObserver<void>;
      let called = 0;
      const observable = new Observable<void>((x) => {
        observer = x;
        return () => called++;
      });

      observable.subscribe({
        complete() {
          throw new Error();
        },
      });
      observer.complete();
      expect(called).toBe(1);
    });
  });
});

describe('observer:closed', () => {
  test('SubscriptionObserver.prototype has a closed property', () => {
    let observer!: SubscriptionObserver<unknown>;
    new Observable((x) => {
      observer = x;
    }).subscribe({});
    expect(Reflect.getOwnPropertyDescriptor(observer, 'closed')).toEqual(
      expect.objectContaining({
        configurable: true,
        get: expect.any(Function),
      }),
    );
  });

  it('returns false when subscription is active', () => {
    new Observable((observer) => {
      expect(observer.closed).toBe(false);
    }).subscribe({});
  });

  it('returns true when subscription is closed', () => {
    new Observable((observer) => {
      observer.complete();
      expect(observer.closed).toBe(true);
    }).subscribe({});

    new Observable((observer) => {
      observer.error(new Error());
      expect(observer.closed).toBe(true);
    }).subscribe({});

    let observer!: SubscriptionObserver<void>;
    new Observable((x) => {
      observer = x;
    })
      .subscribe({})
      .unsubscribe();
    expect(observer.closed).toBe(true);
  });
});
