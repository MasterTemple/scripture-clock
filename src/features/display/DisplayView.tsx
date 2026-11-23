import {
  CheckIcon,
  LayoutTemplateIcon,
  HistoryIcon,
  ListIcon,
  Loader2Icon,
  MaximizeIcon,
  MinimizeIcon,
  PinIcon,
  PinOffIcon,
  SettingsIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  UndoIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { candidatesFor, nextPinnedTime, pinnedTimeFor, pinsAt } from "@/clock/choose";
import { addMinutes, formatTime, PER_MINUTE, shownHour, slotLength, slotOf, timeLabels, type ClockTime, type HourFormat } from "@/clock/times";
import { Reference } from "@/components/Reference";
import { CustomizeDialog, type CustomizeTab } from "@/features/customize/CustomizeDialog";
import { useHistory } from "@/state/history";
import { toast } from "sonner";
import { MAX_AT_ONCE, SettingsDialog } from "@/features/settings/SettingsDialog";
import { TranslationDialog } from "@/features/translations/TranslationDialog";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Switch } from "@/components/ui/primitives";
import { cn, seenAt } from "@/lib/utils";
import { useApp, useTranslation } from "@/state/store";
import { LAYOUTS } from "./layouts";
import { useFitText } from "./useFitText";
import { prefetchFirst, SALT, useRandomVerse, type Picked } from "./useRandomVerse";


const pad = (n: number) => String(n).padStart(2, "0");

function useLandscape() {
  const query = "(orientation: landscape)";
  const [landscape, setLandscape] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const change = () => setLandscape(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return landscape;
}

function Clock({
  time,
  seconds = null,
  format,
  style,
  className,
  colon = "text-primary",
}: {
  time: ClockTime;
  seconds?: number | null;
  format: HourFormat;
  style?: CSSProperties;
  className?: string;
  colon?: string;
}) {
  const separator = <span className={cn("mx-[0.03em] animate-[blink_2s_ease-in-out_infinite]", colon)}>:</span>;
  return (
    <div className={cn("flex items-baseline font-serif leading-none font-semibold tracking-tight tabular-nums", className)} style={style}>
      <span>{shownHour(time, format)}</span>
      {separator}
      <span>{pad(time.minute)}</span>
      {seconds !== null && (
        <>
          {separator}
          <span>{pad(seconds)}</span>
        </>
      )}
      {format === "12h" && <span className="ml-[0.12em] font-sans text-[0.2em] font-medium tracking-normal opacity-60">{time.hour < 12 ? "AM" : "PM"}</span>}
    </div>
  );
}

/** The picked verses, their text as large as fits, each with its reference */
function Verses({
  picked,
  stale,
  time,
  format,
  abbreviation,
  max,
  align = "center",
  className,
  textClassName,
  referenceClassName,
  empty,
}: {
  picked: Picked;
  /** What to say when there's no verse, in place of "No verse at 5:00" */
  empty?: string;
  stale: boolean;
  time: ClockTime;
  format: HourFormat;
  abbreviation: string;
  max: number;
  align?: "center" | "left";
  className?: string;
  textClassName?: string;
  referenceClassName?: string;
}) {
  const content = picked.status === "verse" ? picked.items.map((it) => it.candidate.id + it.text).join("|") : picked.status;
  const { box, text } = useFitText<HTMLDivElement, HTMLDivElement>(content, { min: 10, max });
  const centered = align === "center";
  const labels = timeLabels(time, format);

  let body: ReactNode;
  if (picked.status === "verse") {
    body = picked.items.map((it, i) => (
      <div key={it.candidate.id} className={cn(i > 0 && "mt-[0.85em] border-t border-current/10 pt-[0.85em]")}>
        <p className={cn("leading-[1.38] text-pretty", textClassName)}>{it.text}</p>
        {/* Sized from the verse's text, but kept readable when that's small, and not shouting when large */}
        <div
          className={cn("mt-[0.6em] font-sans font-semibold tracking-[0.08em] text-primary uppercase", referenceClassName)}
          style={{ fontSize: "clamp(0.72rem, 0.4em, 1.25rem)" }}
        >
          {it.candidate.pinned && <PinIcon className="mr-1.5 inline size-[0.9em] -rotate-12 align-[-0.1em]" aria-label="Pinned" />}
          <Reference reference={it.reference} labels={labels} /> <span className="opacity-60">· {abbreviation}</span>
        </div>
      </div>
    ));
  } else if (picked.status === "loading") {
    body = <Loader2Icon className={cn("size-8 animate-spin opacity-40", centered && "mx-auto")} />;
  } else if (picked.status === "error") {
    body = <p className={cn("opacity-60", textClassName)}>Couldn't download the verse. Are you offline?</p>;
  } else {
    body = <p className={cn("opacity-60", textClassName)}>{empty ?? `No verse at ${formatTime(time, format)} in ${abbreviation}.`}</p>;
  }

  return (
    <div ref={box} className={cn("flex min-h-0 min-w-0 items-center overflow-hidden", centered ? "justify-center text-center" : "text-left", className)}>
      <div key={content} ref={text} className={cn("w-full animate-[fade-up_0.5s_ease-out] font-serif transition-opacity duration-500", stale && "opacity-50")}>
        {body}
      </div>
    </div>
  );
}

/** Shows the controls on a tap or a mouse move, and hides them after a few still seconds */
function useIdle(delay = 3500) {
  const [active, setActive] = useState(true);
  const timer = useRef<number>(0);
  const poke = useCallback(() => {
    setActive(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), delay);
  }, [delay]);
  useEffect(() => {
    poke();
    return () => clearTimeout(timer.current);
  }, [poke]);
  return { active, poke, hide: () => (clearTimeout(timer.current), setActive(false)) };
}

