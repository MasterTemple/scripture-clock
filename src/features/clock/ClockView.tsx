import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, PinIcon, PinOffIcon, RefreshCwIcon, SkipForwardIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { bookById, formatPrinted, formatRef, passageVerses } from "@/bible/topos";
import { pinsAt, priorityOf } from "@/clock/choose";
import { verseKey, type Translation, type VerseRef, type VerseText } from "@/bible/types";
import { addMinutes, formatTime, nextWithVerses, shownHour, versesForTime, type ClockTime, type Group } from "@/clock/times";
import { prefetch, useVerseTexts } from "@/clock/useVerses";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp, useTranslation } from "@/state/store";

const pad = (n: number) => String(n).padStart(2, "0");

function ClockFace({ time, seconds, live }: { time: ClockTime; seconds: number | null; live: boolean }) {
  const format = useApp((s) => s.settings.hourFormat);
  const separator = <span className={cn("mx-[0.02em] text-primary", live && "animate-[blink_2s_ease-in-out_infinite]")}>:</span>;
  return (
    <div className="flex items-baseline justify-center gap-2 font-serif tabular-nums" aria-live="off">
      <span
        className={cn("leading-none font-semibold tracking-tight", seconds === null ? "text-[clamp(4.5rem,22vw,9rem)]" : "text-[clamp(3.5rem,15.5vw,7.5rem)]")}
      >
        {shownHour(time, format)}
        {separator}
        {pad(time.minute)}
        {seconds !== null && (
          <>
            {separator}
            {pad(seconds)}
          </>
        )}
      </span>
      {format === "12h" && <span className="font-sans text-base font-medium text-muted-foreground sm:text-lg">{time.hour < 12 ? "AM" : "PM"}</span>}
    </div>
  );
}

function TimeControls({ time, live, onPin }: { time: ClockTime; live: boolean; onPin: (t: ClockTime | null) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="ghost" size="icon" aria-label="A minute earlier" title="A minute earlier (←)" onClick={() => onPin(addMinutes(time, -1))}>
        <ChevronLeftIcon />
      </Button>
      <input
        type="time"
        aria-label="Choose a time"
        value={`${pad(time.hour)}:${pad(time.minute)}`}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          if (h !== undefined && m !== undefined && !Number.isNaN(h) && !Number.isNaN(m)) onPin({ hour: h, minute: m });
        }}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
      <Button variant="ghost" size="icon" aria-label="A minute later" title="A minute later (→)" onClick={() => onPin(addMinutes(time, 1))}>
        <ChevronRightIcon />
      </Button>
      {live ? (
        <span className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-success-soft px-3 text-xs font-semibold text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
        </span>
      ) : (
        <Button variant="secondary" size="sm" className="ml-1 rounded-full" title="Back to now (Esc)" onClick={() => onPin(null)}>
          Now
        </Button>
      )}
    </div>
  );
}

