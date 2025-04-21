import { describe, it, expect, mock } from 'bun:test';
import { Observable } from './extra';

describe('catch', () => {
  it('should propagate errors', () => {
    const observable = new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.error(3);
      observer.next(4);
    });

    const observable2 = observable.catch<never>((error) => {
      throw error;
    });

    expect(observable2).toBeInstanceOf(Observable);

    const values: number[] = [];
    observable2.subscribe({
      next(value) {
        values.push(value);
      },
    });
    expect(values).toEqual([1, 2]);
  });

  it('should map errors', () => {
    const observable = new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.error(new Error());
      observer.next(4);
    });

    const observable2 = observable.catch(function* () {
      yield 3;
      yield 5;
    });

    expect(observable2).toBeInstanceOf(Observable);

    const values: number[] = [];
    observable2.subscribe({
      next(value) {
        values.push(value);
      },
    });

    expect(values).toEqual([1, 2, 3, 5]);
  });
});

describe('finally', () => {
  it('should call finally on errors', () => {
    const observable = new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.error(3);
      observer.next(4);
    });
    const fin = mock();

    const observable2 = observable.finally(fin);
    expect(observable2).toBeInstanceOf(Observable);

    const values: number[] = [];
    observable2.subscribe({
      next(value) {
        values.push(value);
      },
    });

    expect(fin).toHaveBeenCalled();
    expect(values).toEqual([1, 2]);
  });

  it('should call finally on completion', () => {
    const observable = new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.complete();
    });

    const fin = mock();

    const observable2 = observable.finally(fin);
    expect(observable2).toBeInstanceOf(Observable);

    const values: number[] = [];
    observable2.subscribe({
      next(value) {
        values.push(value);
      },
    });

    expect(fin).toHaveBeenCalled();
    expect(values).toEqual([1, 2]);
  });
});

describe('takeUntil', () => {
  it('should complete when the other observable emits', async () => {
    const lock1 = Promise.withResolvers();
    const lock2 = Promise.withResolvers();
    const lock3 = Promise.withResolvers();
    const values: number[] = [];
    const routine = new Promise<void>((resolve) => {
      Observable.from(
        (async function* () {
          yield 1;
          yield 2;
          yield 3;
          await lock1.promise;
          await lock3.promise;
          yield 4;
          yield 5;
          yield 6;
        })(),
      )
        .takeUntil(lock2.promise)
        .subscribe({
          next(value) {
            values.push(value);
          },
          complete: resolve,
        });
    });

    lock1.resolve();
    await Bun.sleep(0);
    lock2.resolve();
    lock3.resolve();
    await routine;

    expect(values).toEqual([1, 2, 3]);
  });

  it('should complete when the other observable errors', async () => {
    const lock1 = Promise.withResolvers();
    const lock2 = Promise.withResolvers();
    const lock3 = Promise.withResolvers();
    const values: number[] = [];
    const routine = new Promise<void>((resolve) => {
      Observable.from(
        (async function* () {
          yield 1;
          yield 2;
          yield 3;
          await lock1.promise;
          await lock3.promise;
          yield 4;
          yield 5;
          yield 6;
        })(),
      )
        .takeUntil(lock2.promise)
        .subscribe({
          next(value) {
            values.push(value);
          },
          complete: resolve,
        });
    });

    expect(values).toEqual([]);
    lock1.resolve();
    await Bun.sleep(0);
    lock2.reject();
    lock3.resolve();
    await routine;

    expect(values).toEqual([1, 2, 3]);
  });
});

describe('take', () => {
  it('should only accept a non-negative integer', () => {
    // @ts-expect-error
    expect(() => Observable.of(1).take('--')).toThrow(TypeError);
    expect(() => Observable.of(1).take(-1)).toThrow(RangeError);
  });

  it('should complete when the limit is reached', () => {
    const values: number[] = [];
    Observable.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
      .take(5)
      .subscribe({
        next(value) {
          values.push(value);
        },
      });

    expect(values).toEqual([1, 2, 3, 4, 5]);
  });

  it('should complete when the observable completes', () => {
    const values: number[] = [];
    Observable.of(1, 2, 3, 4)
      .take(5)
      .subscribe({
        next(value) {
          values.push(value);
        },
      });

    expect(values).toEqual([1, 2, 3, 4]);
  });
});

describe('drop', () => {
  it('should only accept a non-negative integer', () => {
    // @ts-expect-error
    expect(() => Observable.of(1).drop('--')).toThrow(TypeError);
    expect(() => Observable.of(1).drop(-1)).toThrow(RangeError);
  });

  it('should complete when the limit is reached', () => {
    const values: number[] = [];
    Observable.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
      .drop(5)
      .subscribe({
        next(value) {
          values.push(value);
        },
      });

    expect(values).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('map', () => {
  it('should map values', () => {
    const values: number[] = [];
    Observable.of(1, 2, 3, 4)
      .map((value) => value * 2)
      .subscribe({
        next(value) {
          values.push(value);
        },
      });

    expect(values).toEqual([2, 4, 6, 8]);
  });
});

describe('filter', () => {
  it('should filter values', () => {
    const values: number[] = [];
    Observable.of(1, 2, 3, 4)
      .filter((value) => value % 2 === 0)
      .subscribe({
        next(value) {
          values.push(value);
        },
      });

    expect(values).toEqual([2, 4]);
  });
});

describe('flatMap', () => {
  it('should map values', () => {
    const values: number[] = [];
    Observable.of(1, 2, 3, 4)
      .flatMap((value) => Observable.of(value, value * 2))
      .subscribe({
        next(value) {
          values.push(value);
        },
      });

    expect(values).toEqual([1, 2, 2, 4, 3, 6, 4, 8]);
  });
});

describe('reduce', () => {
  it('should reduce values', async () => {
    expect(
      await Observable.of(1, 2, 3, 4).reduce((acc, value) => acc + value, 0),
    ).toBe(10);
  });
});

describe('toArray', () => {
  it('should convert values to an array', async () => {
    expect(await Observable.of(1, 2, 3, 4).toArray()).toEqual([1, 2, 3, 4]);
  });
});

describe('forEach', () => {
  it('should iterate over values', async () => {
    const values: number[] = [];
    // biome-ignore lint/complexity/noForEach: no duh
    await Observable.of(1, 2, 3, 4).forEach((value) => {
      values.push(value);
    });
    expect(values).toEqual([1, 2, 3, 4]);
  });
});

describe('some', () => {
  it('should return true if some values match the predicate', async () => {
    expect(
      await Observable.of(1, 2, 3, 4).some((value) => value % 2 === 0),
    ).toBe(true);
  });

  it('should return false if no values match the predicate', async () => {
    expect(
      await Observable.of(1, 3, 5, 7).some((value) => value % 2 === 0),
    ).toBe(false);
  });
});

describe('every', () => {
  it('should return true if all values match the predicate', async () => {
    expect(
      await Observable.of(8, 2, 6, 4).every((value) => value % 2 === 0),
    ).toBe(true);
  });

  it('should return false if not all values match the predicate', async () => {
    expect(
      await Observable.of(1, 3, 5, 7).every((value) => value % 2 === 0),
    ).toBe(false);
  });
});

describe('find', () => {
  it('should return the first value that matches the predicate', async () => {
    expect(
      await Observable.of(1, 2, 3, 4).find((value) => value % 2 === 0),
    ).toBe(2);
  });

  it('should return undefined if no value matches the predicate', async () => {
    expect(
      await Observable.of(1, 3, 5, 7).find((value) => value % 2 === 0),
    ).not.toBeDefined();
  });
});
