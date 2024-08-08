# @oakfang/atmol

This is a simple library to help you create a simple, fast, and easy-to-use signal-like state management, with a lot of inspiration from [jotai](https://jotai.org/).

## Installation

```bash
bun add @oakfang/atmol
```

## tl;dr

This library utilises the concept of a "particle" which holds a readable value, and can be observed for changes.

This library exports 3 main entities:

- `atom`: a particle with the unique property of being read-write, instead of read-only.
- `molecule`: a particle whose value is derived from a computation over other particles.
- `wave`: an effect that observes on multiple particles, which runs immediately, and when its composing particles change.

And 3 operators:

- `get`: get the current value of any particle, and mark it as a dependency of its context (see `molecule` and `wave`, below)
- `set`: set the current value of an atom
- `peek`: get the current value of an atom, without marking it as a dependency of its context

## Usage

```ts
import { atom, molecule, wave, get, set } from "@oakfang/atmol";

const count = atom(0);
const doubled = molecule(() => get(count) * 2);

wave(() => {
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

### `molecule<T>(computation: () => T): Particle<T>`

Creates a new particle representing a molecule with the given computation function, which marks every "gotten" particle in it as a dependency of the molecule.
The molecule tracks its dependencies and updates its value when needed.
The molecule will attempt to defer its computation until it is necessary (e.g. when it's another particle's dependency, or when its value is being read).

> [!NOTE]  
> A molecule's computation function **must** be synchronous, for reasons explored in the [Reaction API](#reaction-api) section.

### `synth<T>(subscribe: Subscribe, getSnapshot: GetSnapshot<T>, sendUpdate: SendUpdate<T>): SyntheticAtom<T>`

Creates a new synthetic atom that syncs with a non-particle data store, using very similar APIs to [React's `syncExternalStore`](https://react.dev/reference/react/useSyncExternalStore#usesyncexternalstore).

It is disposable either by using the `using` resource management syntax, or by calling the `dispose` operator on it.

```tsx
import { synth } from "@oakfang/atmol";
import { useSearchParams } from "react-router";
import { useState, useEffect, useRef } from "react";

export function useSearchParamsAtom() {
  const [params, setParams] = useSearchParams();
  const subscribeRef = useRef<null | (() => void)>(null);
  const currentParams = useRef(params);
  currentParams.current = params;
  const [spa] = useState(() => {
    const subscribe = (callback: () => void) => {
      subscribeRef.current = callback;
      return () => {
        subscribeRef.current = null;
      };
    };
    return synth(subscribe, () => currentParams.current, setParams);
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    subscribeRef.current?.();
  }, [params]);
  useEffect(() => () => dispose(spa), [spa]);
  return spa;
}
```

### `wave<T>(effect: () => void, scheduler?: WaveScheduler): Unsubscribe`

Creates a new effect that observes on multiple particles (using the same computation-context as a `molecule`), and runs immediately, and when its composing particles change. These later changes can be scheduled using the `scheduler` argument (defaults to being applied synchronously). See [Schedulers](#schedulers) for more information.

It returns a function that can be used to stop the wave from running.

> [!NOTE]  
> A waves's effect function **must** be synchronous, for reasons explored in the [Reaction API](#reaction-api) section.

### `get<T>(p: Particle<T>): T`

Gets the current value of the provided particle, and marks it as a dependency of its context (see `molecule` and `wave`, above).

### `peek<T>(p: Particle<T>): T`

Gets the current value of the provided particle, without marking it as a dependency of its context.

```ts
const count = atom(0);

wave(() => {
  console.log(peek(count));
}); // will only ever print once
```

### `set<T>(p: Atom<T>, value: T | ((oldValue: T) => T)): void`

Sets the current value of the provided atom, given a new value to set, or a function that accepts the current value and returns a new value.

## Schedulers

The `wave` function can be given a `scheduler` argument, which is an object of the following shape:

```ts
interface WaveScheduler {
  register(wave: Wave, effect: () => void): void;
  schedule(wave: Wave): void;
}
```

Waves will register their effects with the scheduler upon their initialisation, and will then call the `schedule` function on the scheduler immediately afterwards and every time any of the wave's particles change.

This library comes prepackaged with 2 schedulers, but you're encouraged to implement your own, if you need to:

- `sync`: runs the wave synchronously after its initialisation, and synchronously every time any of its particles change. (This is the default scheduler)
- `async`: runs the wave synchronously after its initialisation, but batches all other runs into a single asynchronous task every time any of its particles changes.

## Reaction API

Both molecules and waves are designed to be synchronous. Any attempt to use an asynchronous `get` operation inside of their respective computation functions will result in the dependency context being lost (until we have [Async Context](https://github.com/tc39/proposal-async-context), at least).

This means, unfortunately, that you shouldn't do something like this:

```ts
const id = atom(0);
const comment = atom(null);

wave(async () => {
  const response = await fetch(`/comments/${get(id)}`);
  set(comment, await response.json());
});
```

> [!CAUTION]
> Do not copy the code from the example above, this is an example of what **not** to do.

While you _could_ assign your dependencies to variables and _then_ use them in your computation function, this is not recommended either, since you won't have a guaranteed order of execution.

For example, this is a bad idea:

```ts
const id = atom(0);
const comment = atom(null);

wave(() => {
  const id = get(id);
  fetch(`/comments/${get(id)}`)
    .then((response) => response.json())
    .then((commentObject) => set(comment, commentObject));
});

set(id, 1);
```

> [!CAUTION]
> Do not copy the code from the example above, this is an example of what **not** to do.

Imagine the 1st request takes 20 ms, and the 2nd request takes 10 ms. If you do this, the 2nd request will be done before the 1st request has finished, and the final value will be the 1st request's response.

This library introduces an additional endpoint for such concerns: `@oakfang/atmol/reaction`. Reactions are asynchronous functions tied to a specific particle's value.

An example usage of a reaction would be:

```ts
import { atom, wave, get, set } from "@oakfang/atmol";
import { createReaction } from "@oakfang/atmol/reaction";

const commentId = atom(0);
const reaction = createReaction(commentId, async (id) => {
  const response = await fetch(`/comments/${id}`);
  return await response.json();
});

const commentHeading = document.querySelector("#comment-heading");
const commentBody = document.querySelector("#comment-body");

wave(() => {
  switch (get(reaction.state)) {
    case "idle":
      console.log("Preparing to fetch comment", get(commentId));
      break;
    case "pending":
      console.log("Fetching comment", get(commentId));
      break;
    case "success":
      console.log("Got comment", get(commentId));
      break;
    case "error":
      console.log("Error fetching comment", get(commentId));
      break;
  }
});

wave(() => {
  const comment = get(reaction.value);
  if (!comment) return;
  commentHeading.textContent = comment.title;
  commentBody.textContent = comment.body;
});

set(commentId, 1); // fetch another comment
```

### `createReaction<Trigger, Value>(trigger: Particle<Trigger>, effect: (value: T) => Promise<Value>, reactionOptions?: ReactionOptions): Reaction<Value>`

Creates a new reaction object. A reaction has three particle properties:

- `state`: a particle that represents the current state of the reaction. It can be one of the following values:
  - `idle`: the reaction is not currently running.
  - `pending`: the reaction is currently running.
  - `success`: the reaction has completed successfully.
  - `error`: the reaction has failed.
- `value`: a particle that represents the value of the reaction. It defaults to `null`.
- `error`: a particle that represents the error of the reaction. It defaults to `null`.

And has the following methods:

- `observe()`: increase the reaction observer count by 1. An observed reaction will react to changes in its trigger particle. Reactions start with an observer count of 1 by default.
- `unobserve()`: reduce the reaction observer count by 1.

The `createReaction` function takes three arguments:

- `trigger`: a particle that represents the trigger for the reaction.
- `effect`: a function that takes the value of the trigger particle and returns a promise that resolves to the value of the reaction.
- `reactionOptions`: an optional object that can contain the following properties:
  - `autoObserve`: should the reaction start as observed (`true` by default).
  - `keepPrevious`: reactions reset their `value` and `error` properties to `null` when the trigger changes, unless this is set to `true` (`false` by default).

### `createQuantumPair<T>(initialValue: T): [Particle<T>, Writer<T>]`

Sometimes you wish to create some particle that is writeable like an `atom`, but not to anyone who has access to it. This can be achieved by masking an atom with a molecule, but you can also use the `createQuantumPair` function to achieve the same result.

Calling this function will return a tuple, where the first element is a particle, and the second element is a function that can be used to write to that particle. The usual `set` operator will fail to write to the particle, but the `write` function will work.

Internally, reaction properties are implemented using this function.

## React API

The `@oakfang/atmol/react` endpoint exports a few neat utilities for working with React.

### `useParticleValue<T>(particle: Particle<T>): T`

A custom React hook that returns the current value of a given particle and updates the component when the value changes.

### `$<T extends ReactNode>(particle: Particle<T>): ReactNode`

If you just want to render a particle and ensure it re-renders when its value changes, you can use this function. It will not re-render the entire component, just the rendered value.

```tsx
import { atom, set, get } from "@oakfang/atmol";
import { $, useParticleValue } from "@oakfang/atmol/react";

const count = atom(0);

function Component() {
  return <span>Count: {$(count)}</span>;
}
```

### `useReaction<Value>(reaction: Reaction<Value>): Reaction<Value>`

A custom React hook that manages the observation of a reaction so that it becomes unobserved when all observing components unmount.

> [!NOTE]
> Usually, in a React application, we would create our reactions with `autoObserve` set to `false` and the `keepPrevious` option set to `true`.

### `createOrganism<T>(organismFactory: () => T): Organism<T>`

When you're authoring a React application, you may find yourself wanting to share an encapsulated state+setters object between multiple components, in an injectable manner. This is basically a wrapper around `createContext` and `useContext`.

```tsx
import { atom, set, get } from "@oakfang/atmol";
import { $, createOrganism, useParticleValue } from "@oakfang/atmol/react";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const TodosService = createOrganism(() => {
  const todos$ = atom<Todo[]>([]);

  function addTodo(text: string) {
    set(todos$, (current) =>
      current.concat({ id: current.length + 1, text, completed: false })
    );
  }

  function toggleTodo(id: number) {
    set(todos$, (current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }

  return { todos$, addTodo, toggleTodo };
});

function Todo({ todo }: { todo: Todo }) {
  const { toggleTodo } = TodosService.use();

  return (
    <label>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleTodo(todo.id)}
      />
      <span>{todo.text}</span>
    </label>
  );
}

function TodoList() {
  const { todos$ } = TodosService.use();
  const todos = useParticleValue(todos$);

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          <Todo todo={todo} />
        </li>
      ))}
    </ul>
  );
}

function CreateTodo() {
  const { addTodo } = TodosService.use();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const text = formData.get("text") as string;
        addTodo(text);
        form.reset();
      }}
    >
      <input type="text" name="text" required />
      <button type="submit">Add</button>
    </form>
  );
}

function App() {
  return (
    <TodosService>
      <CreateTodo />
      <TodoList />
    </TodosService>
  );
}
```
