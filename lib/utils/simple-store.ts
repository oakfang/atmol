export class SimpleStore<T> {
  #value: T;
  #subscribers = new Set<() => void>();
  constructor(initialValue: T) {
    this.#value = initialValue;
  }

  #notify() {
    for (const sub of this.#subscribers) {
      sub();
    }
  }

  getCurrent = () => this.#value;

  subscribe = (listener: () => void) => {
    this.#subscribers.add(listener);

    return () => {
      this.#subscribers.delete(listener);
    };
  };

  update(value: T) {
    if (value !== this.#value) {
      this.#value = value;
      this.#notify();
    }
  }
}
