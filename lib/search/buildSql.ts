import "server-only";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { hydrateBookmarks, type BaseRow } from "@/lib/bookmarks/hydrate";
import { HL_END, HL_START, type Facet, type SearchResponse } from "@/lib/bookmarks/types";
import { buildLooseTsQuery, expandQuery } from "./expand";
import { buildExcludeTsQuery, buildTsQuery, parseQuery, type MediaFilter } from "./parseQuery";

export type SortMode = "relevance" | "newest" | "oldest" | "likes";
export type RemovedMode = "exclude" | "include" | "only";

export interface SearchParams {
  q?: string;
  tags?: string[];
  author?: string[];
  from?: string;
  to?: string;
  media?: MediaFilter | "";
  link?: boolean;
  domain?: string[];
  removed?: RemovedMode;
  pinned?: boolean;
  sort?: SortMode;
  cursor?: string | null;
  limit?: number;
}

type Dim = "tags" | "authors" | "domains" | "other";
interface Cond {
  dim: Dim;
  sql: SQL;
}

function inList(values: string[]): SQL {
  return sql.join(values.map((v) => sql`${v}`), sql`, `);
}

function decodeCursor(c: string | null | undefined): number {
  if (!c) return 0;
  const n = Number.parseInt(Buffer.from(c, "base64url").toString("utf8"), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function encodeCursor(n: number): string {
  return Buffer.from(String(n), "utf8").toString("base64url");
}

function validDate(s?: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Parses query params from a URLSearchParams (used by the API route and server pages). */
export function searchParamsFrom(sp: URLSearchParams): SearchParams {
  const list = (k: string) => [...sp.getAll(k), ...sp.getAll(`${k}[]`)].flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const bool = (k: string) => (sp.has(k) ? ["1", "true", "yes"].includes((sp.get(k) ?? "").toLowerCase()) : undefined);
  const sort = sp.get("sort");
  const removed = sp.get("removed");
  const mediaParam = sp.get("media");
  return {
    q: sp.get("q") ?? "",
    tags: list("tags"),
    author: list("author"),
    domain: list("domain"),
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    media: mediaParam && ["any", "photo", "video", "none"].includes(mediaParam) ? (mediaParam as MediaFilter) : undefined,
    link: bool("link"),
    removed: removed === "include" || removed === "only" ? removed : "exclude",
    pinned: bool("pinned"),
    sort: sort && ["relevance", "newest", "oldest", "likes"].includes(sort) ? (sort as SortMode) : undefined,
    cursor: sp.get("cursor"),
    limit: Math.min(Math.max(Number(sp.get("limit")) || 30, 1), 100),
  };
}

export async function searchBookmarks(userId: string, params: SearchParams): Promise<SearchResponse> {
  const parsed = parseQuery(params.q ?? "");
  const tsq = buildTsQuery(parsed);
  const exq = buildExcludeTsQuery(parsed);
  const limit = params.limit ?? 30;
  const offset = decodeCursor(params.cursor);

  const tagSlugs = [...new Set([...(params.tags ?? []), ...parsed.tags].map((s) => s.toLowerCase()))];
  const authors = [...new Set([...(params.author ?? []), ...parsed.from].map((s) => s.toLowerCase().replace(/^@/, "")))];
  const domains = [...new Set([...(params.domain ?? []), ...parsed.sites].map((s) => s.toLowerCase().replace(/^www\./, "")))];

  const base: Cond[] = [{ dim: "other", sql: sql`b.user_id = ${userId}` }];
  const removed = params.removed ?? "exclude";
  if (removed === "exclude") base.push({ dim: "other", sql: sql`b.removed_at is null` });
  if (removed === "only") base.push({ dim: "other", sql: sql`b.removed_at is not null` });
  if (params.pinned) base.push({ dim: "other", sql: sql`b.pinned` });

  for (const slug of tagSlugs) {
    base.push({
      dim: "tags",
      sql: sql`exists (select 1 from bookmark_tags bt join tags tg on tg.id = bt.tag_id
                where bt.user_id = b.user_id and bt.tweet_id = b.tweet_id and tg.slug = ${slug})`,
    });
  }
  if (authors.length) base.push({ dim: "authors", sql: sql`t.author_handle_lc in (${inList(authors)})` });
  for (const d of domains) {
    base.push({
      dim: "domains",
      sql: sql`exists (select 1 from links l where l.tweet_id = b.tweet_id and (l.domain = ${d} or l.domain like ${"%." + d}))`,
    });
  }

  const from = validDate(params.from);
  const to = validDate(params.to);
  if (from) base.push({ dim: "other", sql: sql`coalesce(t.created_at, b.first_seen_at) >= ${from}::timestamptz` });
  if (to) base.push({ dim: "other", sql: sql`coalesce(t.created_at, b.first_seen_at) < (${to}::timestamptz + interval '1 day')` });

  const media = params.media || (parsed.has.video ? "video" : parsed.has.photo ? "photo" : parsed.has.media ? "any" : "");
  if (media === "video") base.push({ dim: "other", sql: sql`t.has_video` });
  if (media === "any") base.push({ dim: "other", sql: sql`t.has_media` });
  if (media === "none") base.push({ dim: "other", sql: sql`not t.has_media` });
  if (media === "photo") {
    base.push({ dim: "other", sql: sql`exists (select 1 from media m where m.tweet_id = b.tweet_id and m.type = 'photo')` });
  }
  if (params.link || parsed.has.link) base.push({ dim: "other", sql: sql`t.has_link` });
  if (exq) base.push({ dim: "other", sql: sql`not (b.search_tsv @@ to_tsquery('simple', ${exq}))` });

  // Exact match, plus a loose match that tolerates typos and related concepts, plus category concepts.
  const categoryRules = tsq
    ? await db.select({ slug: tags.slug, name: tags.name, keywords: tags.keywords }).from(tags).where(eq(tags.userId, userId))
    : [];
  const expansion = tsq
    ? await expandQuery(userId, parsed, categoryRules)
    : { alternatives: new Map<string, string[]>(), typos: new Map<string, string[]>(), categories: [] };
  const looseq = tsq ? buildLooseTsQuery(parsed, expansion.alternatives) : null;
  const typoq = tsq ? buildLooseTsQuery(parsed, expansion.typos) : null;
  const catList = expansion.categories;

  const exactCond: SQL | null = tsq
    ? sql`(b.search_tsv @@ to_tsquery('simple', ${tsq}) or b.search_en @@ to_tsquery('english', ${tsq}))`
    : null;
  const catCond: SQL | null = catList.length
    ? sql`exists (select 1 from bookmark_tags bt join tags tg on tg.id = bt.tag_id
         where bt.user_id = b.user_id and bt.tweet_id = b.tweet_id and tg.slug in (${inList(catList)}))`
    : null;
  const textCond: SQL | null = tsq
    ? sql`(${exactCond} or b.search_tsv @@ to_tsquery('simple', ${looseq}) or b.search_en @@ to_tsquery('english', ${looseq})${catCond ? sql` or ${catCond}` : sql``})`
    : null;
  const fuzzyText = parsed.freeText;
  const fuzzyCond: SQL | null = fuzzyText ? sql`word_similarity(${fuzzyText}, b.search_text) >= 0.45` : null;

  const where = (conds: Cond[], text: SQL | null, omit?: Dim) => {
    const parts = conds.filter((c) => c.dim !== omit).map((c) => c.sql);
    if (text) parts.push(text);
    return sql.join(parts, sql` and `);
  };

  const sort: SortMode = params.sort ?? (tsq ? "relevance" : "newest");
  // Exact hits dominate, loose (typo and synonym) hits come next, category-only hits last.
  const rank = tsq
    ? sql`(
        4 * ts_rank_cd(b.search_tsv, to_tsquery('simple', ${tsq}), 32)
        + 2 * ts_rank_cd(b.search_en, to_tsquery('english', ${tsq}), 32)
        + 2 * ts_rank_cd(b.search_tsv, to_tsquery('simple', ${typoq}), 32)
        + ts_rank_cd(b.search_tsv, to_tsquery('simple', ${looseq}), 32)
        + 0.5 * ts_rank_cd(b.search_en, to_tsquery('english', ${looseq}), 32)
        + ${catCond ? sql`case when ${catCond} then 0.02 else 0 end` : sql`0`}
      )`
    : sql`0`;

  const runItems = async (text: SQL | null, fuzzy: boolean) => {
    const order =
      sort === "oldest"
        ? sql`b.sort_key asc nulls last, b.first_seen_at asc`
        : sort === "likes"
          ? sql`t.like_count desc, b.sort_key desc nulls last`
          : sort === "relevance" && fuzzy
            ? sql`word_similarity(${fuzzyText}, b.search_text) desc, b.sort_key desc nulls last`
            : sort === "relevance" && tsq
              ? sql`${rank} desc, b.sort_key desc nulls last`
              : sql`b.sort_key desc nulls last, b.first_seen_at desc`;
    const headline = looseq
      ? sql`ts_headline('simple', t.text, to_tsquery('simple', ${looseq}), ${`StartSel=${HL_START}, StopSel=${HL_END}, HighlightAll=true`})`
      : sql`null`;
    const res = await db.execute(sql`
      select b.tweet_id, b.sort_key, b.first_seen_at, b.removed_at, b.note, b.pinned, b.ai_summary, ${headline} as headline
      from bookmarks b join tweets t on t.id = b.tweet_id
      where ${where(base, text)}
      order by ${order}
      limit ${limit + 1} offset ${offset}
    `);
    return res.rows as unknown as BaseRow[];
  };

  const countFor = async (text: SQL | null) => {
    const res = await db.execute(sql`
      select count(*)::int as n from bookmarks b join tweets t on t.id = b.tweet_id where ${where(base, text)}
    `);
    return (res.rows[0] as { n: number } | undefined)?.n ?? 0;
  };

  let fuzzy = false;
  let text = textCond;
  let [rows, total, exactTotal] = await Promise.all([
    runItems(text, false),
    countFor(text),
    exactCond && offset === 0 ? countFor(exactCond) : Promise.resolve(1),
  ]);
  if (total === 0 && textCond && fuzzyCond) {
    text = fuzzyCond;
    [rows, total] = await Promise.all([runItems(text, true), countFor(text)]);
    exactTotal = 0;
  }
  // Tell the UI when nothing matched exactly and the results come from typo, concept or similarity matching.
  fuzzy = !!tsq && exactTotal === 0 && total > 0;

  const facets = await loadFacets(base, text, where);
  const hasMore = rows.length > limit;
  const items = await hydrateBookmarks(userId, rows.slice(0, limit));
  return { items, total, fuzzy, nextCursor: hasMore ? encodeCursor(offset + limit) : null, facets };
}

async function loadFacets(
  base: Cond[],
  text: SQL | null,
  where: (conds: Cond[], text: SQL | null, omit?: Dim) => SQL,
): Promise<SearchResponse["facets"]> {
  const [tagRes, authorRes, domainRes] = await Promise.all([
    db.execute(sql`
      select tg.slug as value, tg.name as label, max(tg.color) as color, count(*)::int as count
      from bookmarks b join tweets t on t.id = b.tweet_id
      join bookmark_tags bt on bt.user_id = b.user_id and bt.tweet_id = b.tweet_id
      join tags tg on tg.id = bt.tag_id
      where ${where(base, text, "tags")}
      group by tg.slug, tg.name order by count desc, tg.name asc limit 50
    `),
    db.execute(sql`
      select t.author_handle_lc as value, max(t.author_name) as label, count(*)::int as count
      from bookmarks b join tweets t on t.id = b.tweet_id
      where ${where(base, text, "authors")} and t.author_handle_lc is not null
      group by t.author_handle_lc order by count desc limit 10
    `),
    db.execute(sql`
      select l.domain as value, l.domain as label, count(distinct b.tweet_id)::int as count
      from bookmarks b join tweets t on t.id = b.tweet_id
      join links l on l.tweet_id = b.tweet_id
      where ${where(base, text, "domains")} and l.domain is not null
      group by l.domain order by count desc limit 10
    `),
  ]);
  return {
    tags: tagRes.rows as unknown as Facet[],
    authors: authorRes.rows as unknown as Facet[],
    domains: domainRes.rows as unknown as Facet[],
  };
}
