import { ChevronDownIcon, HistoryIcon, MonitorIcon, SettingsIcon, SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/overlays";
import { Tip, TooltipProvider } from "@/components/ui/primitives";
import { ClockView } from "@/features/clock/ClockView";
import { useDisplayOpen, useNow, usePinnedTime, useWakeLock } from "@/features/clock/useClock";
import { DisplayView } from "@/features/display/DisplayView";
import { CustomizeDialog, type CustomizeTab } from "@/features/customize/CustomizeDialog";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { TranslationDialog } from "@/features/translations/TranslationDialog";
import { useApp, useTranslation } from "@/state/store";

function useTheme() {
  const theme = useApp((s) => s.settings.theme);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = dark ? "#111114" : "#f7f5f1";
      document.head.append(meta);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <circle cx="16" cy="16" r="9.5" className="stroke-primary-foreground" strokeWidth="2.4" fill="none" />
        <path d="M16 10.5V16l3.6 2.6" className="stroke-primary-foreground" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="font-serif text-lg font-semibold tracking-tight">Scripture Clock</span>
    </div>
  );
}

export default function App() {
  useTheme();
  const translation = useTranslation();
  const showSeconds = useApp((s) => s.settings.showSeconds);
  const keepAwake = useApp((s) => s.settings.keepAwake);
  const [pinned, pin] = usePinnedTime();
  const perMinute = useApp((s) => s.settings.perMinute);
  const [displayOpen, setDisplayOpen] = useDisplayOpen();
  // Every second for the seconds, or for the display to move on partway through a minute
  const now = useNow(!pinned && (showSeconds || (displayOpen && perMinute > 1)));
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const [customizing, setCustomizing] = useState<CustomizeTab | null>(null);
  // A clock on display shouldn't go dark
  useWakeLock(keepAwake || displayOpen);

  const time = pinned ?? { hour: now.getHours(), minute: now.getMinutes() };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-4">
            <Logo />
            <div className="flex-1" />
            <Tip content="One verse at a time, full screen">
              <Button variant="ghost" size="sm" onClick={() => setDisplayOpen(true)}>
                <MonitorIcon /> <span className="hidden sm:inline">One verse</span>
              </Button>
            </Tip>
            <Dialog open={customizing !== null} onOpenChange={(open) => setCustomizing(open ? "pins" : null)}>
              <Tip content="Verses shown before">
                <Button variant="ghost" size="icon" aria-label="History" onClick={() => setCustomizing("history")}>
                  <HistoryIcon />
                </Button>
              </Tip>
              <Tip content="Pinned verses and book priorities">
                <Button variant="ghost" size="icon" aria-label="Pinned verses and book priorities" onClick={() => setCustomizing("pins")}>
                  <SlidersHorizontalIcon />
                </Button>
              </Tip>
              {customizing && <CustomizeDialog tab={customizing} />}
            </Dialog>
            <Dialog open={translationsOpen} onOpenChange={setTranslationsOpen}>
              <Tip content={translation.name}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 font-semibold">
                    {translation.abbreviation}
                    <ChevronDownIcon className="text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </Tip>
              {translationsOpen && <TranslationDialog onDone={() => setTranslationsOpen(false)} />}
            </Dialog>
            <Dialog>
              <Tip content="Settings">
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Settings">
                    <SettingsIcon />
                  </Button>
                </DialogTrigger>
              </Tip>
              <SettingsDialog />
            </Dialog>
          </div>
        </header>

        <main className="flex-1">
          {!displayOpen && <ClockView time={time} seconds={showSeconds && !pinned ? now.getSeconds() : null} live={!pinned} onPin={pin} />}
        </main>

        <footer className="border-t px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground">
          <p>
            {translation.name}
            {translation.attribution && (
              <>
                {" · "}
                {translation.attributionUrl ? (
                  <a href={translation.attributionUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    {translation.attribution}
                  </a>
                ) : (
                  translation.attribution
                )}
              </>
            )}
          </p>
          <p className="mt-1">
            Bibles from{" "}
            <a href="https://fetch.bible" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
              fetch.bible
            </a>
            , read with{" "}
            <a href="https://github.com/Logoxide/logoxide" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
              logoxide
            </a>{" "}
            and{" "}
            <a href="https://github.com/MasterTemple/topos-bible" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
              topos
            </a>
          </p>
        </footer>
      </div>
      {displayOpen && <DisplayView
          time={time}
          seconds={showSeconds && !pinned ? now.getSeconds() : null}
          tick={pinned ? null : now.getSeconds()}
          live={!pinned} onClose={() => setDisplayOpen(false)} />}
      <Toaster position="bottom-center" richColors closeButton />
    </TooltipProvider>
  );
}
