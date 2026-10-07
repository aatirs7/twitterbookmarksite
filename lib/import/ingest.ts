import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { bookmarks, links, media, syncRuns, tweets } from "@/db/schema";
import { normalizeEntry, type NormalizedTweet, type RawEntry } from "@/lib/x/normalize";
import { rebuildSearchDocs } from "@/lib/searchDoc";

export interface IngestResult {
  received: number;
  inserted: number;
  updated: number;
  skipped: number;
  caughtUp: boolean;
}

function tweetRow(t: NormalizedTweet) {
  return {
    id: t.id,
    authorId: t.authorId,
    authorHandle: t.authorHandle,
    authorHandleLc: t.authorHandleLc,
    authorName: t.authorName,
    authorAvatarUrl: t.authorAvatarUrl,
    authorVerified: t.authorVerified,
    text: t.text,
    lang: t.lang,
    createdAt: t.createdAt,
    replyCount: t.replyCount,
    retweetCount: t.retweetCount,
    likeCount: t.likeCount,
    quoteCount: t.quoteCount,
    viewCount: t.viewCount,
    conversationId: t.conversationId,
    inReplyToTweetId: t.inReplyToTweetId,
    inReplyToHandle: t.inReplyToHandle,
    quotedTweetId: t.quotedTweetId,
    isArticle: t.isArticle,
    articleTitle: t.articleTitle,
    hasMedia: t.hasMedia,
    hasVideo: t.hasVideo,
    hasLink: t.hasLink,
    isTombstone: false,
    raw: t.raw,
    updatedAt: new Date(),
  };
}

const excluded = (col: string) => sql.raw(`excluded.${col}`);

async function upsertTweets(tx: Tx, list: NormalizedTweet[]) {
  const full = list.filter((t) => !t.isTombstone);
  const dead = list.filter((t) => t.isTombstone);

  if (full.length) {
    await tx
      .insert(tweets)
      .values(full.map(tweetRow))
      .onConflictDoUpdate({
        target: tweets.id,
        set: {
          authorId: excluded("author_id"),
          authorHandle: excluded("author_handle"),
          authorHandleLc: excluded("author_handle_lc"),
          authorName: excluded("author_name"),
          authorAvatarUrl: excluded("author_avatar_url"),
          authorVerified: excluded("author_verified"),
          text: excluded("text"),
          lang: excluded("lang"),
          createdAt: excluded("created_at"),
          replyCount: excluded("reply_count"),
          retweetCount: excluded("retweet_count"),
          likeCount: excluded("like_count"),
          quoteCount: excluded("quote_count"),
          viewCount: excluded("view_count"),
          conversationId: excluded("conversation_id"),
          inReplyToTweetId: excluded("in_reply_to_tweet_id"),
          inReplyToHandle: excluded("in_reply_to_handle"),
          quotedTweetId: excluded("quoted_tweet_id"),
          isArticle: excluded("is_article"),
          articleTitle: excluded("article_title"),
          hasMedia: excluded("has_media"),
          hasVideo: excluded("has_video"),
          hasLink: excluded("has_link"),
          isTombstone: sql`false`,
          raw: excluded("raw"),
          updatedAt: excluded("updated_at"),
        },
      });
  }

  if (dead.length) {
    // Keep any content we already have; only flag the tweet as gone.
    await tx
      .insert(tweets)
      .values(dead.map((t) => ({ id: t.id, text: t.text, isTombstone: true, raw: t.raw, updatedAt: new Date() })))
      .onConflictDoUpdate({ target: tweets.id, set: { isTombstone: sql`true`, updatedAt: excluded("updated_at") } });
  }

  const mediaRows = full.flatMap((t) => t.media.map((m) => ({ tweetId: t.id, ...m })));
  if (mediaRows.length) {
    await tx
      .insert(media)
      .values(mediaRows)
      .onConflictDoUpdate({
        target: [media.tweetId, media.position],
        set: {
          type: excluded("type"),
          url: excluded("url"),
          videoUrl: excluded("video_url"),
          width: excluded("width"),
          height: excluded("height"),
          durationMs: excluded("duration_ms"),
          altText: excluded("alt_text"),
        },
      });
  }

  const linkRows = full.flatMap((t) => t.links.map((l) => ({ tweetId: t.id, ...l })));
  if (linkRows.length) {
    await tx
      .insert(links)
      .values(linkRows)
      .onConflictDoUpdate({
        target: [links.tweetId, links.url],
        set: {
          domain: excluded("domain"),
          title: sql`coalesce(excluded.title, ${links.title})`,
          description: sql`coalesce(excluded.description, ${links.description})`,
          imageUrl: sql`coalesce(excluded.image_url, ${links.imageUrl})`,
        },
      });
  }
}

