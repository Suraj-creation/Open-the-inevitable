/**
 * The item bank: adding fractions with unlike denominators. Keys are private to the environment and
 * its verifier. Practice items may be chosen by the actor; probes are held out and selected by the
 * environment, so the actor cannot pick what proves mastery.
 */
export interface Item {
  readonly itemId: string;
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
}

export const PRACTICE: readonly Item[] = [
  { itemId: "i-1", a: [1, 2], b: [1, 3] },
  { itemId: "i-2", a: [1, 4], b: [1, 3] },
  { itemId: "i-3", a: [2, 5], b: [1, 2] },
  { itemId: "i-4", a: [1, 6], b: [1, 4] },
  { itemId: "i-5", a: [2, 3], b: [1, 4] },
];

export const PROBES: readonly Item[] = [
  { itemId: "p-1", a: [1, 2], b: [1, 5] },
  { itemId: "p-2", a: [3, 4], b: [1, 6] },
  { itemId: "p-3", a: [1, 3], b: [1, 5] },
  { itemId: "p-4", a: [2, 7], b: [1, 2] },
  { itemId: "p-5", a: [1, 8], b: [1, 6] },
  { itemId: "p-6", a: [3, 5], b: [1, 4] },
];

export const prompt = (item: Item): string =>
  `${item.a[0]}/${item.a[1]} + ${item.b[0]}/${item.b[1]} = ?`;

const gcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) : gcd(y, x % y));

export function reduce(n: number, d: number): readonly [number, number] {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

/** The correct sum, reduced. Private to the verifier. */
export function key(item: Item): readonly [number, number] {
  return reduce(item.a[0] * item.b[1] + item.b[0] * item.a[1], item.a[1] * item.b[1]);
}

/** The "adds denominators" misconception: (a+c)/(b+d), reduced. */
export function misconceptionAnswer(item: Item): readonly [number, number] {
  return reduce(item.a[0] + item.b[0], item.a[1] + item.b[1]);
}

export const findItem = (itemId: string): Item | undefined =>
  [...PRACTICE, ...PROBES].find((i) => i.itemId === itemId);

/** Parse the first fraction n/d in free text, reduced; undefined if none. */
export function parseFraction(text: string): readonly [number, number] | undefined {
  const m = /(-?\d+)\s*\/\s*(\d+)/.exec(text);
  if (!m?.[1] || !m[2]) return undefined;
  const d = Number(m[2]);
  if (d === 0) return undefined;
  return reduce(Number(m[1]), d);
}
