import { expect, mock, test } from 'bun:test';
import { async, atom, get, molecule, peek, set, synth, wave } from '.';

test('atom:get/set', () => {
  const a = atom(0);
  expect(get(a)).toBe(0);
  set(a, 1);
  expect(get(a)).toBe(1);
});

test('waves(atoms)', () => {
  const a = atom(0);
  const b = atom(0);
  const c = atom(0);
  wave(() => {
    set(b, get(a) + 1);
  });
  const stop = wave(() => {
    set(c, get(b) + 1);
  });

  expect(get(b)).toBe(1);
  expect(get(c)).toBe(2);

  set(a, 1);

  expect(get(b)).toBe(2);
  expect(get(c)).toBe(3);

  stop();
  set(a, 2);

  expect(get(b)).toBe(3);
  expect(get(c)).toBe(3);
});

test('peeking does not trigger a wave', () => {
  const a = atom(0);
  const b = atom(0);
  const c = atom(0);
  wave(() => {
    set(b, peek(a) + 1);
  });
  wave(() => {
    set(c, peek(b) + 1);
  });

  expect(get(b)).toBe(1);
  expect(get(c)).toBe(2);

  set(a, 1);

  expect(get(b)).toBe(1);
  expect(get(c)).toBe(2);
});

test('molecule:get/set', () => {
  const a = atom(0);
  const b = molecule(() => get(a) * 2);
  expect(get(b)).toBe(0);
  set(a, 1);
  expect(get(b)).toBe(2);
});

test('waves(molecule)', () => {
  const a = atom(0);
  const b = molecule(() => get(a) * 2);
  const c = molecule(() => get(b) * 2);
  const m = mock();
  wave(() => {
    m(get(c));
  });

  expect(get(c)).toBe(0);

  set(a, 1);
  set(a, 1);
  set(a, 1);

  expect(get(b)).toBe(2);
  expect(get(c)).toBe(4);
  expect(m).toHaveBeenCalledTimes(2);
  expect(m).toHaveBeenCalledWith(0);
  expect(m).toHaveBeenCalledWith(4);
});

test('molecule referential equality', () => {
  const count = atom(0);
  const color = molecule(() => (get(count) > 10 ? 'red' : 'green'));
  const style = molecule(() => ({ color: get(color) }));

  const currentStyle = get(style);

  expect(currentStyle).toEqual({ color: 'green' });
  set(count, 10);
  expect(currentStyle === get(style)).toBe(true);
  expect(currentStyle).toEqual({ color: 'green' });
  set(count, 20);
  expect(currentStyle === get(style)).toBe(false);
  expect(get(style)).toEqual({ color: 'red' });
});

test('async wave scheduler', async () => {
  const a = atom(0);
  const b = atom(0);
  const c = atom(0);

  wave(() => {
    set(b, get(a) + 1);
    set(c, get(b) + 1);
    set(a, 1);
  }, async);

  expect(get(b)).toBe(1);
  expect(get(c)).toBe(2);

  await Promise.resolve();

  expect(get(b)).toBe(2);
  expect(get(c)).toBe(3);
});

function createStore(onUnsubscribe?: () => void) {
  let value = 0;
  const subscribers = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (callback: () => void) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
        onUnsubscribe?.();
      };
    },
    sendUpdate: (newValue: number) => {
      const changed = value !== newValue;
      value = newValue;

      if (changed) {
        for (const callback of subscribers) {
          callback();
        }
      }
    },
  };
}

test('synthetic atoms: get/set', () => {
  const store = createStore();

  const a = synth(store.subscribe, store.getSnapshot, store.sendUpdate);
  const b = molecule(() => get(a) * 2);

  expect(get(b)).toBe(0);
  set(a, 1);
  expect(get(a)).toBe(1);
  expect(get(b)).toBe(2);
});

test('synthetic atoms: unsubscribe', async () => {
  const unsub = mock();
  const store = createStore(unsub);

  expect(unsub).not.toHaveBeenCalled();

  const a = synth(store.subscribe, store.getSnapshot, store.sendUpdate);
  set(a, 1);
  expect(unsub).toHaveBeenCalledTimes(1);
});

test('synthetic atoms: resubscribe (internal)', async () => {
  const unsub = mock();
  const store = createStore(unsub);

  expect(unsub).not.toHaveBeenCalled();

  const a = synth(store.subscribe, store.getSnapshot, store.sendUpdate);
  set(a, 1);

  const b = molecule(() => get(a) * 2);
  set(a, 2);

  expect(peek(b)).toBe(4);
});

test('synthetic atoms: resubscribe (external)', async () => {
  const unsub = mock();
  const store = createStore(unsub);

  expect(unsub).not.toHaveBeenCalled();

  const a = synth(store.subscribe, store.getSnapshot, store.sendUpdate);
  set(a, 1);

  const b = molecule(() => get(a) * 2);
  store.sendUpdate(2);

  expect(peek(b)).toBe(4);
});
