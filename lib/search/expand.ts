import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fuzzyVariants, type VocabWord } from "./fuzzy";
import { sanitizeWord, type ParsedQuery } from "./parseQuery";
import { synonymsOf } from "./synonyms";

const VOCAB_TTL_MS = 10 * 60_000;
const vocabCache = new Map<string, { at: number; words: VocabWord[]; set: Set<string> }>();

/** Distinct words in a user's search index (from the simple tsvector), cached for 10 minutes. */
async function vocabulary(userId: string) {
  const hit = vocabCache.get(userId);
  if (hit && Date.now() - hit.at < VOCAB_TTL_MS) return hit;
  const res = await db.execute(sql`
    select word, ndoc from ts_stat(format('select search_tsv from bookmarks where user_id = %L', ${userId}::text))
    where length(word) between 3 and 30 and word ~ '^[a-z][a-z0-9]*$'
  `);
  const words = res.rows as unknown as VocabWord[];
  const entry = { at: Date.now(), words, set: new Set(words.map((w) => w.word)) };
  vocabCache.set(userId, entry);
  return entry;
}

export interface Expansion {
  /** term -> alternative lexemes (typo fixes and synonyms). */
  alternatives: Map<string, string[]>;
  /** term -> typo fixes only, ranked above concept matches. */
  typos: Map<string, string[]>;
  /** Category slugs whose name or keywords match a query term. */
  categories: string[];
}

function lex(w: string) {
  return `'${w.replace(/'/g, "''")}'`;
}

/** Builds typo and concept alternatives for each plain query term. */
export async function expandQuery(
  userId: string,
  parsed: ParsedQuery,
  categoryRules: { slug: string; name: string; keywords: string | null }[],
): Promise<Expansion> {
  const alternatives = new Map<string, string[]>();
  const typos = new Map<string, string[]>();
  const categories = new Set<string>();
  if (parsed.terms.length === 0) return { alternatives, typos, categories: [] };

  const vocab = await vocabulary(userId);
  for (const term of parsed.terms) {
    const alts = new Set<string>();
    if (!vocab.set.has(term)) {
      const fixes = fuzzyVariants(term, vocab.words);
      fixes.forEach((w) => alts.add(w));
      if (fixes.length) typos.set(term, fixes);
    }
    for (const s of synonymsOf(term)) if (vocab.set.has(s)) alts.add(s);
    // Synonyms of the corrected spelling too ("discunt" -> "discount" -> "deal").
    for (const a of [...alts]) for (const s of synonymsOf(a)) if (vocab.set.has(s)) alts.add(s);
    alts.delete(term);
    if (alts.size) alternatives.set(term, [...alts].slice(0, 8));

    const forms = [term, ...alts].filter((f) => f.length >= 3);
    for (const c of categoryRules) {
      const nameWords = c.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && w !== "and");
      const keywordList = (c.keywords ?? "")
        .toLowerCase()
        .split(",")
        .map((k) => sanitizeWord(k.replace(/\*$/, "")))
        .filter(Boolean);
      if (forms.some((f) => nameWords.includes(f) || keywordList.includes(f))) categories.add(c.slug);
    }
  }
  return { alternatives, typos, categories: [...categories] };
}

/** Loose tsquery: each term ORed with its alternatives, terms ANDed, last term prefix-matched. */
export function buildLooseTsQuery(parsed: ParsedQuery, alternatives: Map<string, string[]>): string | null {
  const parts = parsed.terms.map((t, i) => {
    const prefix = i === parsed.terms.length - 1 && parsed.prefixLast ? ":*" : "";
    const alts = alternatives.get(t) ?? [];
    const opts = [`${lex(t)}${prefix}`, ...alts.map((a) => lex(a))];
    return opts.length === 1 ? opts[0] : `(${opts.join(" | ")})`;
  });
  for (const ph of parsed.phrases) parts.push(ph.length === 1 ? lex(ph[0]) : `(${ph.map(lex).join(" <-> ")})`);
  return parts.length ? parts.join(" & ") : null;
}
