export type MediaFilter = "any" | "photo" | "video" | "none";

export interface ParsedQuery {
  /** Plain words to AND together (lowercased, sanitized). */
  terms: string[];
  /** Quoted phrases, each a list of words. */
  phrases: string[][];
  /** Words prefixed with `-`. */
  excludes: string[];
  from: string[];
  tags: string[];
  sites: string[];
  has: { video?: boolean; photo?: boolean; link?: boolean; media?: boolean };
  /** Free text left after operators were removed, used for trigram fallback and headlines. */
  freeText: string;
  /** Whether the query ended mid-word, so the last term should be prefix-matched. */
  prefixLast: boolean;
}

// Characters that carry meaning in to_tsquery; we strip them from user words.
const TS_SPECIAL = /[&|!():<>*'\\"]/g;

export function sanitizeWord(w: string): string {
  return w.replace(TS_SPECIAL, " ").trim().toLowerCase();
}

function splitWords(s: string): string[] {
  return sanitizeWord(s)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function parseQuery(input: string): ParsedQuery {
  const out: ParsedQuery = {
    terms: [],
    phrases: [],
    excludes: [],
    from: [],
    tags: [],
    sites: [],
    has: {},
    freeText: "",
    prefixLast: false,
  };
  const q = (input ?? "").trim();
  if (!q) return out;

  const free: string[] = [];
  const tokenRe = /(-?)"([^"]*)"?|(\S+)/g;
  let m: RegExpExecArray | null;
  let lastWasPlainTerm = false;

  while ((m = tokenRe.exec(q))) {
    lastWasPlainTerm = false;
    if (m[2] !== undefined) {
      const words = splitWords(m[2]);
      if (words.length === 0) continue;
      if (m[1] === "-") out.excludes.push(...words);
      else {
        out.phrases.push(words);
        free.push(m[2]);
      }
      continue;
    }
    const tok = m[3];
    const op = tok.match(/^(from|tag|site|has):(.+)$/i);
    if (op) {
      const key = op[1].toLowerCase();
      const val = op[2].toLowerCase();
      if (key === "from") out.from.push(val.replace(/^@/, ""));
      else if (key === "tag") out.tags.push(val);
      else if (key === "site") out.sites.push(val.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""));
      else if (key === "has") {
        if (val === "video" || val === "videos") out.has.video = true;
        else if (val === "photo" || val === "photos" || val === "image" || val === "images") out.has.photo = true;
        else if (val === "link" || val === "links") out.has.link = true;
        else if (val === "media") out.has.media = true;
      }
      continue;
    }
    if (tok.startsWith("-") && tok.length > 1) {
      out.excludes.push(...splitWords(tok.slice(1)));
      continue;
    }
    if (tok.startsWith("@") && tok.length > 1) {
      // Bare @handle searches text and author; keep it as a term.
      const words = splitWords(tok.slice(1));
      out.terms.push(...words);
      free.push(tok.slice(1));
      lastWasPlainTerm = words.length > 0;
      continue;
    }
    const words = splitWords(tok);
    out.terms.push(...words);
    free.push(tok);
    lastWasPlainTerm = words.length > 0;
  }

  out.freeText = free.join(" ").trim();
  out.prefixLast = lastWasPlainTerm && !/\s$/.test(input);
  return out;
}

/** Quotes a lexeme for use inside to_tsquery. */
function lex(w: string): string {
  return `'${w.replace(/'/g, "''")}'`;
}

/**
 * Builds a positive to_tsquery string. Terms are ANDed, the last plain term gets a `:*`
 * prefix, phrases use `<->`. Returns null when there is nothing to match.
 * Used with both the `simple` and `english` configs.
 */
export function buildTsQuery(p: ParsedQuery): string | null {
  const parts = p.terms.map((t, i) =>
    i === p.terms.length - 1 && p.prefixLast ? `${lex(t)}:*` : lex(t),
  );
  for (const ph of p.phrases) parts.push(ph.length === 1 ? lex(ph[0]) : `(${ph.map(lex).join(" <-> ")})`);
  return parts.length ? parts.join(" & ") : null;
}

/** tsquery matching any excluded word; rows matching it are filtered out. */
export function buildExcludeTsQuery(p: ParsedQuery): string | null {
  return p.excludes.length ? p.excludes.map(lex).join(" | ") : null;
}
