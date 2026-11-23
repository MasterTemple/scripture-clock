import { BookStyle, initialized, OffsetUnit, Topos, type BookInfo } from "topos-bible";
import { spanLabel, type VerseRef, type VerseText } from "./types";

let instance: Topos | null = null;
let books: BookInfo[] = [];

/** Loads topos's WebAssembly; call once before anything else here */
export async function loadTopos() {
  if (instance) return;
  await initialized;
  instance = Topos.new();
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

export function formatRef(v: VerseRef, style: "name" | "abbreviation" = "name"): string {
  const book = bookById(v.bookId);
  return `${style === "name" ? book.name : book.abbreviation} ${v.chapter}:${v.verse}`;
}

/** A verse's reference as the translation prints it: "John 3:4–5" when verses 4 and 5 are printed together */
export function formatPrinted(v: VerseRef, printed?: VerseText): string {
  const span = printed && spanLabel(printed);
  if (!span) return formatRef(v);
  const book = bookById(v.bookId).name;
  return printed.chapters ? `${book} ${span}` : `${book} ${v.chapter}:${span}`;
}

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
    verses: t.verses(m.passage).map(({ chapter, verse }) => ({ bookId: m.passage.bookId, chapter, verse })),
  }));
}

/** The verses of one reference as topos wrote it; `null` if it isn't one */
export function passageVerses(reference: string): VerseRef[] | null {
  const t = topos();
  const passage = t.parse(reference, BookStyle.Name);
  if (!passage) return null;
  return t.verses(passage).map(({ chapter, verse }) => ({ bookId: passage.bookId, chapter, verse }));
}

/** A book's id from its name or abbreviation ("rom", "1 Pet"), ignoring case */
export const findBook = (name: string): number | null => (name.trim() ? topos().findBook(name.trim()) : null);
