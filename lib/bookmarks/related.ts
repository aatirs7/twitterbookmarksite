import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { hydrateBookmarks, type BaseRow } from "./hydrate";

/** Top related bookmarks by shared tags plus text similarity on the english tsvector. */
export async function relatedBookmarks(userId: string, tweetId: string, limit = 6) {
  const res = await db.execute(sql`
    with src as (
      select b.search_en,
        (select string_agg(quote_literal(l), ' | ')
           from (select lexeme as l from unnest(b.search_en) order by length(lexeme) desc limit 24) words
          where length(l) > 3) as q
      from bookmarks b where b.user_id = ${userId} and b.tweet_id = ${tweetId}
    ),
    src_tags as (
      select tag_id from bookmark_tags where user_id = ${userId} and tweet_id = ${tweetId}
    )
    select b.tweet_id, b.sort_key, b.first_seen_at, b.removed_at, b.note, b.pinned, b.ai_summary,
      (select count(*) from bookmark_tags bt where bt.user_id = b.user_id and bt.tweet_id = b.tweet_id
         and bt.tag_id in (select tag_id from src_tags)) * 0.15
      + coalesce(ts_rank(b.search_en, to_tsquery('english', (select q from src))), 0) as score
    from bookmarks b
    where b.user_id = ${userId} and b.tweet_id <> ${tweetId} and b.removed_at is null
      and (
        exists (select 1 from bookmark_tags bt where bt.user_id = b.user_id and bt.tweet_id = b.tweet_id and bt.tag_id in (select tag_id from src_tags))
        or ((select q from src) is not null and b.search_en @@ to_tsquery('english', (select q from src)))
      )
    order by score desc, b.sort_key desc nulls last
    limit ${limit}
  `);
  return hydrateBookmarks(userId, res.rows as unknown as BaseRow[]);
}