function useFullscreen() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const change = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const supported = document.fullscreenEnabled;
  const toggle = useCallback(async (landscape: boolean) => {
    if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
    // The whole page, so menus (drawn at the page's end) still show
    await document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    // Android turns to landscape on request, once full screen; others say no
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (landscape) await orientation.lock?.("landscape").catch(() => {});
  }, []);
  return { on, supported, toggle };
}

export function DisplayView({
  time,
  seconds,
  tick,
  live,
  onClose,
}: {
  time: ClockTime;
  /** The seconds to show on the clock, when shown */
  seconds: number | null;
  /** The seconds now, live, to move on partway through the minute */
  tick: number | null;
  live: boolean;
  onClose: () => void;
}) {
  const translation = useTranslation();
  const format = useApp((s) => s.settings.hourFormat);
  const others = useApp((s) => s.settings.otherReadings);
  const layout = useApp((s) => s.settings.displayLayout);
  const count = useApp((s) => s.settings.displayCount);
  const showSeconds = useApp((s) => s.settings.showSeconds);
  const perMinute = useApp((s) => s.settings.perMinute);
  const onlyPinned = useApp((s) => s.settings.onlyPinned);
  const update = useApp((s) => s.updateSettings);
  const landscape = useLandscape();
  const fullscreen = useFullscreen();
  const idle = useIdle();

  const priorities = useApp((s) => s.priorities);
  const pins = useApp((s) => s.pins);
  const addPins = useApp((s) => s.addPins);
  const removePin = useApp((s) => s.removePin);
  const [customizing, setCustomizing] = useState<CustomizeTab | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const screens = useHistory((s) => s.screens);
  const record = useHistory((s) => s.record);

  // Everything that changes what's picked; the same key keeps the same pick. Not the translation:
  // changing it shows the same verses in the other one
  const choices = `${format}|${others}|${onlyPinned}|${JSON.stringify(priorities)}|${pins.map((p) => p.id).join(",")}`;
  const seedFor = (t: ClockTime) => `${SALT}|${choices}|${t.hour}:${t.minute}`;
  /**
   * The time whose verses show: now, or with only pinned verses, the last time pinned (so a pinned
   * verse stays until the next one's time); `null` with nothing pinned
   */
  const sourceFor = (t: ClockTime) => (onlyPinned ? pinnedTimeFor(t, format, pins) : t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => sourceFor(time), [choices, time.hour, time.minute]);
  const key = seedFor(source ?? time);
  const options = { others, priorities, pins, onlyPinned };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => (source ? candidatesFor(source, format, options, key) : []), [key]);
  /** With only pinned verses, when the next ones come, for the bar */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextPinned = useMemo(() => (onlyPinned ? nextPinnedTime(time, format, pins) : null), [choices, time.hour, time.minute]);
  const { picked, stale, next, more } = useRandomVerse(translation, candidates, key, count);

  // Several times a minute, on to the next verses as each part of the minute starts (2 a minute:
  // at :00 and :30). Opened partway through, it starts from the first.
  const slot = live && tick !== null && perMinute > 1 ? slotOf(tick, perMinute) : null;
  const lastSlot = useRef({ key, slot });
  useEffect(() => {
    const before = lastSlot.current;
    lastSlot.current = { key, slot };
    if (slot !== null && before.key === key && before.slot !== null && slot > before.slot) next();
  }, [slot, key, next]);

  // The verses after these, downloaded before their turn
  useEffect(() => {
    if (stale || picked.status !== "verse") return;
    const after = picked.items.at(-1)!.position + 1;
    prefetchFirst(translation, [...candidates.slice(after), ...candidates.slice(0, after)], count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, stale]);

  /** An earlier screen being looked at, by its place in the history (0 the latest); `null` for now */
  const [view, setView] = useState<number | null>(null);
  const viewing = view === null ? null : (screens[view] ?? null);

  // Each screen goes in the history once it shows (not while looking back, so places stay put)
  useEffect(() => {
    if (view !== null || stale || picked.status !== "verse") return;
    record({
      hour: time.hour,
      minute: time.minute,
      translationId: translation.id,
      abbreviation: translation.abbreviation,
      items: picked.items.map((it) => ({ id: it.candidate.id, reference: it.reference, text: it.text, pinned: it.candidate.pinned })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, stale, view]);

  /** Whether the latest screen in the history is the one showing now */
  const nowIsLatest = (() => {
    const last = screens[0];
    if (!last || stale || picked.status !== "verse") return false;
    return last.hour === time.hour && last.minute === time.minute && last.items.length === picked.items.length && last.items.every((it, i) => it.id === picked.items[i]!.candidate.id);
  })();

  /** Back a screen, into earlier minutes too */
  const back = useCallback(() => {
    const target = view === null ? (nowIsLatest ? 1 : 0) : view + 1;
    if (target < screens.length) setView(target);
    else toast("That's the first one in your history", { id: "history-start", duration: 1500 });
  }, [view, nowIsLatest, screens.length]);

  /** Forward a screen, and past the latest, on to verses not seen yet */
  const forward = useCallback(() => {
    if (view === null) return next();
    const target = view - 1;
    setView(target < 0 || (target === 0 && nowIsLatest) ? null : target);
  }, [view, nowIsLatest, next]);

  // Left looking back, it comes back to now after a minute
  useEffect(() => {
    if (view === null) return;
    const timer = window.setTimeout(() => setView(null), 60_000);
    return () => clearTimeout(timer);
  }, [view]);

  /** What's on screen: now's verses, or an earlier screen's */
  const shown: { picked: Picked; stale: boolean; time: ClockTime; seconds: number | null; abbreviation: string } = viewing
    ? {
        picked: {
          status: "verse",
          of: 0,
          items: viewing.items.map((it, i) => ({
            candidate: { id: it.id, verses: [], reference: it.reference, pinned: it.pinned },
            text: it.text,
            reference: it.reference,
            position: i,
          })),
        },
        stale: false,
        time: { hour: viewing.hour, minute: viewing.minute },
        seconds: null,
        abbreviation: viewing.abbreviation,
      }
    : { picked, stale, time, seconds, abbreviation: translation.abbreviation };

  // The next minute's verse, downloaded before it comes
  useEffect(() => {
    if (!live || picked.status === "loading") return;
    const soon = sourceFor(addMinutes(time, 1));
    if (!soon || (source && soon.hour === source.hour && soon.minute === source.minute)) return;
    prefetchFirst(translation, candidatesFor(soon, format, options, seedFor(soon)), count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key, count, picked.status, translation.id]);

  // Pins the verse showing to the time it shows at (both 4:12s on a 12-hour clock), or unpins it;
  // with several showing, they're pinned from the list or the pins dialog instead
  const only = shown.picked.status === "verse" && shown.picked.items.length === 1 ? shown.picked.items[0]! : null;
  // With only pinned verses, the one showing is pinned at its own time, not now's
  const pinTime = viewing || !source ? shown.time : source;
  const pinLabel = `${shownHour(pinTime, format)}:${String(pinTime.minute).padStart(2, "0")}`;
  const pinnedHere = only ? pinsAt(pins, pinTime, format).filter((p) => p.reference === only.candidate.reference) : [];
  const togglePin = () => {
    if (!only) return;
    if (pinnedHere.length) for (const p of pinnedHere) removePin(p.id);
    else addPins([{ hour: shownHour(pinTime, format), minute: pinTime.minute, reference: only.candidate.reference }]);
  };

  // The page under it shouldn't scroll
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  const arrangement = layout === "auto" || layout === "night" ? (landscape ? "side" : "stacked") : layout;
  const night = layout === "night";

  const cycleLayout = useCallback(() => {
    const i = LAYOUTS.findIndex((l) => l.value === layout);
    update({ displayLayout: LAYOUTS[(i + 1) % LAYOUTS.length]!.value });
  }, [layout, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A dialog or menu closing on Escape has already handled the key (and is gone from the page)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=menu],[role=dialog]")) return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "n") forward();
      else if (e.key === "ArrowLeft" || e.key === "b") back();
      else if (e.key === "f") fullscreen.toggle(arrangement === "side");
      else if (e.key === "l") cycleLayout();
      else if (e.key === "t") setTranslationsOpen(true);
      else if (e.key === "+" || e.key === "=") update({ displayCount: Math.min(MAX_AT_ONCE, count + 1) });
      else if (e.key === "-") update({ displayCount: Math.max(1, count - 1) });
      else if (e.key === "Escape" && !document.fullscreenElement) onClose();
      else return;
      e.preventDefault();
      idle.poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forward, back, fullscreen, arrangement, cycleLayout, onClose, idle, count, update]);

  // A swipe to the left goes on to another verse, to the right back to the one before; a tap
  // shows (or hides) the controls
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    // Taps in the menus and dialogs (drawn elsewhere, but still inside this in React) aren't on the verse
    if ((e.target as HTMLElement).closest("button,select,input,a,[role=menu],[role=dialog]")) return;
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) forward();
      else back();
      return;
    }
    if (Math.hypot(dx, dy) < 10) {
      if (idle.active && e.pointerType !== "mouse") idle.hide();
      else idle.poke();
    }
  };

  const empty = onlyPinned && !source && !viewing ? "Nothing is pinned yet. Pin verses to times, or turn off Only pinned verses in Settings." : undefined;
  const verseProps = { picked: shown.picked, stale: shown.stale, time: shown.time, format, abbreviation: shown.abbreviation, empty };
  const nightText = "text-[#c98a5a]";

  let content: ReactNode;
  if (arrangement === "side")
    content = (
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-[5vw] py-[7vh] pr-[max(env(safe-area-inset-right),6vw)] pl-[max(env(safe-area-inset-left),6vw)]">
        <div className={cn("flex h-full items-center border-r pr-[5vw]", night ? "border-[#c98a5a]/15" : "border-border")}>
          <Clock time={shown.time} seconds={shown.seconds} format={format} style={{ fontSize: seconds === null ? "min(26vh, 14vw)" : "min(20vh, 9.5vw)" }} className={night ? nightText : undefined} colon={night ? "text-[#c98a5a]/60" : undefined} />
        </div>
        <Verses
          {...verseProps}
          align="left"
          max={night ? 34 : 64}
          className="h-full"
          textClassName={night ? "text-[#c98a5a]/75" : undefined}
          referenceClassName={night ? "text-[#c98a5a]/50" : undefined}
        />
      </div>
    );
  else if (arrangement === "stacked")
    content = (
      <div className="flex h-full flex-col items-center px-[max(env(safe-area-inset-left),7vw)] pt-[max(env(safe-area-inset-top),9vh)] pb-[max(env(safe-area-inset-bottom),7vh)]">
        <Clock time={shown.time} seconds={shown.seconds} format={format} style={{ fontSize: seconds === null ? "min(24vw, 18vh)" : "min(16.5vw, 15vh)" }} className={night ? nightText : undefined} colon={night ? "text-[#c98a5a]/60" : undefined} />
        <div className={cn("my-[4vh] h-px w-16 shrink-0", night ? "bg-[#c98a5a]/20" : "bg-primary/40")} />
        <Verses
          {...verseProps}
          max={night ? 30 : 56}
          className="w-full max-w-3xl flex-1"
          textClassName={night ? "text-[#c98a5a]/75" : undefined}
          referenceClassName={night ? "text-[#c98a5a]/50" : undefined}
        />
      </div>
    );
  else
    content = (
      <div className="flex h-full flex-col px-[max(env(safe-area-inset-left),6vw)] pt-[max(env(safe-area-inset-top),8vh)] pb-[max(env(safe-area-inset-bottom),6vh)]">
        <Verses {...verseProps} align="left" max={120} className="flex-1 pb-[7vmin]" />
        <div className="pointer-events-none absolute right-[max(env(safe-area-inset-right),6vw)] bottom-[max(env(safe-area-inset-bottom),6vh)] text-muted-foreground">
          <Clock time={shown.time} seconds={shown.seconds} format={format} style={{ fontSize: "clamp(1.25rem, 4vmin, 2.25rem)" }} colon="text-primary/70" />
        </div>
      </div>
    );

  const position = (() => {
    if (picked.status !== "verse") return null;
    const first = picked.items[0]!.position + 1;
    const last = picked.items.at(-1)!.position + 1;
    // On a phone, "1/5", to leave room for the buttons
    if (picked.items.length === 1) return { long: `Verse ${first} of ${picked.of}`, short: `${first}/${picked.of}` };
    if (picked.items.length >= picked.of) return { long: `All ${picked.of} verses`, short: `All ${picked.of}` };
    // Past the last, they start again from the first
    return last > first
      ? { long: `Verses ${first}–${last} of ${picked.of}`, short: `${first}–${last}/${picked.of}` }
      : { long: `${picked.items.length} of ${picked.of} verses`, short: `${picked.items.length}/${picked.of}` };
  })();
  /** With only pinned verses: "pinned for 9:30, next at 4:12" */
  const pinnedFor = (() => {
    if (!onlyPinned || !source) return null;
    const from = source.hour === time.hour && source.minute === time.minute ? "pinned now" : `pinned for ${formatTime(source, format)}`;
    return nextPinned ? `${from}, next at ${formatTime(nextPinned, format)}` : from;
  })();
  const bar = cn("transition-opacity duration-500", idle.active ? "opacity-100" : "pointer-events-none opacity-0");
  const barButton = night ? "text-[#c98a5a] hover:bg-white/5 hover:text-[#e0a070]" : "";

  return (
    <div
      role="region"
      aria-label="One verse"
      className={cn("fixed inset-0 z-50 touch-pan-y select-none", night ? "bg-black" : "bg-background text-foreground", !idle.active && "cursor-none")}
      onPointerMove={(e) => e.pointerType === "mouse" && idle.poke()}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {content}

      {/* How long until the next verses, when they change partway through the minute */}
      {slot !== null && !viewing && (
        <div
          key={`${key}|${slot}`}
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left", night ? "bg-[#c98a5a]/25" : "bg-primary/35")}
          style={{ animation: `fill ${60 / perMinute}s linear both`, animationDelay: `-${tick! % (60 / perMinute)}s` }}
        />
      )}

      <div className={cn("absolute inset-x-0 top-0 flex items-center gap-1 px-[max(env(safe-area-inset-left),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]", bar)}>
        <Button variant="ghost" size="sm" className={cn(barButton, "max-sm:px-2")} onClick={onClose} title="Every verse at this time (Esc)" aria-label="Every verse at this time">
          <ListIcon /> <span className="hidden sm:inline">All</span>
        </Button>
        <div className={cn("flex-1 truncate text-center text-xs", night ? "text-[#c98a5a]/60" : "text-muted-foreground")}>
          {viewing ? (
            <button className="rounded-full px-2 py-1 hover:bg-current/5" onClick={() => setView(null)} title="Back to now">
              Seen {seenAt(viewing.shownAt)} · <span className={cn("font-semibold", night ? "text-[#e0a070]" : "text-primary")}>Now →</span>
            </button>
          ) : (
            <>
              {position && (
                <span className="tabular-nums">
                  <span className="sm:hidden">{position.short}</span>
                  <span className="hidden sm:inline">{position.long}</span>
                </span>
              )}
              {position && !live && <span className="hidden sm:inline"> · {formatTime(time, format)}</span>}
              {position && pinnedFor && <span className="hidden sm:inline"> · {pinnedFor}</span>}
            </>
          )}
        </div>
        {only && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(barButton, pinnedHere.length > 0 && !night && "text-primary")}
            onClick={() => (togglePin(), idle.poke())}
            aria-label={pinnedHere.length ? "Unpin" : `Always show at ${pinLabel}`}
            title={pinnedHere.length ? `Unpin ${only.reference}` : `Always show ${only.reference} at ${pinLabel}`}
          >
            {pinnedHere.length ? <PinOffIcon /> : <PinIcon />}
          </Button>
        )}
        {/* On a phone, swiping does these */}
        <Button variant="ghost" size="icon" className={cn(barButton, "hidden sm:inline-flex")} onClick={() => (back(), idle.poke())} aria-label="Back" title="Back (←)">
          <UndoIcon />
        </Button>
        {(more || viewing) && (
          <Button variant="ghost" size="icon" className={cn(barButton, "hidden sm:inline-flex")} onClick={() => (forward(), idle.poke())} aria-label="Another verse" title="Another verse (→ or Space)">
            <ShuffleIcon />
          </Button>
        )}
        <DropdownMenu onOpenChange={(open) => open && idle.poke()}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={barButton} aria-label="Layout and verses at once" title="Layout, verses at once, and seconds (L cycles layouts)">
              <LayoutTemplateIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="text-sm font-medium">Verses at once</span>
              <Stepper label="Verses at once" value={count} min={1} max={MAX_AT_ONCE} onChange={(displayCount) => update({ displayCount })} />
            </div>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium">Per minute</span>
                <span className="block text-xs text-muted-foreground">Each for {slotLength(perMinute)}</span>
              </span>
              <Stepper label="Verses per minute" value={perMinute} values={PER_MINUTE} onChange={(perMinute) => update({ perMinute })} />
            </div>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="text-sm font-medium">Seconds</span>
              <Switch checked={showSeconds} onCheckedChange={(showSeconds) => update({ showSeconds })} aria-label="Show seconds" />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            {LAYOUTS.map((l) => (
              <DropdownMenuItem key={l.value} onSelect={() => update({ displayLayout: l.value })} className="items-start py-2">
                <l.icon className="mt-0.5" />
                <span className="flex-1">
                  <span className="block font-medium">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.description}</span>
                </span>
                {l.value === layout && <CheckIcon className="mt-0.5 !text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={customizing !== null} onOpenChange={(open) => (setCustomizing(open ? "pins" : null), idle.poke())}>
          <Button variant="ghost" size="icon" className={barButton} onClick={() => setCustomizing("history")} aria-label="History" title="Verses shown before">
            <HistoryIcon />
          </Button>
          <Button variant="ghost" size="icon" className={barButton} onClick={() => setCustomizing("pins")} aria-label="Pinned verses and book priorities" title="Pinned verses and book priorities">
            <SlidersHorizontalIcon />
          </Button>
          {customizing && <CustomizeDialog tab={customizing} />}
        </Dialog>
        <Dialog open={translationsOpen} onOpenChange={(open) => (setTranslationsOpen(open), idle.poke())}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(barButton, "px-2 font-semibold")}
            onClick={() => setTranslationsOpen(true)}
            aria-label={`Translation: ${translation.name}`}
            title={`${translation.name} (T to change)`}
          >
            {translation.abbreviation}
          </Button>
          {translationsOpen && <TranslationDialog onDone={() => (setTranslationsOpen(false), idle.poke())} />}
        </Dialog>
        <Dialog open={settingsOpen} onOpenChange={(open) => (setSettingsOpen(open), idle.poke())}>
          <Button variant="ghost" size="icon" className={barButton} onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
            <SettingsIcon />
          </Button>
          {settingsOpen && <SettingsDialog />}
        </Dialog>
        {fullscreen.supported && (
          <Button
            variant="ghost"
            size="icon"
            className={barButton}
            onClick={() => fullscreen.toggle(arrangement === "side")}
            aria-label={fullscreen.on ? "Exit full screen" : "Full screen"}
            title={fullscreen.on ? "Exit full screen (F)" : "Full screen (F)"}
          >
            {fullscreen.on ? <MinimizeIcon /> : <MaximizeIcon />}
          </Button>
        )}
      </div>

      <p
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-[11px]",
          night ? "text-[#c98a5a]/40" : "text-muted-foreground/70",
          bar,
        )}
      >
        {matchMedia("(pointer: coarse)").matches ? "Swipe left for another verse, right to go back · tap to hide this" : "→ for another verse, ← to go back · + − for how many · L for layout · T for translation · F for full screen"}
      </p>
      <span className="sr-only" aria-live="polite">
        {shown.picked.status === "verse" ? shown.picked.items.map((it) => it.reference).join("; ") : ""}
      </span>
    </div>
  );
}
