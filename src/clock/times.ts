import { verseCount } from "@/bible/topos";
import type { VerseRef } from "@/bible/types";

/** A time of day, 24-hour */
export interface ClockTime {
  hour: number;
  minute: number;
}

export type HourFormat = "12h" | "24h";

/** One way of reading a time as a chapter and verse: 5:48 is 5:48, and also 54:8 */
export interface Reading {
  chapter: number;
  verse: number;
  /** The hour as the chapter and the minute as the verse, as the clock shows it */
  exact: boolean;
}

export const BOOK_COUNT = 66;

/** The hour as the clock shows it: 0–23, or 1–12 */
export function shownHour(t: ClockTime, format: HourFormat): number {
  if (format === "24h") return t.hour;
  return t.hour % 12 || 12;
}

/** "5:48", or "17:48" on a 24-hour clock */
export const formatTime = (t: ClockTime, format: HourFormat) => `${shownHour(t, format)}:${String(t.minute).padStart(2, "0")}`;

/**
 * Every chapter and verse the time can be read as. First the hour and minute (5:48, and 12:05 as
 * 12:5), then the clock's digits split anywhere else (548 as 54:8; 1191 as 119:1), neither part
 * starting with a zero. A chapter or verse of 0 has none.
 */
export function readings(t: ClockTime, format: HourFormat, others = true): Reading[] {
  const hour = shownHour(t, format);
  const out: Reading[] = [];
  const add = (chapter: number, verse: number, exact: boolean) => {
    if (chapter < 1 || verse < 1) return;
    if (out.some((r) => r.chapter === chapter && r.verse === verse)) return;
    out.push({ chapter, verse, exact });
  };
  add(hour, t.minute, true);
  if (!others) return out;
  const digits = `${hour}${String(t.minute).padStart(2, "0")}`;
  for (let i = 1; i < digits.length; i++) {
    const chapter = digits.slice(0, i);
    const verse = digits.slice(i);
    if (chapter.startsWith("0") || verse.startsWith("0")) continue;
    add(Number(chapter), Number(verse), false);
  }
  return out;
}

/** Every book with this chapter and verse, Genesis to Revelation */
export function versesAt(chapter: number, verse: number): VerseRef[] {
  const out: VerseRef[] = [];
  for (let bookId = 1; bookId <= BOOK_COUNT; bookId++) {
    const count = verseCount(bookId, chapter);
    if (count !== null && count >= verse) out.push({ bookId, chapter, verse });
  }
  return out;
}

export interface Group extends Reading {
  verses: VerseRef[];
}

/** The verses for each reading of the time, leaving out readings no book has */
export function versesForTime(t: ClockTime, format: HourFormat, others = true): Group[] {
  return readings(t, format, others)
    .map((r) => ({ ...r, verses: versesAt(r.chapter, r.verse) }))
    .filter((g) => g.verses.length > 0);
}

export const addMinutes = (t: ClockTime, n: number): ClockTime => {
  const total = (((t.hour * 60 + t.minute + n) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
};

export const sameTime = (a: ClockTime, b: ClockTime) => a.hour === b.hour && a.minute === b.minute;

/** The next time, after this one, that has a verse (searching a whole day) */
export function nextWithVerses(t: ClockTime, format: HourFormat, others = true, step = 1): ClockTime | null {
  for (let i = 1; i < 1440; i++) {
    const next = addMinutes(t, i * step);
    if (versesForTime(next, format, others).length) return next;
  }
  return null;
}

/** "17:48" or "5:48" from a URL's hash; `null` if it isn't a time */
export function parseTime(text: string): ClockTime | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** For the URL: always 24-hour, so a link means the same time on any clock */
export const timeParam = (t: ClockTime) => `${t.hour}:${String(t.minute).padStart(2, "0")}`;

/** How many times a minute the display can move on: the ones that divide a minute evenly */
export const PER_MINUTE = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60] as const;

/** Which part of the minute it is, when it's split `perMinute` ways: 0 at :00, 1 at :30 for 2… */
export const slotOf = (seconds: number, perMinute: number) => Math.floor(seconds / (60 / perMinute));

/** "30 seconds", "1 minute" */
export const slotLength = (perMinute: number) => (perMinute === 1 ? "a minute" : `${60 / perMinute} seconds`);
