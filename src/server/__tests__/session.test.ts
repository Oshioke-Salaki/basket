import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

const { isBasketKey, namespaceFor, newBasketKey } = await import("../session");

describe("basket keys", () => {
  it("are 128-bit base32 secrets with a prefix", () => {
    const key = newBasketKey();
    expect(isBasketKey(key)).toBe(true);
    expect(newBasketKey()).not.toBe(key);
    expect(isBasketKey("bsk_short")).toBe(false);
  });

  it("map to a stable namespace that does not reveal the key", () => {
    const key = newBasketKey();
    const ns = namespaceFor(key);
    expect(ns).toMatch(/^basket-[0-9a-f]{32}$/);
    expect(namespaceFor(key)).toBe(ns);
    expect(ns).not.toContain(key.slice(4));
  });
});
