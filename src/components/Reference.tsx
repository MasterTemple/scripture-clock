import { splitMatch } from "@/clock/times";
import { cn } from "@/lib/utils";

/** A reference with its chapter and verse highlighted when they match the time: "Matthew **5:48**" */
export function Reference({ reference, labels, className }: { reference: string; labels: string[]; className?: string }) {
  const parts = splitMatch(reference, labels);
  if (!parts) return <>{reference}</>;
  const [before, match, after] = parts;
  return (
    <>
      {before}
      <mark title="Matches the time" className={cn("rounded-[0.25em] bg-current/15 px-[0.25em] py-[0.05em] text-inherit [box-decoration-break:clone]", className)}>
        {match}
      </mark>
      {after}
    </>
  );
}
