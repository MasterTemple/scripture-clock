import { create } from "zustand";
import { persist } from "zustand/middleware";

/** One verse (or pinned passage) as it was shown */
export interface SeenVerse {
  /** The candidate's id: a verse key, or `pin:…` */
  id: string;
  reference: string;
  text: string;
  pinned: boolean;
}

/** What the display showed at once: one verse, or several */
export interface Screen {
  id: string;
  /** When it was shown (ms) */
  shownAt: number;
  /** The clock's time it was shown for, 24-hour (a time looked at, not now, when browsing) */
  hour: number;
  minute: number;
  translationId: string;
  abbreviation: string;
  items: SeenVerse[];
}

/** Plenty for months of looking, and still small (a few hundred KB) */
const MAX_SCREENS = 2000;

interface HistoryState {
  screens: Screen[];
  /** Whether history is kept on this device; off, it lasts only until the page closes */
  keep: boolean;
  /** Adds a screen unless it's the one shown last (the same verses, at the same minute) */
  record: (screen: Omit<Screen, "id" | "shownAt">) => void;
  remove: (id: string) => void;
  clear: () => void;
  setKeep: (keep: boolean) => void;
}

const sameScreen = (a: Omit<Screen, "id" | "shownAt">, b: Screen) =>
  a.hour === b.hour &&
  a.minute === b.minute &&
  a.translationId === b.translationId &&
  a.items.length === b.items.length &&
  a.items.every((it, i) => it.id === b.items[i]!.id);

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      screens: [],
      keep: true,
      record: (screen) =>
        set((s) => {
          const last = s.screens[0];
          // Shown again within the same few minutes (back from the list, say): already there
          if (last && sameScreen(screen, last) && Date.now() - last.shownAt < 10 * 60_000) return s;
          const entry: Screen = { ...screen, id: Math.random().toString(36).slice(2, 10), shownAt: Date.now() };
          return { screens: [entry, ...s.screens].slice(0, MAX_SCREENS) };
        }),
      remove: (id) => set((s) => ({ screens: s.screens.filter((x) => x.id !== id) })),
      clear: () => set({ screens: [] }),
      setKeep: (keep) => set({ keep }),
    }),
    {
      name: "scripture-clock-history",
      version: 1,
      // Kept apart from the settings, so a verse shown doesn't rewrite them; not kept at all when off
      partialize: (s) => ({ keep: s.keep, screens: s.keep ? s.screens : [] }),
    },
  ),
);
