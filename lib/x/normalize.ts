/* eslint-disable @typescript-eslint/no-explicit-any */
// Pure normalizer for X GraphQL `tweet_results.result` objects.
// Defensive by design: unknown shapes return null with a reason, never throw.

export type MediaType = "photo" | "video" | "animated_gif";

export interface NormalizedMedia {
  position: number;
  type: MediaType;
  url: string;
  videoUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  altText: string | null;
}

export interface NormalizedLink {
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface NormalizedTweet {
  id: string;
  authorId: string | null;
  authorHandle: string | null;
  authorHandleLc: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorVerified: boolean;
  text: string;
  lang: string | null;
  createdAt: Date | null;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number | null;
  conversationId: string | null;
  inReplyToTweetId: string | null;
  inReplyToHandle: string | null;
  quotedTweetId: string | null;
  isArticle: boolean;
  articleTitle: string | null;
  hasMedia: boolean;
  hasVideo: boolean;
  hasLink: boolean;
  isTombstone: boolean;
  raw: unknown;
  media: NormalizedMedia[];
  links: NormalizedLink[];
  quoted: NormalizedTweet | null;
}

export type NormalizeResult =
  | { ok: true; tweet: NormalizedTweet }
  | { ok: false; reason: string };

export interface RawEntry {
  entryId: string;
  sortIndex: string;
  result: unknown;
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parses X's legacy date format: "Wed Oct 10 20:19:24 +0000 2018". */
export function parseXDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^\w{3} (\w{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2}) (\d{4})$/);
  if (m) {
    const [, mon, day, hh, mm, ss, sign, oh, om, year] = m;
    const month = MONTHS[mon];
    if (month === undefined) return null;
    const utc = Date.UTC(+year, month, +day, +hh, +mm, +ss);
    const offset = (sign === "-" ? -1 : 1) * (+oh * 60 + +om) * 60_000;
    return new Date(utc - offset);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strips visibility wrappers and returns the inner tweet object. */
export function unwrap(result: any): any {
  let r = result;
  for (let i = 0; i < 3 && r; i++) {
    if (r.__typename === "TweetWithVisibilityResults" && r.tweet) r = r.tweet;
    else if (!r.__typename && r.tweet && !r.legacy) r = r.tweet;
    else break;
  }
  return r;
}

export function tweetIdFromEntryId(entryId: string): string | null {
  const m = entryId.match(/(\d{5,})$/);
  return m ? m[1] : null;
}

function readUser(tweet: any) {
  const u = unwrap(tweet?.core?.user_results?.result) ?? {};
  const legacy = u.legacy ?? {};
  const handle = str(u.core?.screen_name) ?? str(legacy.screen_name);
  const name = str(u.core?.name) ?? str(legacy.name);
  let avatar = str(u.avatar?.image_url) ?? str(legacy.profile_image_url_https);
  if (avatar) avatar = avatar.replace(/_normal(\.\w+)$/, "_bigger$1");
  return {
    authorId: str(u.rest_id),
    authorHandle: handle,
    authorHandleLc: handle ? handle.toLowerCase() : null,
    authorName: name,
    authorAvatarUrl: avatar,
    authorVerified: Boolean(u.is_blue_verified ?? legacy.verified),
  };
}

function bestVideoUrl(info: any): string | null {
  const variants: any[] = Array.isArray(info?.variants) ? info.variants : [];
  const mp4 = variants
    .filter((v) => v?.content_type === "video/mp4" && typeof v.url === "string")
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4[0]?.url ?? null;
}

function readMedia(legacy: any): { media: NormalizedMedia[]; tcoUrls: string[] } {
  const list: any[] = legacy?.extended_entities?.media ?? legacy?.entities?.media ?? [];
  const media: NormalizedMedia[] = [];
  const tcoUrls = new Set<string>();
  list.forEach((m, i) => {
    if (!m || typeof m.media_url_https !== "string") return;
    if (typeof m.url === "string") tcoUrls.add(m.url);
    const type: MediaType =
      m.type === "video" || m.type === "animated_gif" ? m.type : "photo";
    media.push({
      position: i,
      type,
      url: m.media_url_https,
      videoUrl: type === "photo" ? null : bestVideoUrl(m.video_info),
      width: toInt(m.original_info?.width),
      height: toInt(m.original_info?.height),
      durationMs: toInt(m.video_info?.duration_millis),
      altText: str(m.ext_alt_text),
    });
  });
  return { media, tcoUrls: [...tcoUrls] };
}

interface CardData {
  tco: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string | null;
}

function readCard(tweet: any): CardData | null {
  const legacy = tweet?.card?.legacy;
  const values: any[] = legacy?.binding_values;
  if (!Array.isArray(values)) return null;
  const map = new Map<string, any>();
  for (const v of values) if (v && typeof v.key === "string") map.set(v.key, v.value);
  const s = (k: string) => str(map.get(k)?.string_value);
  const img = (k: string) => str(map.get(k)?.image_value?.url);
  return {
    tco: s("card_url") ?? str(legacy?.url),
    title: s("title"),
    description: s("description"),
    imageUrl:
      img("thumbnail_image_large") ??
      img("summary_photo_image_large") ??
      img("photo_image_full_size_large") ??
      img("thumbnail_image"),
    domain: s("vanity_url") ?? s("domain"),
  };
}

function isSelfMediaLink(expanded: string, tweetId: string): boolean {
  return new RegExp(`/status/${tweetId}/(photo|video)/\\d+`).test(expanded);
}

function isStatusLink(expanded: string, id: string | null): boolean {
  return !!id && new RegExp(`/status/${id}(?:[/?#]|$)`).test(expanded);
}

function tombstone(id: string, raw: unknown, text: string | null): NormalizedTweet {
  return {
    id,
    authorId: null,
    authorHandle: null,
    authorHandleLc: null,
    authorName: null,
    authorAvatarUrl: null,
    authorVerified: false,
    text: text ?? "",
    lang: null,
    createdAt: null,
    replyCount: 0,
    retweetCount: 0,
    likeCount: 0,
    quoteCount: 0,
    viewCount: null,
    conversationId: null,
    inReplyToTweetId: null,
    inReplyToHandle: null,
    quotedTweetId: null,
    isArticle: false,
    articleTitle: null,
    hasMedia: false,
    hasVideo: false,
    hasLink: false,
    isTombstone: true,
    raw,
    media: [],
    links: [],
    quoted: null,
  };
}

/**
 * Normalizes one `tweet_results.result` object.
 * `fallbackId` is used for tombstones, which carry no rest_id.
 * `depth` limits quoted-tweet recursion to one level.
 */
export function normalizeTweet(result: unknown, fallbackId: string | null = null, depth = 0): NormalizeResult {
  const raw = result as any;
  if (!raw || typeof raw !== "object") return { ok: false, reason: "result is not an object" };
  const t = unwrap(raw);
  const typename = t?.__typename;

  if (typename === "TweetTombstone" || typename === "TweetUnavailable") {
    const id = str(t?.rest_id) ?? fallbackId;
    if (!id) return { ok: false, reason: `${typename} without id` };
    return { ok: true, tweet: tombstone(id, raw, str(t?.tombstone?.text?.text)) };
  }

  const legacy = t?.legacy;
  const id = str(t?.rest_id) ?? str(legacy?.id_str);
  if (!legacy || !id) {
    return { ok: false, reason: `unknown shape: __typename=${String(typename)}` };
  }

  const user = readUser(t);
  const { media, tcoUrls: mediaTco } = readMedia(legacy);

  const note = t.note_tweet?.note_tweet_results?.result;
  const noteText = str(note?.text);
  let text: string = noteText ?? (typeof legacy.full_text === "string" ? legacy.full_text : "");

  const urlEntities: any[] = [
    ...(Array.isArray(legacy.entities?.urls) ? legacy.entities.urls : []),
    ...(Array.isArray(note?.entity_set?.urls) ? note.entity_set.urls : []),
  ];

  // Quoted tweet (one level deep).
  let quoted: NormalizedTweet | null = null;
  let quotedId: string | null = str(legacy.quoted_status_id_str);
  const qr = t.quoted_status_result?.result;
  if (qr && depth === 0) {
    const q = normalizeTweet(qr, quotedId, depth + 1);
    if (q.ok) {
      quoted = q.tweet;
      quotedId = q.tweet.id;
    }
  }
  const quotedPermalink = str(legacy.quoted_status_permalink?.expanded);

  // Expand t.co URLs and collect links.
  const expansions = new Map<string, string>();
  for (const u of urlEntities) {
    if (typeof u?.url === "string" && typeof u?.expanded_url === "string") {
      expansions.set(u.url, u.expanded_url);
    }
  }

  for (const tco of mediaTco) {
    text = text.replace(new RegExp(`\\s*${escapeRegExp(tco)}`, "g"), "");
  }

  const card = readCard(t);
  const links: NormalizedLink[] = [];
  const seen = new Set<string>();
  for (const [tco, expanded] of expansions) {
    const isQuoteLink =
      isStatusLink(expanded, quotedId) || (quotedPermalink !== null && expanded === quotedPermalink);
    if (isQuoteLink && text.trimEnd().endsWith(tco)) {
      text = text.replace(new RegExp(`\\s*${escapeRegExp(tco)}\\s*$`), "");
    } else {
      text = text.split(tco).join(expanded);
    }
    const isSelf = isSelfMediaLink(expanded, id) || isStatusLink(expanded, id);
    if (isSelf || isQuoteLink || seen.has(expanded)) continue;
    seen.add(expanded);
    links.push({
      url: expanded,
      domain: domainOf(expanded),
      title: null,
      description: null,
      imageUrl: null,
    });
  }

  // Attach card metadata to the matching link.
  if (card && (card.title || card.description || card.imageUrl)) {
    const byTco = card.tco ? expansions.get(card.tco) : undefined;
    let target = byTco ? links.find((l) => l.url === byTco) : undefined;
    if (!target && card.domain) {
      const d = card.domain.replace(/^www\./, "").toLowerCase();
      target = links.find((l) => l.domain === d);
    }
    if (!target && links.length === 1) target = links[0];
    if (target) {
      target.title = card.title;
      target.description = card.description;
      target.imageUrl = card.imageUrl;
    }
  }

  // Strip any leftover trailing t.co link that maps to nothing (usually media or card).
  text = decodeEntities(text).replace(/\s+https:\/\/t\.co\/\w+\s*$/, "").trim();

  const articleTitle = str(t.article?.article_results?.result?.title);

  const tweet: NormalizedTweet = {
    id,
    ...user,
    text,
    lang: str(legacy.lang),
    createdAt: parseXDate(legacy.created_at),
    replyCount: toInt(legacy.reply_count) ?? 0,
    retweetCount: toInt(legacy.retweet_count) ?? 0,
    likeCount: toInt(legacy.favorite_count) ?? 0,
    quoteCount: toInt(legacy.quote_count) ?? 0,
    viewCount: toInt(t.views?.count),
    conversationId: str(legacy.conversation_id_str),
    inReplyToTweetId: str(legacy.in_reply_to_status_id_str),
    inReplyToHandle: str(legacy.in_reply_to_screen_name),
    quotedTweetId: quotedId,
    isArticle: Boolean(t.article),
    articleTitle,
    hasMedia: media.length > 0,
    hasVideo: media.some((m) => m.type === "video"),
    hasLink: links.length > 0,
    isTombstone: false,
    raw,
    media,
    links,
    quoted,
  };
  return { ok: true, tweet };
}

export function normalizeEntry(entry: RawEntry): NormalizeResult {
  return normalizeTweet(entry.result, tweetIdFromEntryId(entry.entryId));
}
