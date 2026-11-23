import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILT_IN, DEFAULT_TRANSLATION } from "@/bible/translations";
import type { Translation, TranslationEdit } from "@/bible/types";
import type { Pin, Priorities, Priority } from "@/clock/choose";
import type { HourFormat, ReadingRules } from "@/clock/times";
import { useMemo } from "react";

export type Theme = "system" | "light" | "dark";

/** How the one-verse display is laid out: `auto` is side by side when the screen is wider than tall */
export type DisplayLayout = "auto" | "stacked" | "side" | "verse" | "night";

export interface Settings {
  hourFormat: HourFormat;
  /** Also read the clock's digits split other ways: 5:48 as 54:8 */
  otherReadings: boolean;
  /** Also read the time with its zeros left out: 1:10 as 1:1 */
  ignoreZeros: boolean;
  showSeconds: boolean;
  /** Keep the screen from sleeping while the clock is open */
  keepAwake: boolean;
  theme: Theme;
  displayLayout: DisplayLayout;
  /** How many verses the display shows at once */
  displayCount: number;
  /** How many times a minute the display moves on to new verses (each lasting 60 ÷ this seconds) */
  perMinute: number;
  /** The display shows only pinned verses; between their times, the last one stays */
  onlyPinned: boolean;
  /** What opens: one verse at a time, or every verse at the time */
  view: "display" | "list";
}

interface State {
  translationId: string;
  /** Translations added from fetch.bible's list or uploaded */
  translations: Translation[];
  settings: Settings;
  priorities: Priorities;
  pins: Pin[];

  setTranslation: (id: string) => void;
  addTranslation: (t: Translation) => void;
  /** Renames an added translation, or changes its books; its id (and so its saved books) stays */
  updateTranslation: (id: string, patch: TranslationEdit) => void;
  removeTranslation: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setPriority: (bookIds: number[], priority: Priority) => void;
  resetPriorities: () => void;
  addPins: (pins: Omit<Pin, "id">[]) => void;
  removePin: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** A 24-hour clock where the device's own clock is one */
const defaultHourFormat = (): HourFormat => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 === false ? "24h" : "12h";
  } catch {
    return "12h";
  }
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      translationId: DEFAULT_TRANSLATION,
      translations: [],
      settings: {
        hourFormat: defaultHourFormat(),
        otherReadings: true,
        ignoreZeros: false,
        showSeconds: false,
        keepAwake: false,
        theme: "system",
        displayLayout: "auto",
        displayCount: 1,
        perMinute: 1,
        onlyPinned: false,
        view: "display",
      },
      priorities: {},
      pins: [],

      setTranslation: (translationId) => set({ translationId }),
      addTranslation: (t) => set((s) => ({ translations: [...s.translations.filter((x) => x.id !== t.id), t] })),
      updateTranslation: (id, patch) =>
        set((s) => ({ translations: s.translations.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTranslation: (id) =>
        set((s) => ({
          translations: s.translations.filter((t) => t.id !== id),
          translationId: s.translationId === id ? DEFAULT_TRANSLATION : s.translationId,
        })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setPriority: (bookIds, priority) =>
        set((s) => {
          const priorities = { ...s.priorities };
          for (const id of bookIds) {
            if (priority === 2) delete priorities[id];
            else priorities[id] = priority;
          }
          return { priorities };
        }),
      resetPriorities: () => set({ priorities: {} }),
      // The same reference at the same time again isn't added twice
      addPins: (pins) =>
        set((s) => {
          const fresh = pins.filter((p) => !s.pins.some((x) => x.hour === p.hour && x.minute === p.minute && x.reference === p.reference));
          return { pins: [...s.pins, ...fresh.map((p) => ({ ...p, id: uid() }))] };
        }),
      removePin: (id) => set((s) => ({ pins: s.pins.filter((p) => p.id !== id) })),
    }),
    {
      name: "scripture-clock",
      version: 1,
      // Settings added since a visit keep their defaults
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<State>;
        return { ...current, ...s, settings: { ...current.settings, ...s.settings } };
      },
    },
  ),
);

/** Which ways of reading the time are on, as one object that changes only when they do */
export function useReadingRules(): ReadingRules {
  const others = useApp((s) => s.settings.otherReadings);
  const ignoreZeros = useApp((s) => s.settings.ignoreZeros);
  return useMemo(() => ({ others, ignoreZeros }), [others, ignoreZeros]);
}

export const useTranslation = (): Translation => {
  const id = useApp((s) => s.translationId);
  const added = useApp((s) => s.translations);
  return BUILT_IN.find((t) => t.id === id) ?? added.find((t) => t.id === id) ?? BUILT_IN[0]!;
};
