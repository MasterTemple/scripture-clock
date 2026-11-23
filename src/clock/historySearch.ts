import { bookById, findBook, findPassages, passageVerses } from "@/bible/topos";
import { verseKey } from "@/bible/types";
import type { Screen, SeenVerse } from "@/state/history";

export type Period = "today" | "week" | "month" | "all";

export interface HistoryFilter {
  query: string;
  period: Period;
  /** `null` for every translation */
  translationId: string | null;
  pinnedOnly: boolean;
}

/** One verse seen, with the screen it was on */
export interface SeenRow {
  key: string;
  screen: Screen;
  item: SeenVerse;
}

function since(period: Period, now: number): number {
  if (period === "all") return 0;
  if (period === "today") {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  return now - (period === "week" ? 7 : 30) * 86_400_000;
}

/**
 * How a search matches: a reference ("Rom 8", "John 3:16-18") matches the verses in it; other
 * words must each be in the reference or the text, and a book's name or abbreviation ("rom",
 * "1 pet") matches its verses (or the word itself, whole)
 */
export function matcher(query: string): (item: SeenVerse) => boolean {
  const q = query.trim();
  if (!q) return () => true;

  const passages = findPassages(q);
  if (passages.length) {
    const keys = new Set(passages.flatMap((p) => p.verses.map(verseKey)));
    return (item) => {
      if (keys.has(item.id)) return true;
      const verses = item.pinned ? passageVerses(item.reference) : null;
      return !!verses?.some((v) => keys.has(verseKey(v)));
    };
  }

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const books = terms.map((t) => {
    const id = /^\d$/.test(t) ? null : findBook(t);
    return id ? bookById(id).name.toLowerCase() : null;
  });
  // A word naming a book ("rom") matches the book, or itself as a whole word, not inside another ("from")
  const words = terms.map((t, i) => (books[i] ? new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) : null));
  return (item) => {
    const reference = item.reference.toLowerCase();
    const hay = `${reference} ${item.text.toLowerCase()}`;
    return terms.every((t, i) => (books[i] !== null ? reference.startsWith(`${books[i]} `) || words[i]!.test(hay) : hay.includes(t)));
  };
}

/** The verses seen that match, newest first */
export function filterHistory(screens: Screen[], filter: HistoryFilter, now = Date.now()): SeenRow[] {
  const from = since(filter.period, now);
  const matches = matcher(filter.query);
  const rows: SeenRow[] = [];
  for (const screen of screens) {
    if (screen.shownAt < from) break; // newest first, so the rest are older still
    if (filter.translationId && screen.translationId !== filter.translationId) continue;
    for (const item of screen.items) {
      if (filter.pinnedOnly && !item.pinned) continue;
      if (matches(item)) rows.push({ key: `${screen.id}/${item.id}`, screen, item });
    }
  }
  return rows;
}

/** The words of a search worth marking in a verse's text (not a reference's numbers) */
export const highlightTerms = (query: string) =>
  findPassages(query).length ? [] : query.toLowerCase().split(/\s+/).filter((t) => t.length > 1 && !/^\d+$/.test(t));
