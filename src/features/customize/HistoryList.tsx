import { CopyIcon, PinIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { filterHistory, highlightTerms, type Period, type SeenRow } from "@/clock/historySearch";
import { timeLabels } from "@/clock/times";
import { Reference } from "@/components/Reference";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { useHistory } from "@/state/history";
import { useApp } from "@/state/store";

const PAGE = 100;

/** "Today", "Yesterday", or the date */
function dayLabel(at: number, now = Date.now()): string {
  const day = (t: number) => new Date(new Date(t).toDateString()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: new Date(at).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" });
}

/** The text with the searched words marked */
function Highlighted({ text, terms }: { text: string; terms: string[] }): ReactNode {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded-sm bg-warning/30 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function Row({ row, terms }: { row: SeenRow; terms: string[] }) {
  const [open, setOpen] = useState(false);
  const addPins = useApp((s) => s.addPins);
  const format = useApp((s) => s.settings.hourFormat);
  const ignoreZeros = useApp((s) => s.settings.ignoreZeros);
  const { screen, item } = row;
  const hour = format === "12h" ? screen.hour % 12 || 12 : screen.hour;
  const clock = `${hour}:${String(screen.minute).padStart(2, "0")}`;
  const seen = new Date(screen.shownAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <li>
      <button className="flex w-full gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="w-11 shrink-0 pt-0.5 font-serif text-sm font-semibold tabular-nums" title={`Shown at ${seen}`}>
          {clock}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            {item.pinned && <PinIcon className="size-3 shrink-0 -rotate-12" aria-label="Pinned" />}
            <span className="truncate">
              <Reference reference={item.reference} labels={timeLabels(screen, format, { ignoreZeros })} />
            </span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{screen.abbreviation}</span>
          </span>
          <span className={cn("mt-0.5 block font-serif text-[15px] leading-snug text-foreground/85", !open && "line-clamp-2")}>
            <Highlighted text={item.text} terms={terms} />
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-1 pb-2 pl-15">
          <span className="mr-auto text-xs text-muted-foreground">Shown {seen}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              navigator.clipboard.writeText(`${item.text}\n— ${item.reference} (${screen.abbreviation})`).then(
                () => toast.success(`Copied ${item.reference}`),
                () => toast.error("Couldn't copy"),
              )
            }
          >
            <CopyIcon /> Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              addPins([{ hour, minute: screen.minute, reference: item.reference.replace(/–/g, "-") }]);
              toast.success(`Pinned ${item.reference} to ${clock}`);
            }}
          >
            <PinIcon /> Pin to {clock}
          </Button>
        </div>
      )}
    </li>
  );
}

export function HistoryList() {
  const screens = useHistory((s) => s.screens);
  const keep = useHistory((s) => s.keep);
  const setKeep = useHistory((s) => s.setKeep);
  const clear = useHistory((s) => s.clear);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [translationId, setTranslationId] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [confirming, setConfirming] = useState(false);
  const search = useDeferredValue(query);

  const translations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of screens) if (!seen.has(s.translationId)) seen.set(s.translationId, s.abbreviation);
    return [...seen];
  }, [screens]);

  const rows = useMemo(() => filterHistory(screens, { query: search, period, translationId, pinnedOnly }), [screens, search, period, translationId, pinnedOnly]);
  const terms = useMemo(() => highlightTerms(search), [search]);
  const filtering = search.trim() !== "" || period !== "all" || translationId !== null || pinnedOnly;

  // Grouped by the day they were shown
  const days = useMemo(() => {
    const out: { label: string; rows: SeenRow[] }[] = [];
    for (const row of rows.slice(0, shown)) {
      const label = dayLabel(row.screen.shownAt);
      if (out.at(-1)?.label === label) out.at(-1)!.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [rows, shown]);

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="space-y-2.5">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => (setQuery(e.target.value), setShown(PAGE))}
            placeholder="Search: words, a book (rom), or a reference (Ps 23)"
            className="pr-9 pl-9"
            aria-label="Search the history"
          />
          {query && (
            <button className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear the search" onClick={() => setQuery("")}>
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Period>
            size="sm"
            value={period}
            onChange={(p) => (setPeriod(p), setShown(PAGE))}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "7 days" },
              { value: "month", label: "30 days" },
              { value: "all", label: "All" },
            ]}
          />
          {translations.length > 1 && (
            <select
              aria-label="Translation"
              value={translationId ?? ""}
              onChange={(e) => setTranslationId(e.target.value || null)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <option value="">All translations</option>
              {translations.map(([id, abbreviation]) => (
                <option key={id} value={id}>
                  {abbreviation}
                </option>
              ))}
            </select>
          )}
          <button
            aria-pressed={pinnedOnly}
            onClick={() => setPinnedOnly(!pinnedOnly)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              pinnedOnly ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <PinIcon className="size-3.5" /> Pinned
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {screens.length === 0
            ? "Nothing yet."
            : filtering
              ? `${rows.length} of ${screens.reduce((n, s) => n + s.items.length, 0)} verses`
              : `${rows.length} ${rows.length === 1 ? "verse" : "verses"} shown`}
        </p>
      </div>

      {days.length > 0 ? (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.label}>
              <h3 className="sticky top-[3.6rem] z-[1] -mx-1 mb-1 bg-popover/95 px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                {day.label}
              </h3>
              <ul className="-mx-2">
                {day.rows.map((row) => (
                  <Row key={row.key} row={row} terms={terms} />
                ))}
              </ul>
            </section>
          ))}
          {rows.length > shown && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({rows.length - shown} left)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {screens.length === 0 ? "Verses the one-verse display shows will be listed here." : "No verses match."}
        </p>
      )}

      <div className="space-y-3 border-t pt-4">
        <label className="flex items-center justify-between gap-4">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Keep history</span>
            <span className="block text-xs text-muted-foreground">On this device only. Off, it's forgotten when the page closes.</span>
          </span>
          <Switch checked={keep} onCheckedChange={setKeep} />
        </label>
        <div className="flex justify-end">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Delete all {screens.length} screens? This can't be undone.</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  clear();
                  setConfirming(false);
                  toast.success("History cleared");
                }}
              >
                Delete
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" disabled={screens.length === 0} onClick={() => setConfirming(true)}>
              <Trash2Icon /> Clear history
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
