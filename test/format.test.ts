import { beforeAll, describe, expect, it } from "vitest";
import { findPassages, formatPrinted, formatRef, loadTopos, passageVerses } from "@/bible/topos";

beforeAll(loadTopos);

describe("references", () => {
  it("writes a verse of a book with one chapter without its chapter, when asked", () => {
    expect(formatRef({ bookId: 65, chapter: 1, verse: 9, noChapter: true })).toBe("Jude 9");
    expect(formatRef({ bookId: 65, chapter: 1, verse: 25 })).toBe("Jude 1:25");
    expect(formatRef({ bookId: 43, chapter: 3, verse: 16 })).toBe("John 3:16");
  });

  it("keeps a written reference to a book with one chapter as Jude 9", () => {
    const [v] = passageVerses("Jude 9")!;
    expect(formatPrinted(v!)).toBe("Jude 9");
    expect(formatPrinted(passageVerses("Jude 1:9")![0]!)).toBe("Jude 9");
    expect(findPassages("see Jude 9")[0]?.reference).toBe("Jude 9");
  });

  it("writes verses printed together as a range", () => {
    expect(formatPrinted({ bookId: 65, chapter: 1, verse: 9, noChapter: true }, { text: "", span: [9, 10] })).toBe("Jude 9–10");
    expect(formatPrinted({ bookId: 43, chapter: 3, verse: 4 }, { text: "", span: [4, 5] })).toBe("John 3:4–5");
    expect(formatPrinted({ bookId: 1, chapter: 1, verse: 31 }, { text: "", span: [31, 1], chapters: [1, 2] })).toBe("Genesis 1:31–2:1");
  });
});
