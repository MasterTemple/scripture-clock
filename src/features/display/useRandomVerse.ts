import { useCallback, useEffect, useState } from "react";
import { loadBook, loadVerse } from "@/bible/library";
import { formatPrinted } from "@/bible/topos";
import type { Translation, VerseText } from "@/bible/types";
import type { Candidate } from "@/clock/choose";

/** Differs each time the page opens, so a reload doesn't always pick the same verses */
export const SALT = Math.floor(Math.random() * 2 ** 32).toString(36);

export interface PickedVerse {
  candidate: Candidate;
  text: string;
  reference: string;
  /** Where it is in the candidates, from 0 */
  position: number;
}

export type Picked =
  | { status: "loading" }
  /** `of`: how many candidates there are */
  | { status: "verse"; items: PickedVerse[]; of: number }
  /** The translation has none of the verses */
  | { status: "none" }
  | { status: "error"; error: string };

/** A candidate's text in a translation, verses printed together counted once; `null` if it has none of them */
async function candidateText(translation: Translation, candidate: Candidate): Promise<{ text: string; reference: string } | null> {
  const texts = await Promise.all(candidate.verses.map((v) => loadVerse(translation, v)));
  const parts: VerseText[] = [];
  for (const t of texts) if (t && parts.at(-1) !== t && parts.at(-1)?.text !== t.text) parts.push(t);
  if (!parts.length) return null;
  const reference = candidate.verses.length === 1 ? formatPrinted(candidate.verses[0]!, parts[0]) : candidate.reference;
  return { text: parts.map((p) => p.text).join(" "), reference };
}

/**
 * The first `count` of `candidates` (already in random order) that the translation has: a book
 * is only downloaded for what's tried. `next` goes on to the ones after. The same `key` (the
 * translation, time, and choices) keeps the same pick, however often it renders.
 */
export function useRandomVerse(translation: Translation, candidates: Candidate[], seed: string, count = 1) {
  const key = `${seed}|${count}`;
  const [start, setStart] = useState({ key: seed, at: 0 });
  const [picked, setPicked] = useState<{ key: string; at: number; picked: Picked }>({ key: "", at: 0, picked: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);
  // Showing more or fewer at once keeps the first one where it is
  const at = start.key === seed ? start.at : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (candidates.length === 0) return setPicked({ key, at, picked: { status: "none" } });
      let error: string | null = null;
      const items: PickedVerse[] = [];
      for (let i = 0; i < candidates.length && items.length < count; i++) {
        const index = (at + i) % candidates.length;
        const candidate = candidates[index]!;
        try {
          const found = await candidateText(translation, candidate);
          if (cancelled) return;
          if (found) items.push({ candidate, ...found, position: index });
        } catch (e) {
          if (cancelled) return;
          // Offline, another verse from a book saved already may still be found
          error = e instanceof Error ? e.message : String(e);
        }
      }
      if (cancelled) return;
      if (items.length) setPicked({ key, at, picked: { status: "verse", items, of: candidates.length } });
      else setPicked({ key, at, picked: error ? { status: "error", error } : { status: "none" } });
    })();
    return () => {
      cancelled = true;
    };
    // `key` stands for the candidates and translation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, at, attempt]);

  const current = picked.key === key && picked.at === at ? picked.picked : null;
  /** What was shown before, while the next one loads, so the screen doesn't flash empty */
  const shown = current ?? (picked.picked.status === "verse" ? picked.picked : ({ status: "loading" } as Picked));

  /** Whether there's something else to show: more candidates than fit at once */
  const more = candidates.length > count;
  const next = useCallback(() => {
    if (!more) return;
    const from = current?.status === "verse" ? current.items.at(-1)!.position : at;
    setStart({ key: seed, at: (from + 1) % candidates.length });
  }, [more, candidates.length, current, at, seed]);

  return { picked: shown, stale: current === null, next, more, retry: () => setAttempt((n) => n + 1) };
}

/** Downloads the books of what will be tried first */
export function prefetchFirst(translation: Translation, candidates: Candidate[], count = 1) {
  const books = new Set(candidates.slice(0, count).flatMap((c) => c.verses.map((v) => v.bookId)));
  for (const bookId of books) loadBook(translation, bookId).catch(() => {});
}
