import { test, expect } from "bun:test";
import { createReaction, waitForParticleValue, type Reaction } from ".";
import { atom, get, molecule, set, wave } from "..";
import { $, Reactive, useParticleValue } from "../react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useInsertionEffect } from "react";

test("reaction (success)", async () => {
  const resourceId = atom(0);
  const trigger = molecule(() => `/resource/${get(resourceId)}`);
  const reaction = createReaction(trigger, async (url) => {
    return url.split("/").pop();
  });
  expect(get(reaction.state)).toBe("pending");
  expect(get(reaction.result)).toBe(null);
  expect(get(reaction.error)).toBe(null);
  await waitForParticleValue(reaction.state, "success");
  expect(get(reaction.state)).toBe("success");
  expect(get(reaction.result)).toBe("0");
  expect(get(reaction.error)).toBe(null);
});

test("reaction updates", async () => {
  const resourceId = atom(0);
  const trigger = molecule(() => `/resource/${get(resourceId)}`);
  const reaction = createReaction(trigger, async (url) => {
    return url.split("/").pop();
  });
  set(resourceId, 1);
  await waitForParticleValue(reaction.state, "success");
  expect(get(reaction.state)).toBe("success");
  expect(get(reaction.result)).toBe("1");
  expect(get(reaction.error)).toBe(null);
});

test("reaction (error)", async () => {
  const resourceId = atom(0);
  const trigger = molecule(() => `/resource/${get(resourceId)}`);
  const reaction = createReaction(trigger, async (url) => {
    if (url.endsWith("1")) {
      throw -1;
    }
    return url.split("/").pop();
  });
  set(resourceId, 3);
  set(resourceId, 1);
  await waitForParticleValue(reaction.state, "error");
  expect(get(reaction.state)).toBe("error");
  expect(get(reaction.result)).toBe(null);
  expect(get(reaction.error)).toBe(-1);
});

test("resction in react components", async () => {
  const resourceType = atom<"foo" | "bar">("foo");
  const reaction = createReaction(
    resourceType,
    async (resource) => {
      if (resource === "foo") {
        return "spam";
      }
      return "eggs";
    },
    {
      autoRun: false,
    }
  );
  function useReaction<Value>(reaction: Reaction<Value>) {
    useInsertionEffect(() => {
      reaction.observe();
      return () => reaction.unobserve();
    }, [reaction]);
    return reaction;
  }

  function ChildA() {
    useReaction(reaction);
    const state = useParticleValue(reaction.state);

    if (state !== "success") return null;
    return <p>{$(reaction.result)}</p>;
  }

  function ChildB() {
    useReaction(reaction);
    const state = useParticleValue(reaction.state);
    switch (state) {
      case "idle":
      case "pending":
        return <p>loading...</p>;
      default:
        return null;
    }
  }

  function Component() {
    return (
      <div>
        <h1>Currently fetching: {$(resourceType)}</h1>
        <ChildA />
        <ChildB />
        <Reactive
          as="select"
          $value={() => get(resourceType)}
          onChange={(e) => set(resourceType, e.target.value as "foo" | "bar")}
        >
          <option value="foo">Foo</option>
          <option value="bar">Bar</option>
        </Reactive>
      </div>
    );
  }

  const app = render(<Component />);
  const user = userEvent.setup();
  expect(app.getByRole("heading").textContent).toBe("Currently fetching: foo");
  expect((app.getByRole("combobox") as HTMLSelectElement).value).toBe("foo");
  expect(app.queryByText(/spam|eggs/)).toBeNull();
  expect(app.getByText("loading...")).not.toBeNull();
  expect((await app.findByText(/spam|eggs/)).textContent).toBe("spam");
  await user.selectOptions(app.getByRole("combobox"), "bar");
  expect((app.getByRole("combobox") as HTMLSelectElement).value).toBe("bar");
  expect((await app.findByText(/spam|eggs/)).textContent).toBe("eggs");
});
