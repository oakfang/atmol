import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profiler, type PropsWithChildren } from 'react';
import { atom, get, molecule, set } from '.';
import { $, useParticleValue } from './react';

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
