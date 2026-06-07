import "@testing-library/jest-dom/vitest";

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  const store = new Map<string, string>();
  const localStoragePolyfill = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, "localStorage", { value: localStoragePolyfill, configurable: true });
  Object.defineProperty(window, "localStorage", { value: localStoragePolyfill, configurable: true });
}
