import { formatRef, passageVerses } from "@/bible/topos";
import { verseKey, type VerseRef } from "@/bible/types";
import { hashString, shuffled, weightedShuffled } from "./random";
import { addMinutes, shownHour, versesForTime, type ClockTime, type HourFormat, type ReadingRules } from "./times";

/** How often a book's verses are picked: never, less, normal, more, most */
export type Priority = 0 | 1 | 2 | 3 | 4;
export const DEFAULT_PRIORITY: Priority = 2;
export const PRIORITY_LABELS = ["Never", "Less", "Normal", "More", "Most"] as const;
/** Each level about three times as likely as the one below */
export const PRIORITY_WEIGHTS = [0, 1, 4, 12, 40] as const;

/** Book priorities by book id; a book missing is Normal */
export type Priorities = Record<number, Priority>;

export const priorityOf = (priorities: Priorities, bookId: number): Priority => priorities[bookId] ?? DEFAULT_PRIORITY;

/** Books grouped as the Bible is, for setting their priorities together */
export const BOOK_GROUPS: { name: string; testament: "Old Testament" | "New Testament"; books: number[] }[] = [
  { name: "Law", testament: "Old Testament", books: [1, 2, 3, 4, 5] },
  { name: "History", testament: "Old Testament", books: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { name: "Wisdom & Poetry", testament: "Old Testament", books: [18, 19, 20, 21, 22] },
  { name: "Major Prophets", testament: "Old Testament", books: [23, 24, 25, 26, 27] },
  { name: "Minor Prophets", testament: "Old Testament", books: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39] },
  { name: "Gospels & Acts", testament: "New Testament", books: [40, 41, 42, 43, 44] },
  { name: "Paul's Letters", testament: "New Testament", books: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57] },
  { name: "General Letters & Revelation", testament: "New Testament", books: [58, 59, 60, 61, 62, 63, 64, 65, 66] },
];

/** A verse (or passage) pinned to a time, to show then before any other */
export interface Pin {
  id: string;
  /** 0–23; on a 12-hour clock, 4 is both 4 AM and 4 PM, and 16 only 4 PM */
  hour: number;
  minute: number;
  /** As topos writes it, e.g. "Hebrews 4:12" or "Hebrews 4:12-13" */
  reference: string;
}

/** Whether a pin is for this time: on a 12-hour clock, a pin at 4:12 is for both 4:12s */
export const pinMatches = (pin: Pin, t: ClockTime, format: HourFormat) =>
  pin.minute === t.minute && (pin.hour === t.hour || pin.hour === shownHour(t, format));

/** How a pin's time reads: "4:12" (twice a day on a 12-hour clock) or "16:12" */
export const pinTime = (pin: Pin) => `${pin.hour}:${String(pin.minute).padStart(2, "0")}`;

/** Something the display can show: a verse at the time, or a pinned verse or passage */
export interface Candidate {
  id: string;
  verses: VerseRef[];
  /** As written, "Hebrews 4:12-13" */
  reference: string;
  pinned: boolean;
}

export const pinsAt = (pins: Pin[], t: ClockTime, format: HourFormat) => pins.filter((p) => pinMatches(p, t, format));

/**
 * With only pinned verses shown, the time whose pins show now: this minute's, or else the last
 * time before it with a pin (as if the clock had been showing it since); `null` with nothing
 * pinned. A day back from now is the same minute, so it's always found when anything is pinned.
 */
export function pinnedTimeFor(t: ClockTime, format: HourFormat, pins: Pin[]): ClockTime | null {
  const valid = pins.filter((p) => passageVerses(p.reference)?.length);
  if (!valid.length) return null;
  for (let i = 0; i < 1440; i++) {
    const at = addMinutes(t, -i);
    if (pinsAt(valid, at, format).length) return at;
  }
  return null;
}

/** The pin after this time, for "next at 4:12" */
export function nextPinnedTime(t: ClockTime, format: HourFormat, pins: Pin[]): ClockTime | null {
  const valid = pins.filter((p) => passageVerses(p.reference)?.length);
  for (let i = 1; i <= 1440; i++) {
    const at = addMinutes(t, i);
    if (pinsAt(valid, at, format).length) return at;
  }
  return null;
}

/**
 * What the display goes through at a time, in order: the pinned verses first (in random order,
 * so several at one time take turns), then the time's verses, shuffled by book priority (books
 * set to Never left out). The order is fixed by `seed`.
 */
export function candidatesFor(
  t: ClockTime,
  format: HourFormat,
  options: { rules: Partial<ReadingRules>; priorities: Priorities; pins: Pin[]; onlyPinned?: boolean },
  seed: string,
): Candidate[] {
  const pinned: Candidate[] = [];
  const pinnedVerses = new Set<string>();
  for (const pin of pinsAt(options.pins, t, format)) {
    const verses = passageVerses(pin.reference);
    if (!verses?.length) continue;
    pinned.push({ id: `pin:${pin.id}`, verses, reference: pin.reference, pinned: true });
    if (verses.length === 1) pinnedVerses.add(verseKey(verses[0]!));
  }
  if (options.onlyPinned) return shuffled(pinned, hashString(`${seed}|pins`));
  const atTime = versesForTime(t, format, options.rules)
    .flatMap((g) => g.verses)
    .filter((v) => !pinnedVerses.has(verseKey(v)));
  const weighted = weightedShuffled(atTime, (v) => PRIORITY_WEIGHTS[priorityOf(options.priorities, v.bookId)], hashString(`${seed}|time`));
  return [
    ...shuffled(pinned, hashString(`${seed}|pins`)),
    ...weighted.map((v) => ({ id: verseKey(v), verses: [v], reference: formatRef(v), pinned: false })),
  ];
}