/** One verse or passage; `text` is missing while it loads */
function VerseCard({
  title,
  text,
  translation,
  pinned,
  onTogglePin,
  pinLabel,
}: {
  title: string;
  text: string | undefined;
  translation: Translation;
  pinned: boolean;
  onTogglePin: () => void;
  pinLabel: string;
}) {
  if (text === undefined)
    return (
      <li className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-3 text-sm font-semibold text-muted-foreground">{title}</div>
        <div className="space-y-2" aria-label="Loading">
          <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
        </div>
      </li>
    );
  const copy = () =>
    navigator.clipboard.writeText(`${text}\n— ${title} (${translation.abbreviation})`).then(
      () => toast.success(`Copied ${title}`),
      () => toast.error("Couldn't copy"),
    );
  const action = "-my-1 rounded-md p-1.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100";
  return (
    <li className={cn("group animate-fade-up rounded-xl border bg-card p-4 shadow-xs sm:p-5", pinned && "border-primary/30")}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          {pinned && <PinIcon className="size-3.5 -rotate-12" aria-label="Pinned" />}
          {title}
        </h3>
        <div className="flex items-center">
          <button onClick={onTogglePin} aria-label={pinLabel} title={pinLabel} className={cn(action, pinned && "text-primary opacity-100")}>
            {pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
          </button>
          <button onClick={copy} aria-label={`Copy ${title}`} title="Copy" className={action}>
            <CopyIcon className="size-4" />
          </button>
        </div>
      </div>
      <p className="font-serif text-[17px] leading-relaxed text-pretty">{text}</p>
    </li>
  );
}

/** A passage's text: its verses' texts, verses printed together once; `null` if the translation has none */
function passageText(verses: VerseRef[], texts: Map<string, VerseText | null>): string | null | undefined {
  const parts: VerseText[] = [];
  for (const v of verses) {
    const t = texts.get(verseKey(v));
    if (t === undefined) return undefined;
    if (t && parts.at(-1)?.text !== t.text) parts.push(t);
  }
  return parts.length ? parts.map((p) => p.text).join(" ") : null;
}

interface Pinning {
  /** Whether this single verse is pinned at the time */
  isPinned: (v: VerseRef) => boolean;
  toggle: (v: VerseRef) => void;
  label: string;
}

function GroupSection({ group, texts, translation, pinning }: { group: Group; texts: Map<string, VerseText | null>; translation: Translation; pinning: Pinning }) {
  const shown = group.verses.filter((v) => texts.get(verseKey(v)) !== null);
  const missing = group.verses.filter((v) => texts.get(verseKey(v)) === null);
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 px-1">
        <h2 className="font-serif text-2xl font-semibold tabular-nums">
          {group.hourOnly ? group.verse : `${group.chapter}:${group.verse}`}
        </h2>
        <span className="text-sm text-muted-foreground">
          {group.exact ? "the hour and minute" : group.hourOnly ? "the hour, in books of one chapter" : "the digits read another way"} · {shown.length} {shown.length === 1 ? "verse" : "verses"}
        </span>
      </div>
      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((v) => (
            <VerseCard
              key={verseKey(v)}
              title={texts.get(verseKey(v)) ? formatPrinted(v, texts.get(verseKey(v))!) : formatRef(v)}
              text={texts.get(verseKey(v))?.text}
              translation={translation}
              pinned={pinning.isPinned(v)}
              onTogglePin={() => pinning.toggle(v)}
              pinLabel={pinning.isPinned(v) ? `Unpin from ${pinning.label}` : `Always show at ${pinning.label}`}
            />
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Not in {translation.abbreviation}: {missing.map((v) => formatRef(v)).join(", ")}
        </p>
      )}
    </section>
  );
}

