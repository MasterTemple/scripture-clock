/** A number from a string, to seed a shuffle */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A small seeded generator (mulberry32): the same seed gives the same numbers */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The items in an order fixed by the seed (Fisher–Yates) */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const random = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The items in a random order fixed by the seed, where an item of weight 4 tends to come before
 * one of weight 1 four times as often (Efraimidis–Spirakis). Items of weight 0 are left out.
 */
export function weightedShuffled<T>(items: readonly T[], weight: (item: T) => number, seed: number): T[] {
  const random = seeded(seed);
  return items
    .map((item) => ({ item, w: weight(item) }))
    .filter((x) => x.w > 0)
    .map((x) => ({ item: x.item, k: -Math.log(1 - random()) / x.w }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}
