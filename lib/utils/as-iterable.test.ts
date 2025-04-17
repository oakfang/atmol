import { test, expect } from 'bun:test';
import { atom, molecule, set, get } from '@/base';
import { asAsyncIterable } from './as-iterable';

test('as iterable works', async () => {
  const atm = atom(0);
  const mol = molecule(() => get(atm) * 2);
  const values: number[] = [];

  async function t() {
    for await (const val of asAsyncIterable(mol)) {
      values.push(val);
      if (values.length >= 5) {
        return;
      } 
    }
  }

  const check = t();
  await Bun.sleep(0);
  set(atm, 1);
  await Bun.sleep(0);
  set(atm, 2);
  await Bun.sleep(0);
  set(atm, 1);
  await Bun.sleep(0);
  set(atm, 3);
  await Bun.sleep(0);
  set(atm, 4);
  await Bun.sleep(0);
  await check;

  expect(values).toEqual([0, 2, 4, 2, 6]);
});
