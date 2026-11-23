import { useEffect, useMemo, useState } from "react";
import { loadBook } from "@/bible/library";
import { verseKey, type Translation, type VerseRef, type VerseText } from "@/bible/types";

export interface VerseTexts {
  /** By verse key: the text, `null` when the translation lacks the verse, missing while loading */
  texts: Map<string, VerseText | null>;
  /** Books that couldn't load, with why */
  errors: Map<number, string>;
  loading: boolean;
  retry: () => void;
}

/** The texts of these verses in a translation, filled in book by book as each book loads */
export function useVerseTexts(translation: Translation, verses: VerseRef[]): VerseTexts {
  const key = `${translation.id}|${verses.map(verseKey).join(",")}`;
  const [state, setState] = useState<{ key: string; texts: Map<string, VerseText | null>; errors: Map<number, string> }>({
    key: "",
    texts: new Map(),
    errors: new Map(),
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ key, texts: new Map(), errors: new Map() });
    const byBook = new Map<number, VerseRef[]>();
    for (const v of verses) byBook.set(v.bookId, [...(byBook.get(v.bookId) ?? []), v]);
    for (const [bookId, refs] of byBook) {
      loadBook(translation, bookId).then(
        (book) => {
          if (cancelled) return;
          setState((s) => {
            const texts = new Map(s.texts);
            for (const v of refs) texts.set(verseKey(v), book?.verses[`${v.chapter}:${v.verse}`] ?? null);
            return { ...s, texts };
          });
        },
        (error: unknown) => {
          if (cancelled) return;
          setState((s) => ({ ...s, errors: new Map(s.errors).set(bookId, error instanceof Error ? error.message : String(error)) }));
        },
      );
    }
    return () => {
      cancelled = true;
    };
    // `key` names the translation and verses
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return useMemo(() => {
    const current = state.key === key;
    const texts = current ? state.texts : new Map<string, VerseText | null>();
    const errors = current ? state.errors : new Map<number, string>();
    const loading = verses.some((v) => !texts.has(verseKey(v)) && !errors.has(v.bookId));
    return { texts, errors, loading, retry: () => setAttempt((n) => n + 1) };
  }, [state, key, verses]);
}

/** Downloads the books these verses are in, ahead of time, one after another */
export function prefetch(translation: Translation, verses: VerseRef[]) {
  const books = [...new Set(verses.map((v) => v.bookId))];
  return books.reduce<Promise<unknown>>((p, bookId) => p.then(() => loadBook(translation, bookId).catch(() => null)), Promise.resolve());
}
