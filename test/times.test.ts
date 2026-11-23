import { beforeAll, describe, expect, it } from "vitest";
import { formatRef, loadTopos } from "@/bible/topos";
import { addMinutes, nextWithVerses, parseTime, PER_MINUTE, readings, slotOf, versesForTime } from "@/clock/times";

beforeAll(loadTopos);

const refs = (hour: number, minute: number, format: "12h" | "24h" = "12h") =>
  Object.fromEntries(versesForTime({ hour, minute }, format).map((g) => [`${g.chapter}:${g.verse}`, g.verses.map((v) => formatRef(v))]));

describe("readings", () => {
  it("reads the hour and minute, then the digits split other ways", () => {
    expect(readings({ hour: 17, minute: 48 }, "12h")).toEqual([
      { chapter: 5, verse: 48, exact: true },
      { chapter: 54, verse: 8, exact: false },
    ]);
  });

  it("reads a minute under 10 as its verse, and skips splits starting with 0", () => {
    expect(readings({ hour: 12, minute: 5 }, "12h").map((r) => `${r.chapter}:${r.verse}`)).toEqual(["12:5", "1:205", "120:5"]);
  });

  it("uses the hour of a 24-hour clock", () => {
    expect(readings({ hour: 17, minute: 48 }, "24h").map((r) => `${r.chapter}:${r.verse}`)).toEqual(["17:48", "1:748", "174:8"]);
  });

  it("has nothing at a verse or chapter of 0", () => {
    expect(readings({ hour: 0, minute: 30 }, "24h")).toEqual([]);
    expect(readings({ hour: 5, minute: 0 }, "12h").filter((r) => !r.hourOnly)).toEqual([]);
  });

  it("reads the hour alone on the hour", () => {
    expect(readings({ hour: 21, minute: 0 }, "12h")).toEqual([{ chapter: 1, verse: 9, exact: false, hourOnly: true }]);
    expect(readings({ hour: 0, minute: 0 }, "24h")).toEqual([]);
  });

  it("can leave out other readings", () => {
    expect(readings({ hour: 5, minute: 48 }, "12h", false)).toHaveLength(1);
  });
});

describe("versesForTime", () => {
  it("finds Matthew 5:48 and Isaiah 54:8 at 5:48", () => {
    const found = refs(5, 48);
    expect(found["5:48"]).toContain("Matthew 5:48");
    expect(found["54:8"]).toContain("Isaiah 54:8");
  });

  it("finds Psalm 120 at 12:01", () => {
    expect(refs(12, 1)["120:1"]?.[0]).toMatch(/^Psalms? 120:1$/);
  });

  it("finds single-chapter books at 1 o'clock", () => {
    expect(refs(1, 25)["1:25"]).toContain("Jude 1:25");
  });

  it("finds Jude 9 at 9:00, only in books of one chapter", () => {
    expect(refs(21, 0)).toEqual({ "1:9": ["Obadiah 9", "Philemon 9", "2 John 9", "3 John 9", "Jude 9"] });
    expect(refs(21, 0, "24h")["1:21"]).toEqual(["Obadiah 21", "Philemon 21", "Jude 21"]);
  });

  it("lists books Genesis to Revelation", () => {
    const books = refs(1, 1)["1:1"]!;
    expect(books[0]).toBe("Genesis 1:1");
    expect(books.at(-1)).toBe("Revelation 1:1");
    expect(books).toHaveLength(66);
  });
});

describe("times", () => {
  it("wraps around midnight", () => {
    expect(addMinutes({ hour: 23, minute: 59 }, 1)).toEqual({ hour: 0, minute: 0 });
    expect(addMinutes({ hour: 0, minute: 0 }, -1)).toEqual({ hour: 23, minute: 59 });
  });

  it("finds the next time with verses", () => {
    expect(nextWithVerses({ hour: 5, minute: 0 }, "12h")).toEqual({ hour: 5, minute: 1 });
  });

  it("parses a time from a link", () => {
    expect(parseTime("17:48")).toEqual({ hour: 17, minute: 48 });
    expect(parseTime("548")).toEqual({ hour: 5, minute: 48 });
    expect(parseTime("25:00")).toBeNull();
  });
});

describe("parts of a minute", () => {
  it("moves on at :00 and :30 for 2 a minute", () => {
    expect([0, 29, 30, 59].map((s) => slotOf(s, 2))).toEqual([0, 0, 1, 1]);
  });

  it("splits a minute evenly for every choice", () => {
    for (const n of PER_MINUTE) {
      expect(60 % n).toBe(0);
      expect(new Set(Array.from({ length: 60 }, (_, s) => slotOf(s, n))).size).toBe(n);
    }
  });
});
