import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Where the blink starts: on an even second of the wall clock, so every colon dims together */
const origin = -(performance.timeOrigin % 2000);

/**
 * A colon that blinks along with every other one on the page. A CSS animation starts when its
 * element appears, so a colon drawn later (the seconds', or a new verse's reference) would blink
 * out of step; this puts each on the same schedule.
 */
export function Colon({ blink = true, className }: { blink?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    for (const animation of ref.current?.getAnimations() ?? []) animation.startTime = origin;
  });
  return (
    <span ref={ref} className={cn(blink && "animate-[blink_2s_ease-in-out_infinite]", className)}>
      :
    </span>
  );
}
