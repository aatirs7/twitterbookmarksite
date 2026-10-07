// Free, deterministic categorizer. Each category has comma separated rules:
//   word or "a phrase"   matched on word boundaries (a trailing * makes it a prefix match)
//   site.com             matched against link domains and URLs in the text
//   @handle              matched against the author (or quoted author)
// No network, no model, no cost.

export interface RuleCategory {
  slug: string;
  keywords: string | null;
}

export interface RuleDoc {
  text: string;
  authorHandle?: string | null;
  quotedAuthorHandle?: string | null;
  domains?: string[];
}

type Rule =
  | { kind: "handle"; value: string; weight: number }
  | { kind: "domain"; value: string; weight: number }
  | { kind: "word"; re: RegExp; weight: number };

const cache = new Map<string, Rule[]>();

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseRules(keywords: string | null): Rule[] {
  const key = keywords ?? "";
  const hit = cache.get(key);
  if (hit) return hit;
  const rules: Rule[] = [];
  for (const raw of key.split(",")) {
    const entry = raw.trim().toLowerCase().replace(/^"|"$/g, "");
    if (!entry) continue;
    if (entry.startsWith("@") && entry.length > 1) {
      rules.push({ kind: "handle", value: entry.slice(1), weight: 3 });
    } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(entry)) {
      rules.push({ kind: "domain", value: entry, weight: 2.5 });
    } else {
      const prefix = entry.endsWith("*");
      const body = escapeRegExp(prefix ? entry.slice(0, -1) : entry).replace(/\s+/g, "\\s+");
      const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${body}${prefix ? "" : "(?![\\p{L}\\p{N}])"}`, "iu");
      rules.push({ kind: "word", re, weight: entry.includes(" ") ? 1.5 : 1 });
    }
  }
  cache.set(key, rules);
  return rules;
}

function scoreCategory(rules: Rule[], text: string, handles: string[], domains: string[]): number {
  let score = 0;
  for (const r of rules) {
    if (r.kind === "handle") {
      if (handles.includes(r.value)) score += r.weight;
    } else if (r.kind === "domain") {
      const d = r.value;
      if (domains.some((x) => x === d || x.endsWith(`.${d}`)) || text.includes(d)) score += r.weight;
    } else if (r.re.test(text)) {
      score += r.weight;
    }
  }
  return score;
}

/**
 * Returns up to `max` category slugs, best first. Secondary categories must score at least half
 * of the best one. Falls back to `fallback` (usually "other") when nothing matches.
 */
export function categorize(doc: RuleDoc, categories: RuleCategory[], opts: { max?: number; fallback?: string | null } = {}): string[] {
  const max = opts.max ?? 3;
  const text = doc.text.toLowerCase();
  const handles = [doc.authorHandle, doc.quotedAuthorHandle].filter((h): h is string => !!h).map((h) => h.toLowerCase());
  const domains = (doc.domains ?? []).map((d) => d.toLowerCase());

  const scored = categories
    .map((c) => ({ slug: c.slug, score: scoreCategory(parseRules(c.keywords), text, handles, domains) }))
    .filter((c) => c.score >= 1)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return opts.fallback ? [opts.fallback] : [];
  const top = scored[0].score;
  return scored.filter((c, i) => i === 0 || c.score >= Math.max(1, top / 2)).slice(0, max).map((c) => c.slug);
}
