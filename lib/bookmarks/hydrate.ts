import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookmarkTags, links, media, tags, tweets } from "@/db/schema";
import type { BookmarkItem, ItemTag, ItemTweet } from "./types";

export interface BaseRow {
  tweet_id: string;
  sort_key: string | null;
  first_seen_at: Date | string;
  removed_at: Date | string | null;
  note: string | null;
  pinned: boolean;
  ai_summary: string | null;
  headline?: string | null;
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Loads tweets (plus quoted), media, links and tags for a list of bookmark rows. */
export async function hydrateBookmarks(userId: string, rows: BaseRow[]): Promise<BookmarkItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.tweet_id);

  const mainTweets = await db.select().from(tweets).where(inArray(tweets.id, ids));
  const quotedIds = [...new Set(mainTweets.map((t) => t.quotedTweetId).filter((x): x is string => !!x))];
  const quotedTweets = quotedIds.length ? await db.select().from(tweets).where(inArray(tweets.id, quotedIds)) : [];
  const allIds = [...ids, ...quotedIds];

  const [mediaRows, linkRows, tagRows] = await Promise.all([
    db.select().from(media).where(inArray(media.tweetId, allIds)).orderBy(asc(media.position)),
    db.select().from(links).where(inArray(links.tweetId, allIds)).orderBy(asc(links.id)),
    db
      .select({ tweetId: bookmarkTags.tweetId, source: bookmarkTags.source, id: tags.id, slug: tags.slug, name: tags.name, color: tags.color })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(and(eq(bookmarkTags.userId, userId), inArray(bookmarkTags.tweetId, ids)))
      .orderBy(asc(bookmarkTags.confidence)),
  ]);

  const toItemTweet = (t: typeof tweets.$inferSelect): ItemTweet => ({
    id: t.id,
    authorHandle: t.authorHandle,
    authorName: t.authorName,
    authorAvatarUrl: t.authorAvatarUrl,
    authorVerified: t.authorVerified,
    text: t.text,
    createdAt: iso(t.createdAt),
    replyCount: t.replyCount,
    retweetCount: t.retweetCount,
    likeCount: t.likeCount,
    quoteCount: t.quoteCount,
    viewCount: t.viewCount,
    inReplyToHandle: t.inReplyToHandle,
    isArticle: t.isArticle,
    articleTitle: t.articleTitle,
    isTombstone: t.isTombstone,
    media: mediaRows
      .filter((m) => m.tweetId === t.id)
      .map((m) => ({
        type: m.type as "photo" | "video" | "animated_gif",
        url: m.archivedUrl ?? m.url,
        videoUrl: m.videoUrl,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
        altText: m.altText,
      })),
    links: linkRows
      .filter((l) => l.tweetId === t.id)
      .map((l) => ({ url: l.url, domain: l.domain, title: l.title, description: l.description, imageUrl: l.imageUrl })),
    quoted: null,
  });

  const quotedMap = new Map(quotedTweets.map((q) => [q.id, toItemTweet(q)]));
  const tweetMap = new Map(
    mainTweets.map((t) => {
      const it = toItemTweet(t);
      it.quoted = t.quotedTweetId ? quotedMap.get(t.quotedTweetId) ?? null : null;
      return [t.id, it];
    }),
  );

  // Confidence ordering is ascending, so reverse to show most relevant first.
  const tagsFor = (id: string): ItemTag[] =>
    tagRows
      .filter((r) => r.tweetId === id)
      .reverse()
      .map((r) => ({ id: r.id, slug: r.slug, name: r.name, color: r.color, source: r.source as "ai" | "user" }));

  return rows
    .filter((r) => tweetMap.has(r.tweet_id))
    .map((r) => ({
      tweetId: r.tweet_id,
      bookmarkedAt: iso(r.first_seen_at)!,
      removedAt: iso(r.removed_at),
      note: r.note,
      pinned: r.pinned,
      aiSummary: r.ai_summary,
      headline: r.headline ?? null,
      tweet: tweetMap.get(r.tweet_id)!,
      tags: tagsFor(r.tweet_id),
    }));
}
