# @oakfang/atmol

This is a simple library to help you create a simple, fast, and easy to use signal-like state management, with a lot of inspiration from [jotai](https://jotai.org/).

## Installation

```bash
bun add @oakfang/atmol
```

## tl;dr

This library makes utilises the concept of a "particle" which holds a readable value, and can be observed for changes.

This library exports 3 main entities:

- `atom`: a particle with the unique property of being read-write, instead of read-only.
- `molecule`: a particle whose value is derived from a computation over other particles.
- `wave`: an effect that observes on multiple particles, which runs immediately, and when its composing particles change.

And 2 operators:

- `get`: get the current value of any particle
- `set`: set the current value of an atom

## Usage

```ts
import { atom, molecule, wave, get, set } from "@oakfang/atmol";

const count = atom(0);
const doubled = molecule((get) => get(count) * 2);

wave((get) => {
  console.log(get(doubled));
});
// prints "0" immediately

set(count, 1);
// prints "2"
```

## API

### `atom<T>(initialValue: T): Atom<T>`

Creates an Atom object with the provided initial value.
Atoms are read-write particles.

### `molecule<T>(factory: (get: Getter<T>) => T): Particle<T>`

Creates a new particle representing a molecule with the given factory function, which accepts a unique "get" operator that marks the particle as a dependency.
The molecule tracks its dependencies and updates its value when needed.
The molecule will attempt to defer its computation until it is necessary (e.g. when it's another particle's depencency, or when its value is being read).

### `wave<T>(effect: (get: Getter<T>) => void, scheduler?: WaveScheduler): Unsubscribe`

Creates a new effect that observes on multiple particles (using the same unique `get` operator as a `molecule`), and runs immediately, and when its composing particles change. These later changes can be scheduled using the `scheduler` argument (defaults to being applied synchronously). See [Schedulers](#schedulers) for more information.

It returns a function that can be used to stop the wave from running.

### `get<T>(p: Particle<T>): T`

Gets the current value of the provided particle.

### `set<T>(p: Atom<T>, value: T | ((oldValue: T) => T)): void`

Sets the current value of the provided atom, given a new value to set, or a function that accepts the current value and returns a new value.

## Schedulers

The `wave` function can be given a `scheduler` argument, which is a an object of the following shape:

```ts
interface WaveScheduler {
  register(wave: Wave, effect: () => void): void;
  schedule(wave: Wave): void;
}
```

The `value` argument is the current value of the wave's particles, and the `nextValue` argument is the new value of the wave's particles.