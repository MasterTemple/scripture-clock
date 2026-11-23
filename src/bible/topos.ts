import { BookStyle, initialized, OffsetUnit, Topos, ToposFormat, ToposOptions, type BookInfo } from "topos-bible";
import type { VerseRef, VerseText } from "./types";

let instance: Topos | null = null;
let books: BookInfo[] = [];

/** Loads topos's WebAssembly; call once before anything else here */
export async function loadTopos() {
  if (instance) return;
  await initialized;
  // References topos writes ("Jude 9" found in a pin's text) leave out the chapter of a book with one
  instance = ToposOptions.create().format(ToposFormat.create().chapterInSingleChapterBooks(false)).build();
  books = instance.books();
}

function topos(): Topos {
  if (!instance) throw new Error("topos is not loaded yet");
  return instance;
}

/** All 66 books, Genesis to Revelation */
export const allBooks = (): BookInfo[] => books;

export function bookById(id: number): BookInfo {
  const book = books[id - 1];
  if (!book) throw new Error(`no book ${id}`);
  return book;
}

/** How many verses a chapter has (topos's default versification); `null` past the book's last chapter */
export const verseCount = (bookId: number, chapter: number): number | null => topos().verseCount(bookId, chapter);

/** Whether the book has a single chapter (Obadiah, Philemon, 2 and 3 John, Jude) */
export const isSingleChapter = (bookId: number) => topos().verseCount(bookId, 2) === null;

const formats = new Map<string, ToposFormat>();
function formatFor(style: "name" | "abbreviation", chapter: boolean): ToposFormat {
  const key = `${style}|${chapter}`;
  let format = formats.get(key);
  if (!format) {
    format = ToposFormat.create()
      .book(style === "name" ? BookStyle.Name : BookStyle.Abbreviation)
      .range("–")
      .chapterInSingleChapterBooks(chapter);
    formats.set(key, format);
  }
  return format;
}

/** Verses of one book as topos writes them: "John 3:16", "Jude 9" (with `noChapter`), "John 3:4–5" */
function formatVerses(bookId: number, verses: { chapter: number; verse: number }[], noChapter: boolean, style: "name" | "abbreviation"): string {
  const t = topos();
  const passage = t.passageFromVerses(bookId, verses);
  const text = passage && t.formatPassage(passage, formatFor(style, !noChapter));
  if (text) return text;
  const book = bookById(bookId);
  const v = verses[0]!;
  return `${style === "name" ? book.name : book.abbreviation} ${noChapter ? "" : `${v.chapter}:`}${v.verse}`;
}

/** "John 3:16"; a verse of a book with one chapter is "Jude 9" when it's `noChapter` */
export const formatRef = (v: VerseRef, style: "name" | "abbreviation" = "name"): string =>
  formatVerses(v.bookId, [v], !!v.noChapter, style);

/** A verse's reference as the translation prints it: "John 3:4–5" when verses 4 and 5 are printed together */
export function formatPrinted(v: VerseRef, printed?: VerseText): string {
  if (!printed?.span) return formatRef(v);
  const [first, last] = printed.span;
  if (printed.chapters) {
    const verses = [{ chapter: printed.chapters[0], verse: first }, { chapter: printed.chapters[1], verse: last }];
    return formatVerses(v.bookId, verses, false, "name");
  }
  const verses = Array.from({ length: last - first + 1 }, (_, i) => ({ chapter: v.chapter, verse: first + i }));
  return formatVerses(v.bookId, verses, !!v.noChapter, "name");
}

/** Verses of a book with one chapter, read from what someone wrote, are written as "Jude 9" */
const asWritten = (bookId: number, chapter: number, verse: number): VerseRef =>
  isSingleChapter(bookId) ? { bookId, chapter, verse, noChapter: true } : { bookId, chapter, verse };

/** A passage written somewhere, with the verses it covers */
export interface FoundPassage {
  /** As topos writes it, e.g. "Hebrews 4:12-13" */
  reference: string;
  verses: VerseRef[];
}

/** Every passage written in the text ("Heb 4:12; Prov 4:12"), in order */
export function findPassages(text: string): FoundPassage[] {
  const t = topos();
  return t.search(text, OffsetUnit.Utf16).map((m) => ({
    reference: m.passage.reference,
    verses: t.verses(m.passage).map(({ chapter, verse }) => asWritten(m.passage.bookId, chapter, verse)),
  }));
}

/** The verses of one reference as topos wrote it; `null` if it isn't one */
export function passageVerses(reference: string): VerseRef[] | null {
  const t = topos();
  const passage = t.parse(reference, BookStyle.Name);
  if (!passage) return null;
  return t.verses(passage).map(({ chapter, verse }) => asWritten(passage.bookId, chapter, verse));
}

/** A book's id from its name or abbreviation ("rom", "1 Pet"), ignoring case */
export const findBook = (name: string): number | null => (name.trim() ? topos().findBook(name.trim()) : null);
