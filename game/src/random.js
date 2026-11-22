// A tiny deterministic random source. The city and the traffic have to look the same
// every run, so the game seeds its own generator instead of using Math.random.

export function makeRandom(seed) {
  let state = (seed >>> 0) || 1;
  const next = () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  /**
   * Picks an entry from a list of weights: pickWeighted([['a', 3], ['b', 1]], rnd)
   * returns 'a' three times as often as 'b'. A zero or negative weight is never
   * picked, and an empty list gives null rather than throwing.
   */
  next.weighted = (pairs) => {
    const usable = pairs.filter(([, w]) => Number.isFinite(w) && w > 0);
    if (!usable.length) return null;
    let total = 0;
    for (const [, w] of usable) total += w;
    let roll = next() * total;
    for (const [value, w] of usable) {
      roll -= w;
      if (roll < 0) return value;
    }
    return usable[usable.length - 1][0];
  };
  /** A shuffled copy of a list, so the order is different every time. */
  next.shuffle = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };
  return next;
}

/**
 * Picks an entry from a list of weights using any random source, including
 * Math.random. The weights do not have to add up to one.
 */
export function pickWeighted(pairs, rng = Math.random) {
  const usable = pairs.filter(([, w]) => Number.isFinite(w) && w > 0);
  if (!usable.length) return null;
  let total = 0;
  for (const [, w] of usable) total += w;
  let roll = rng() * total;
  for (const [value, w] of usable) {
    roll -= w;
    if (roll < 0) return value;
  }
  return usable[usable.length - 1][0];
}
