import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A number to step down and up: through `values` when given (1, 2, 3, 4, 5, 6, 10…), or by one
 * between `min` and `max`
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = Infinity,
  values,
  label,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  values?: readonly number[];
  label: string;
  className?: string;
}) {
  const index = values ? Math.max(0, values.findIndex((v) => v >= value)) : -1;
  const down = values ? (index > 0 ? values[index - 1]! : null) : value > min ? value - 1 : null;
  const up = values ? (index < values.length - 1 ? values[index + 1]! : null) : value < max ? value + 1 : null;
  const button = "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4";
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-lg border bg-card p-0.5 shadow-xs", className)}>
      <button type="button" className={button} onClick={() => down !== null && onChange(down)} disabled={down === null} aria-label={`Fewer: ${label}`}>
        <MinusIcon />
      </button>
      <output aria-live="polite" className="w-7 text-center text-sm font-semibold tabular-nums">
        {value}
      </output>
      <button type="button" className={button} onClick={() => up !== null && onChange(up)} disabled={up === null} aria-label={`More: ${label}`}>
        <PlusIcon />
      </button>
    </div>
  );
}
