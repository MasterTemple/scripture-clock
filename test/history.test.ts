import { beforeAll, describe, expect, it } from "vitest";
import { loadTopos } from "@/bible/topos";
import { filterHistory, highlightTerms } from "@/clock/historySearch";
import type { Screen } from "@/state/history";

beforeAll(loadTopos);

const now = new Date(2026, 10, 22, 18, 0).getTime();
const screen = (id: string, hoursAgo: number, items: Screen["items"], translationId = "fetch:eng_bsb"): Screen => ({
  id,
  shownAt: now - hoursAgo * 3_600_000,
  hour: 5,
  minute: 48,
  translationId,
  abbreviation: translationId === "fetch:eng_kjv" ? "KJV" : "BSB",
  items,
});
const verse = (id: string, reference: string, text: string, pinned = false) => ({ id, reference, text, pinned });

// Newest first, as kept
const screens: Screen[] = [
  screen("a", 1, [verse("40.5.48", "Matthew 5:48", "Be perfect, therefore, as your heavenly Father is perfect.")]),
  screen("b", 2, [verse("pin:x", "Hebrews 4:12-13", "For the word of God is living and active.", true)]),
  screen("c", 30, [verse("23.54.8", "Isaiah 54:8", "In a surge of anger I hid My face from you for a moment.")], "fetch:eng_kjv"),
  screen("d", 24 * 10, [verse("45.8.28", "Romans 8:28", "And we know that God works all things together for the good of those who love Him.")]),
];
const all = { query: "", period: "all" as const, translationId: null, pinnedOnly: false };
const found = (filter: Partial<typeof all>) => filterHistory(screens, { ...all, ...filter }, now).map((r) => r.item.reference);

describe("filterHistory", () => {
  it("lists every verse, newest first", () => {
    expect(found({})).toEqual(["Matthew 5:48", "Hebrews 4:12-13", "Isaiah 54:8", "Romans 8:28"]);
  });

  it("finds words in the text, all of them", () => {
    expect(found({ query: "god" })).toEqual(["Hebrews 4:12-13", "Romans 8:28"]);
    expect(found({ query: "god love" })).toEqual(["Romans 8:28"]);
  });

  it("finds a book by its abbreviation", () => {
    expect(found({ query: "rom" })).toEqual(["Romans 8:28"]);
    expect(found({ query: "isa" })).toEqual(["Isaiah 54:8"]);
  });

  it("finds the verses in a reference, a pinned passage too", () => {
    expect(found({ query: "Rom 8" })).toEqual(["Romans 8:28"]);
    expect(found({ query: "Heb 4:13" })).toEqual(["Hebrews 4:12-13"]);
    expect(found({ query: "Matt 5:47" })).toEqual([]);
  });

  it("filters by time, translation, and pins", () => {
    expect(found({ period: "today" })).toEqual(["Matthew 5:48", "Hebrews 4:12-13"]);
    expect(found({ period: "week" })).toEqual(["Matthew 5:48", "Hebrews 4:12-13", "Isaiah 54:8"]);
    expect(found({ translationId: "fetch:eng_kjv" })).toEqual(["Isaiah 54:8"]);
    expect(found({ pinnedOnly: true })).toEqual(["Hebrews 4:12-13"]);
  });

  it("marks words searched, not references", () => {
    expect(highlightTerms("god love")).toEqual(["god", "love"]);
    expect(highlightTerms("Rom 8")).toEqual([]);
  });
});
