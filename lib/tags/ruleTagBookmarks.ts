import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookmarkTagBlocks, bookmarkTags, bookmarks, tags } from "@/db/schema";
import { rebuildSearchDocs } from "@/lib/searchDoc";
import { categorize } from "./ruleTagger";

const CHUNK = 400;

interface Row {
  tweet_id: string;
  text: string;
  author_handle: string | null;
  quoted_author_handle: string | null;
  domains: string[] | null;
}

/**
 * Free categorizer: tags untagged active bookmarks using each category's keyword rules.
 * Processes everything pending (in chunks) unless `limit` is given. Returns the number tagged.
 */
export async function ruleTagBookmarks(userId: string, limit = Infinity, deadline?: number): Promise<number> {
  const categories = await db
    .select({ id: tags.id, slug: tags.slug, keywords: tags.keywords })
    .from(tags)
    .where(eq(tags.userId, userId));
  if (categories.length === 0) return 0;
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const fallback = idBySlug.has("other") ? "other" : null;

  let done = 0;
  while (done < limit) {
    if (deadline && Date.now() > deadline) break;
    const res = await db.execute(sql`
      select b.tweet_id,
        concat_ws(' ', t.text, t.article_title, q.text,
          (select string_agg(concat_ws(' ', l.title, l.description, l.url), ' ') from links l where l.tweet_id = t.id)) as text,
        t.author_handle_lc as author_handle,
        q.author_handle_lc as quoted_author_handle,
        (select array_agg(distinct l.domain) from links l where l.tweet_id = t.id and l.domain is not null) as domains
      from bookmarks b
      join tweets t on t.id = b.tweet_id
      left join tweets q on q.id = t.quoted_tweet_id
      where b.user_id = ${userId} and b.tagged_at is null and b.removed_at is null
      order by b.first_seen_at asc
      limit ${Math.min(CHUNK, limit - done)}
    `);
    const rows = res.rows as unknown as Row[];
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.tweet_id);

    const blocks = await db
      .select({ tweetId: bookmarkTagBlocks.tweetId, tagId: bookmarkTagBlocks.tagId })
      .from(bookmarkTagBlocks)
      .where(and(eq(bookmarkTagBlocks.userId, userId), inArray(bookmarkTagBlocks.tweetId, ids)));
    const blocked = new Set(blocks.map((b) => `${b.tweetId}:${b.tagId}`));

    const inserts: (typeof bookmarkTags.$inferInsert)[] = [];
    for (const r of rows) {
      const slugs = categorize(
        { text: r.text ?? "", authorHandle: r.author_handle, quotedAuthorHandle: r.quoted_author_handle, domains: r.domains ?? [] },
        categories,
        { fallback },
      );
      slugs
        .map((s) => idBySlug.get(s))
        .filter((id): id is string => !!id && !blocked.has(`${r.tweet_id}:${id}`))
        .forEach((tagId, i) => inserts.push({ userId, tweetId: r.tweet_id, tagId, source: "ai", confidence: 1 - i * 0.2 }));
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(bookmarkTags)
        .where(and(eq(bookmarkTags.userId, userId), inArray(bookmarkTags.tweetId, ids), eq(bookmarkTags.source, "ai")));
      if (inserts.length) await tx.insert(bookmarkTags).values(inserts).onConflictDoNothing();
      await tx
        .update(bookmarks)
        .set({ taggedAt: new Date() })
        .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.tweetId, ids)));
      await rebuildSearchDocs(tx, userId, ids);
    });
    done += rows.length;
  }
  return done;
}
