import { test, expect, mock, describe } from 'bun:test';
import { Observable } from '.';

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

describe('Observable.prototype.subsribe', () => {
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
      new Observable(() => ({ unsubsribe() {} })).subscribe(sink),
    ).not.toThrow();

    expect(() => {
      let error: unknown;
      new Observable(() => ({})).subscribe({
        error(e) {
          error = e;
        },
      });
      throw error;
    }).toThrow(TypeError);
  });
});
