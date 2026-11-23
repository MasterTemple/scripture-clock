import { useLayoutEffect, useRef } from "react";

/**
 * Sizes `text`'s font as large as fits inside `box` (between `min` and `max` px), again
 * whenever the box resizes, the fonts finish loading, or `content` changes.
 */
export function useFitText<Box extends HTMLElement = HTMLDivElement, Text extends HTMLElement = HTMLParagraphElement>(
  content: unknown,
  { min = 12, max = 96 }: { min?: number; max?: number } = {},
) {
  const box = useRef<Box>(null);
  const text = useRef<Text>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const t = text.current;
      if (!b || !t) return;
      const fits = (size: number) => {
        t.style.fontSize = `${size}px`;
        return t.offsetHeight <= b.clientHeight && t.scrollWidth <= b.clientWidth;
      };
      let lo = min;
      let hi = max;
      if (fits(hi)) return;
      for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      t.style.fontSize = `${lo}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (box.current) observer.observe(box.current);
    let alive = true;
    document.fonts?.ready.then(() => alive && fit());
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [content, min, max]);

  return { box, text };
}
