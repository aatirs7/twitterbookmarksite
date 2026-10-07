// Typo tolerance: finds vocabulary words within a small edit distance of a query term.

/** Damerau-Levenshtein (optimal string alignment) distance with an early exit above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

export interface VocabWord {
  word: string;
  ndoc: number;
}

/**
 * Close spellings of `term` that exist in the vocabulary, most common first.
 * Short terms get no fuzzing (too many false hits); 4 to 6 letters allow 1 edit, longer allow 2.
 */
export function fuzzyVariants(term: string, vocab: VocabWord[], limit = 3): string[] {
  if (term.length < 4) return [];
  const max = term.length >= 7 ? 2 : 1;
  const out: { word: string; d: number; ndoc: number }[] = [];
  for (const v of vocab) {
    if (v.word === term || Math.abs(v.word.length - term.length) > max) continue;
    const d = editDistance(term, v.word, max);
    if (d <= max) out.push({ word: v.word, d, ndoc: v.ndoc });
  }
  return out
    .sort((a, b) => a.d - b.d || b.ndoc - a.ndoc)
    .slice(0, limit)
    .map((o) => o.word);
}
