import { splitMatch } from "@/clock/times";
import { Colon } from "@/components/Colon";
import { cn } from "@/lib/utils";

/**
 * A reference with its chapter and verse highlighted when they match the time: "Matthew **5:48**".
 * With `colon`, the colon between them blinks like the clock's, in that color.
 */
export function Reference({ reference, labels, className, colon }: { reference: string; labels: string[]; className?: string; colon?: string }) {
  const parts = splitMatch(reference, labels);
  if (!parts) return <>{reference}</>;
  const [before, match, after] = parts;
  return (
    <>
      {before}
      <mark title="Matches the time" className={cn("rounded-[0.25em] bg-current/15 px-[0.25em] py-[0.05em] text-inherit [box-decoration-break:clone]", className)}>
        {colon && match.includes(":") ? (
          <>
            {match.slice(0, match.indexOf(":"))}
            <Colon className={colon} />
            {match.slice(match.indexOf(":") + 1)}
          </>
        ) : (
          match
        )}
      </mark>
      {after}
    </>
  );
}
