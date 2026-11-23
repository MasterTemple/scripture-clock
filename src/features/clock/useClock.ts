import { useEffect, useState } from "react";
import { parseTime, timeParam, type ClockTime } from "@/clock/times";
import { useApp } from "@/state/store";

/** The time now, updated every second, or only as each minute turns */
export function useNow(everySecond: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = () => {
      const date = new Date();
      setNow(date);
      const wait = everySecond ? 1000 - date.getMilliseconds() : 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());
      timer = window.setTimeout(tick, wait + 5);
    };
    tick();
    // A phone's timers sleep with it: catch up when it wakes
    const wake = () => document.visibilityState === "visible" && (clearTimeout(timer), tick());
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [everySecond]);
  return now;
}

const fromHash = () => parseTime(decodeURIComponent(location.hash.slice(1)));

/** A time chosen to look at instead of now, kept in the URL (`#17:48`) so it can be shared */
export function usePinnedTime(): [ClockTime | null, (t: ClockTime | null) => void] {
  const [pinned, setPinned] = useState<ClockTime | null>(fromHash);
  useEffect(() => {
    const read = () => setPinned(fromHash());
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const pin = (t: ClockTime | null) => {
    setPinned(t);
    const url = t ? `#${timeParam(t)}` : location.pathname + location.search;
    history.replaceState(null, "", url);
  };
  return [pinned, pin];
}

/** Keeps the screen on while asked to and the page is showing */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (released) l.release();
          else lock = l;
        },
        () => {},
      );
    };
    request();
    // The lock is let go when the page is hidden; take it again on return
    document.addEventListener("visibilitychange", request);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [on]);
}

/**
 * Whether the one-verse display is open: as last left (the display, at first), unless the URL
 * asks for one (`?display`, as the app's shortcut does, or `?list`).
 */
export function useDisplayOpen(): [boolean, (open: boolean) => void] {
  const view = useApp((s) => s.settings.view);
  const update = useApp((s) => s.updateSettings);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const asked = params.has("display") ? "display" : params.has("list") ? "list" : null;
    if (!asked) return;
    update({ view: asked });
    params.delete("display");
    params.delete("list");
    const search = params.toString();
    history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
  }, [update]);
  const set = (open: boolean) => {
    update({ view: open ? "display" : "list" });
    if (!open && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  return [view === "display", set];
}
