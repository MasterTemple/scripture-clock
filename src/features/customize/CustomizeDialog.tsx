import { BookMarkedIcon, ChevronRightIcon, HistoryIcon, PinIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { bookById, findPassages } from "@/bible/topos";
import { BOOK_GROUPS, PRIORITY_LABELS, pinTime, priorityOf, type Priority } from "@/clock/choose";
import { parseTime } from "@/clock/times";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/overlays";
import { HistoryList } from "./HistoryList";
import { Input, Label } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/store";

export type CustomizeTab = "pins" | "books" | "history";

export function CustomizeDialog({ tab: initial = "pins" }: { tab?: CustomizeTab }) {
  const [tab, setTab] = useState<CustomizeTab>(initial);
  return (
    <DialogContent title="Your verses" description="Pin verses to times, choose which books come up most, and look back at what's been shown." className="max-w-xl">
      <div className="sticky top-0 z-10 border-b bg-popover px-5 py-3">
        <Segmented<CustomizeTab>
          value={tab}
          onChange={setTab}
          className="w-full"
          options={[
            { value: "pins", label: <><PinIcon /> Pinned</> },
            { value: "books", label: <><BookMarkedIcon /> Books</> },
            { value: "history", label: <><HistoryIcon /> History</> },
          ]}
        />
      </div>
      {tab === "pins" ? <Pins /> : tab === "books" ? <Books /> : <HistoryList />}
    </DialogContent>
  );
}

/** The time a reference reads as, when it can be one: Hebrews 4:12 is 4:12 */
function timeOf(verses: { chapter: number; verse: number }[]) {
  const first = verses[0];
  if (!first || first.chapter > 23 || first.verse > 59) return null;
  return { hour: first.chapter, minute: first.verse };
}

function Pins() {
  const pins = useApp((s) => s.pins);
  const addPins = useApp((s) => s.addPins);
  const removePin = useApp((s) => s.removePin);
  const format = useApp((s) => s.settings.hourFormat);
  const [reference, setReference] = useState("");
  const [timeText, setTimeText] = useState("");

  const passages = useMemo(() => (reference.trim() ? findPassages(reference) : []), [reference]);
  const suggested = passages[0] ? timeOf(passages[0].verses) : null;
  const time = timeText.trim() ? parseTime(timeText) : suggested;
  const badTime = timeText.trim() !== "" && !time;

  const add = () => {
    if (!passages.length || !time) return;
    addPins(passages.map((p) => ({ ...time, reference: p.reference })));
    toast.success(`Pinned to ${pinTime({ ...time, id: "", reference: "" })}`, { description: passages.map((p) => p.reference).join(", ") });
    setReference("");
    setTimeText("");
  };

  const byTime = useMemo(() => {
    const groups = new Map<string, typeof pins>();
    for (const p of [...pins].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))) {
      const key = pinTime(p);
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups];
  }, [pins]);

  return (
    <div className="space-y-5 px-5 py-4">
      <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), add())}>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pin-reference">Verses</Label>
            <Input id="pin-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Heb 4:12; Prov 4:12" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin-time">At</Label>
            <Input
              id="pin-time"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              placeholder={suggested ? `${suggested.hour}:${String(suggested.minute).padStart(2, "0")}` : "4:12"}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={badTime}
              className={cn(badTime && "border-destructive")}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">
            {reference.trim() && !passages.length
              ? "No reference found yet."
              : passages.length
                ? `${passages.map((p) => p.reference).join(", ")}${time ? ` at ${pinTime({ ...time, id: "", reference: "" })}` : ", at what time?"}`
                : "Several verses at one time take turns. A passage shows whole."}
          </p>
          <Button type="submit" size="sm" disabled={!passages.length || !time}>
            <PlusIcon /> Pin
          </Button>
        </div>
      </form>

      {byTime.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {byTime.map(([time, group]) => (
            <li key={time} className="flex gap-4 px-3 py-2.5">
              <span className="w-12 shrink-0 pt-1 font-serif text-base font-semibold tabular-nums">{time}</span>
              <ul className="min-w-0 flex-1 space-y-0.5">
                {group.map((p) => (
                  <li key={p.id} className="group flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{p.reference}</span>
                    <Button size="icon-sm" variant="ghost" className="opacity-60 group-hover:opacity-100" aria-label={`Unpin ${p.reference}`} onClick={() => removePin(p.id)}>
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing pinned yet. You can also pin a verse with <PinIcon className="inline size-3.5 align-[-2px]" /> as it shows.
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        A pinned verse shows first at its time in the one-verse display, and at the top of the list.
        {format === "12h" ? " On a 12-hour clock, 4:12 is both morning and evening; write 16:12 for the evening only." : " Times are on a 24-hour clock."}
      </p>
    </div>
  );
}

function PrioritySelect({ value, onChange, label, mixed }: { value: Priority; onChange: (p: Priority) => void; label: string; mixed?: boolean }) {
  return (
    <select
      aria-label={`How often ${label} comes up`}
      value={mixed ? "" : value}
      onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value) as Priority)}
      className={cn(
        "h-8 shrink-0 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        value === 0 && !mixed && "text-muted-foreground line-through",
        value > 2 && !mixed && "font-semibold text-primary",
      )}
    >
      {mixed && <option value="">Mixed</option>}
      {PRIORITY_LABELS.map((l, i) => (
        <option key={l} value={i}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Books() {
  const priorities = useApp((s) => s.priorities);
  const setPriority = useApp((s) => s.setPriority);
  const reset = useApp((s) => s.resetPriorities);
  const [open, setOpen] = useState<string | null>(null);

  const shared = (books: number[]) => {
    const values = new Set(books.map((b) => priorityOf(priorities, b)));
    return values.size === 1 ? { value: [...values][0]!, mixed: false } : { value: 2 as Priority, mixed: true };
  };

  const testaments = ["Old Testament", "New Testament"] as const;
  return (
    <div className="space-y-5 px-5 py-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        How often the one-verse display picks from each book. Each step up is about three times as likely; <strong>Never</strong> also hides the book from the list. Pinned verses always show.
      </p>
      {testaments.map((testament) => {
        const groups = BOOK_GROUPS.filter((g) => g.testament === testament);
        const all = groups.flatMap((g) => g.books);
        const t = shared(all);
        return (
          <section key={testament} className="space-y-1">
            <div className="flex items-center justify-between gap-3 pb-1">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{testament}</h3>
              <PrioritySelect label={`the ${testament}`} value={t.value} mixed={t.mixed} onChange={(p) => setPriority(all, p)} />
            </div>
            <ul className="divide-y rounded-lg border">
              {groups.map((g) => {
                const s = shared(g.books);
                const expanded = open === g.name;
                return (
                  <li key={g.name}>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <button className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-sm font-medium hover:bg-muted" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : g.name)}>
                        <ChevronRightIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                        <span className="truncate">{g.name}</span>
                        <span className="shrink-0 text-xs font-normal text-muted-foreground">{g.books.length}</span>
                      </button>
                      <PrioritySelect label={g.name} value={s.value} mixed={s.mixed} onChange={(p) => setPriority(g.books, p)} />
                    </div>
                    {expanded && (
                      <ul className="border-t bg-muted/40 py-1">
                        {g.books.map((id) => (
                          <li key={id} className="flex items-center justify-between gap-2 py-1 pr-2 pl-9">
                            <span className="truncate text-sm">{bookById(id).name}</span>
                            <PrioritySelect label={bookById(id).name} value={priorityOf(priorities, id)} onChange={(p) => setPriority([id], p)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={reset} disabled={Object.keys(priorities).length === 0}>
          <RotateCcwIcon /> All books Normal
        </Button>
      </div>
    </div>
  );
}
