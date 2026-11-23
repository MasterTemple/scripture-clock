import { describe, expect, it } from "vitest";
import { shuffled } from "@/clock/random";

describe("shuffled", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it("gives the same order for the same seed", () => {
    expect(shuffled(items, 42)).toEqual(shuffled(items, 42));
  });

  it("keeps every item once", () => {
    expect([...shuffled(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });

  it("orders differently for different seeds", () => {
    expect(shuffled(items, 1)).not.toEqual(shuffled(items, 2));
  });
});
