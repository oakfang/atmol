import { expect, test } from 'bun:test';
import { atom, get, molecule, set, synth } from '@/base';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profiler, type PropsWithChildren, useEffect, useState } from 'react';
import {
  Link,
  RouterProvider,
  createMemoryRouter,
  useSearchParams,
} from 'react-router-dom';
import { $, createOrganism, useParticleValue } from '.';
import { SimpleStore } from '@/utils';

function createScenario(onRender: () => void, onMicroRender: () => void) {
  const count = atom(0);
  const doubleCount = molecule(() => Math.floor(get(count) / 5));
  const color = molecule(() => (get(count) < 10 ? 'green' : 'red'));

  function Text() {
    onRender();
    return <span>Vite + React ({$(doubleCount)})</span>;
  }

  function Heading({ children }: PropsWithChildren) {
    const colorValue = useParticleValue(color);
    return <h1 style={{ color: colorValue }}>{children}</h1>;
  }

  function App() {
    onRender();
    return (
      <>
        <Profiler id="heading-root" onRender={onMicroRender}>
          <Heading>
            <Text />
          </Heading>
        </Profiler>
        <div className="card">
          <Profiler id="button-root" onRender={onMicroRender}>
            <button
              type="button"
              onMouseDown={() => set(count, (count) => count + 1)}
            >
              count is {$(count)}
            </button>
          </Profiler>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>
        <p className="read-the-docs">
          Click on the Vite and React logos to learn more
        </p>
      </>
    );
  }
  return App;
}

test('renders', async () => {
  let renderCount = 0;
  let microRenderCount = 0;
  const user = userEvent.setup();
  const App = createScenario(
    () => {
      renderCount++;
    },
    () => {
      microRenderCount++;
    },
  );
  const { getByRole } = render(<App />);

  expect(getByRole('button').textContent).toBe('count is 0');
  expect(renderCount).toBe(2);
  expect(microRenderCount).toBe(2);
  await user.click(getByRole('button'));
  expect(getByRole('button').textContent).toBe('count is 1');
  expect(renderCount).toBe(2);
  expect(microRenderCount).toBe(3);
  await user.click(getByRole('button'));
  await user.click(getByRole('button'));
  await user.click(getByRole('button'));
  await user.click(getByRole('button'));
  expect(getByRole('button').textContent).toBe('count is 5');
  expect(getByRole('heading').textContent).toBe('Vite + React (1)');
  expect(renderCount).toBe(2);
  expect(microRenderCount).toBe(8);
});

test('organisms', async () => {
  interface Todo {
    id: number;
    text: string;
    completed: boolean;
  }

  const TodosService = createOrganism(() => {
    const todos$ = atom<Todo[]>([]);

    function addTodo(text: string) {
      set(todos$, (current) =>
        current.concat({ id: current.length + 1, text, completed: false }),
      );
    }

    function toggleTodo(id: number) {
      set(todos$, (current) =>
        current.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo,
        ),
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
          const text = formData.get('text') as string;
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

  const app = render(<App />);
  const user = userEvent.setup();

  expect(app.queryByRole('listitem')).toBeNull();

  await user.type(app.getByRole('textbox'), 'foo');
  await user.click(app.getByRole('button'));
  expect(app.getByRole('listitem').textContent).toBe('foo');
  expect(
    app.getByRole('checkbox', { name: 'foo', checked: false }),
  ).not.toBeNull();

  await user.clear(app.getByRole('textbox'));
  await user.type(app.getByRole('textbox'), 'bar');
  await user.click(app.getByRole('button'));
  expect(
    app.getByRole('checkbox', { name: 'bar', checked: false }),
  ).not.toBeNull();

  await user.click(app.getByRole('checkbox', { name: 'bar' }));
  expect(
    app.getByRole('checkbox', { name: 'bar', checked: true }),
  ).not.toBeNull();

  await user.click(app.getByRole('checkbox', { name: 'bar' }));
  expect(
    app.getByRole('checkbox', { name: 'bar', checked: false }),
  ).not.toBeNull();
});

test('query params atoms', async () => {
  function useSearchParamsAtom() {
    const [params, setParams] = useSearchParams();
    const [store] = useState(() => new SimpleStore(params));
    const [spa] = useState(() =>
      synth(store.subscribe, store.getCurrent, setParams),
    );
    useEffect(() => {
      store.update(params);
    }, [params, store]);
    return spa;
  }

  function Test() {
    const spa = useSearchParamsAtom();
    const [foo$] = useState(() => molecule(() => get(spa).get('foo')));
    const [bar$] = useState(() => molecule(() => get(spa).get('bar')));
    const foo = useParticleValue(foo$);
    const bar = useParticleValue(bar$);

    return (
      <ul>
        {foo && <li>foo: {foo}</li>}
        {bar && <li>bar: {bar}</li>}
      </ul>
    );
  }

  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <div>
          <Link to="?foo=4">Foo</Link>
          <Link to="?bar=2">Bar</Link>
          <Test />
        </div>
      ),
    },
  ]);

  const user = userEvent.setup();
  const app = render(<RouterProvider router={router} />);

  expect(app.queryByText('foo: 4')).toBeNull();
  expect(app.queryByText('bar: 2')).toBeNull();

  await user.click(app.getByRole('link', { name: 'Foo' }));
  expect(app.queryByText('foo: 4')).not.toBeNull();
  expect(app.queryByText('bar: 2')).toBeNull();

  await user.click(app.getByRole('link', { name: 'Bar' }));
  expect(app.queryByText('foo: 4')).toBeNull();
  expect(app.queryByText('bar: 2')).not.toBeNull();

  await user.click(app.getByRole('link', { name: 'Foo' }));
  expect(app.queryByText('foo: 4')).not.toBeNull();
  expect(app.queryByText('bar: 2')).toBeNull();
});
