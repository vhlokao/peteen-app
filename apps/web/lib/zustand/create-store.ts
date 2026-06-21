import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export function createTypedStore<T extends object>(
  initializer: (
    set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
    get: () => T
  ) => T,
  options?: {
    name?: string;
    persist?: boolean;
  }
) {
  if (options?.persist && options.name) {
    return createStore<T>()(
      persist(initializer as never, {
        name: options.name,
        storage: createJSONStorage(() => localStorage),
        skipHydration: true,
      })
    );
  }

  return createStore<T>(initializer);
}

export { useStore };