export function ClockView({ time, seconds, live, onPin }: { time: ClockTime; seconds: number | null; live: boolean; onPin: (t: ClockTime | null) => void }) {
  const translation = useTranslation();
  const format = useApp((s) => s.settings.hourFormat);
  const others = useApp((s) => s.settings.otherReadings);
  const priorities = useApp((s) => s.priorities);
  const pins = useApp((s) => s.pins);
  const addPins = useApp((s) => s.addPins);
  const removePin = useApp((s) => s.removePin);
  const minuteKey = `${format}|${others}|${time.hour}:${time.minute}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGroups = useMemo(() => versesForTime(time, format, others), [minuteKey]);
  // Books set to Never are left out
  const groups = useMemo(
    () => allGroups.map((g) => ({ ...g, verses: g.verses.filter((v) => priorityOf(priorities, v.bookId) > 0) })).filter((g) => g.verses.length),
    [allGroups, priorities],
  );
  const hidden = allGroups.reduce((n, g) => n + g.verses.length, 0) - groups.reduce((n, g) => n + g.verses.length, 0);
  const pinned = useMemo(
    () => pinsAt(pins, time, format).flatMap((pin) => {
      const verses = passageVerses(pin.reference);
      return verses?.length ? [{ pin, verses }] : [];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pins, minuteKey],
  );
  const verses = useMemo(() => [...pinned.flatMap((p) => p.verses), ...groups.flatMap((g) => g.verses)], [pinned, groups]);

  const clockLabel = `${shownHour(time, format)}:${String(time.minute).padStart(2, "0")}`;
  const singlePinsFor = (v: VerseRef) => pinned.filter((p) => p.verses.length === 1 && verseKey(p.verses[0]!) === verseKey(v)).map((p) => p.pin);
  const pinning: Pinning = {
    isPinned: (v) => singlePinsFor(v).length > 0,
    toggle: (v) => {
      const existing = singlePinsFor(v);
      if (existing.length) for (const p of existing) removePin(p.id);
      else addPins([{ hour: shownHour(time, format), minute: time.minute, reference: formatRef(v) }]);
    },
    label: clockLabel,
  };
  const { texts, errors, loading, retry } = useVerseTexts(translation, verses);
  const nothing = groups.length === 0 && pinned.length === 0;
  const next = useMemo(() => (nothing ? nextWithVerses(time, format, others) : null), [nothing, minuteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ready for the next minute before it comes
  useEffect(() => {
    if (!live || loading) return;
    prefetch(translation, versesForTime(addMinutes(time, 1), format, others).flatMap((g) => g.verses));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, loading, translation, minuteKey]);

  // ← and → step through the minutes; Esc comes back to now
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") onPin(addMinutes(time, e.shiftKey ? -60 : -1));
      else if (e.key === "ArrowRight") onPin(addMinutes(time, e.shiftKey ? 60 : 1));
      else if (e.key === "Escape" && !live) onPin(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [time, live, onPin]);

  const shownCount = verses.filter((v) => texts.get(verseKey(v)) !== null).length;
  const failedBooks = [...errors.keys()].map((id) => bookById(id).name);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <div className="space-y-5 pt-8 pb-8 sm:pt-12">
        <ClockFace time={time} seconds={seconds} live={live} />
        <TimeControls time={time} live={live} onPin={onPin} />
        {!nothing && (
          <p className="text-center text-sm text-muted-foreground">
            {loading ? "Finding" : shownCount}{" "}
            {loading ? "verses" : shownCount === 1 ? "verse" : "verses"} at {formatTime(time, format)} in {translation.abbreviation}
          </p>
        )}
      </div>

      {failedBooks.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">
          <span>
            Couldn't download {failedBooks.slice(0, 4).join(", ")}
            {failedBooks.length > 4 ? ` and ${failedBooks.length - 4} more` : ""}. Are you offline?
          </span>
          <Button size="sm" variant="outline" onClick={retry}>
            <RefreshCwIcon /> Retry
          </Button>
        </div>
      )}

      <div key={minuteKey} className="space-y-10">
        {pinned.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline gap-3 px-1">
              <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
                <PinIcon className="size-5 -rotate-12 text-primary" /> Pinned
              </h2>
              <span className="text-sm text-muted-foreground">shown first at {clockLabel}</span>
            </div>
            <ul className="space-y-3">
              {pinned.map(({ pin, verses }) => {
                const text = passageText(verses, texts);
                if (text === null)
                  return (
                    <li key={pin.id} className="px-1 text-xs text-muted-foreground">
                      Not in {translation.abbreviation}: {pin.reference}
                    </li>
                  );
                return (
                  <VerseCard
                    key={pin.id}
                    title={verses.length === 1 && texts.get(verseKey(verses[0]!)) ? formatPrinted(verses[0]!, texts.get(verseKey(verses[0]!))!) : pin.reference}
                    text={text}
                    translation={translation}
                    pinned
                    onTogglePin={() => removePin(pin.id)}
                    pinLabel={`Unpin from ${clockLabel}`}
                  />
                );
              })}
            </ul>
          </section>
        )}
        {groups.map((g) => (
          <GroupSection key={`${g.chapter}:${g.verse}`} group={g} texts={texts} translation={translation} pinning={pinning} />
        ))}
      </div>

      {hidden > 0 && (
        <p className="mt-8 px-1 text-center text-xs text-muted-foreground">
          {hidden} {hidden === 1 ? "verse is" : "verses are"} hidden: {hidden === 1 ? "its book is" : "their books are"} set to Never.
        </p>
      )}

      {nothing && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="font-serif text-lg">No verse at {formatTime(time, format)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {allGroups.length > 0
              ? "Every verse at this time is in a book set to Never."
              : shownHour(time, format) === 0
                ? "There's no chapter 0."
                : time.minute === 0
                  ? "There's no verse 0."
                  : "No chapter has that many verses."}
          </p>
          {next && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => onPin(next)}>
              <SkipForwardIcon /> Next verses at {formatTime(next, format)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
