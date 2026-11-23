import { beforeAll, describe, expect, it } from "vitest";
import { loadTopos } from "@/bible/topos";
import { candidatesFor, pinMatches, type Pin } from "@/clock/choose";
import { weightedShuffled } from "@/clock/random";

beforeAll(loadTopos);

const pin = (hour: number, minute: number, reference: string, id = reference): Pin => ({ id, hour, minute, reference });
const at = (hour: number, minute: number) => ({ hour, minute });
const none = { others: true, priorities: {}, pins: [] as Pin[] };

describe("pins", () => {
  it("a pin at 4:12 is for both 4:12s on a 12-hour clock, and only the morning on a 24-hour one", () => {
    const p = pin(4, 12, "Hebrews 4:12");
    expect(pinMatches(p, at(4, 12), "12h")).toBe(true);
    expect(pinMatches(p, at(16, 12), "12h")).toBe(true);
    expect(pinMatches(p, at(16, 12), "24h")).toBe(false);
    expect(pinMatches(pin(16, 12, "x"), at(4, 12), "12h")).toBe(false);
  });

  it("puts pinned verses first, and leaves them out of the time's own verses", () => {
    const list = candidatesFor(at(4, 12), "12h", { ...none, pins: [pin(4, 12, "Hebrews 4:12")] }, "seed");
    expect(list[0]).toMatchObject({ reference: "Hebrews 4:12", pinned: true });
    expect(list.filter((c) => c.reference === "Hebrews 4:12")).toHaveLength(1);
  });

  it("lets several pins at one time take turns, and pins a passage whole", () => {
    const pins = [pin(4, 12, "Hebrews 4:12-13"), pin(4, 12, "Proverbs 4:12")];
    const firsts = new Set(Array.from({ length: 30 }, (_, i) => candidatesFor(at(4, 12), "12h", { ...none, pins }, `s${i}`)[0]!.reference));
    expect(firsts).toEqual(new Set(["Hebrews 4:12-13", "Proverbs 4:12"]));
    const passage = candidatesFor(at(4, 12), "12h", { ...none, pins: [pins[0]!] }, "s")[0]!;
    expect(passage.verses).toHaveLength(2);
  });
});

describe("priorities", () => {
  it("leaves out books set to Never", () => {
    const list = candidatesFor(at(1, 1), "12h", { ...none, others: false, priorities: { 1: 0, 43: 0 } }, "seed");
    expect(list.some((c) => c.verses[0]!.bookId === 1 || c.verses[0]!.bookId === 43)).toBe(false);
    expect(list).toHaveLength(64);
  });

  it("picks books set to Most far more often", () => {
    let first = 0;
    for (let i = 0; i < 200; i++) if (candidatesFor(at(1, 1), "12h", { ...none, priorities: { 19: 4 } }, `s${i}`)[0]!.verses[0]!.bookId === 19) first++;
    // 40 against 65 × 4: about 13% of the time, against 1.5% at Normal
    expect(first).toBeGreaterThan(10);
  });

  it("weights a shuffle", () => {
    let heavy = 0;
    for (let seed = 0; seed < 500; seed++) if (weightedShuffled(["a", "b"], (x) => (x === "a" ? 9 : 1), seed)[0] === "a") heavy++;
    expect(heavy / 500).toBeGreaterThan(0.8);
  });
});