/**
 * Normalizes and stores one page of bookmark entries in a single transaction.
 * Returns counts and whether, in incremental mode, the page was entirely known.
 */
export async function ingestEntries(opts: {
  userId: string;
  runId: string | null;
  mode: "incremental" | "full" | "file";
  entries: RawEntry[];
  /** 1-based page number from the extension; chunks of one page share it. */
  page?: number;
}): Promise<IngestResult & { errors: string[] }> {
  const { userId, runId, mode, entries, page } = opts;
  const errors: string[] = [];
  const items: { tweet: NormalizedTweet; sortIndex: string }[] = [];

  for (const entry of entries) {
    try {
      const r = normalizeEntry(entry);
      if (r.ok) items.push({ tweet: r.tweet, sortIndex: entry.sortIndex });
      else errors.push(`${entry.entryId}: ${r.reason}`);
    } catch (err) {
      errors.push(`${entry?.entryId}: ${(err as Error).message}`);
    }
  }

  // Dedupe tweets (bookmarked plus quoted), preferring full content over tombstones.
  const allTweets = new Map<string, NormalizedTweet>();
  const put = (t: NormalizedTweet) => {
    const prev = allTweets.get(t.id);
    if (!prev || (prev.isTombstone && !t.isTombstone)) allTweets.set(t.id, t);
  };
  for (const { tweet } of items) {
    if (tweet.quoted) put(tweet.quoted);
    put(tweet);
  }

  const bookmarkMap = new Map<string, string>();
  for (const { tweet, sortIndex } of items) if (!bookmarkMap.has(tweet.id)) bookmarkMap.set(tweet.id, sortIndex);
  const ids = [...bookmarkMap.keys()];

  const result = await db.transaction(async (tx) => {
    if (ids.length === 0) return { inserted: 0, updated: 0, caughtUp: false };

    await upsertTweets(tx, [...allTweets.values()]);

    const existing = await tx
      .select({ tweetId: bookmarks.tweetId, removedAt: bookmarks.removedAt })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.tweetId, ids)));
    const existingIds = new Set(existing.map((e) => e.tweetId));
    const activeIds = new Set(existing.filter((e) => !e.removedAt).map((e) => e.tweetId));

    const sortKeyOf = (s: string) => (/^\d+$/.test(s) ? s : null);
    await tx
      .insert(bookmarks)
      .values(
        ids.map((tweetId) => ({
          userId,
          tweetId,
          sortIndex: bookmarkMap.get(tweetId) ?? null,
          sortKey: sortKeyOf(bookmarkMap.get(tweetId) ?? ""),
          lastSeenRunId: runId,
        })),
      )
      .onConflictDoUpdate({
        target: [bookmarks.userId, bookmarks.tweetId],
        set: {
          sortIndex: sql`coalesce(excluded.sort_index, ${bookmarks.sortIndex})`,
          sortKey: sql`coalesce(excluded.sort_key, ${bookmarks.sortKey})`,
          lastSeenRunId: sql`coalesce(excluded.last_seen_run_id, ${bookmarks.lastSeenRunId})`,
          removedAt: sql`null`,
        },
      });

    await rebuildSearchDocs(tx, userId, ids);

    const inserted = ids.filter((id) => !existingIds.has(id)).length;
    return {
      inserted,
      updated: ids.length - inserted,
      caughtUp: mode === "incremental" && ids.every((id) => activeIds.has(id)),
    };
  });

  if (runId) {
    const errorText = errors.length ? errors.slice(0, 20).join("\n") : null;
    await db
      .update(syncRuns)
      .set({
        pages: page ? sql`greatest(${syncRuns.pages}, ${page})` : sql`${syncRuns.pages} + 1`,
        received: sql`${syncRuns.received} + ${entries.length}`,
        inserted: sql`${syncRuns.inserted} + ${result.inserted}`,
        updated: sql`${syncRuns.updated} + ${result.updated}`,
        ...(errorText
          ? { error: sql`left(concat_ws(E'\n', ${syncRuns.error}, ${errorText}), 8000)` }
          : {}),
      })
      .where(eq(syncRuns.id, runId));
  }
  if (errors.length) console.warn(`[ingest] ${errors.length} entries skipped`, errors.slice(0, 5));

  return { received: entries.length, skipped: errors.length, errors, ...result };
}
