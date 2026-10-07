import "server-only";
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";

/**
 * Rebuilds the weighted search columns for a user's bookmarks.
 *   A: tweet text, user note
 *   B: quoted tweet text, article title, link titles, tag names
 *   C: author handle and name, quoted author, ai summary, link descriptions and domains
 * `search_tsv` and `search_en` are generated columns and update automatically.
 * Pass `tweetIds = null` to rebuild every bookmark for the user.
 */
export async function rebuildSearchDocs(db: DbOrTx, userId: string, tweetIds: string[] | null) {
  if (tweetIds && tweetIds.length === 0) return;
  const filter = tweetIds
    ? sql`and b.tweet_id in (${sql.join(tweetIds.map((id) => sql`${id}`), sql`, `)})`
    : sql``;

  await db.execute(sql`
    with docs as (
      select
        b.user_id,
        b.tweet_id,
        concat_ws(' ', t.text, b.note) as a,
        concat_ws(' ',
          q.text,
          t.article_title,
          (select string_agg(l.title, ' ') from links l where l.tweet_id = t.id),
          (select string_agg(tg.name, ' ')
             from bookmark_tags bt join tags tg on tg.id = bt.tag_id
            where bt.user_id = b.user_id and bt.tweet_id = b.tweet_id)
        ) as b_text,
        concat_ws(' ',
          t.author_handle, t.author_name,
          q.author_handle, q.author_name,
          b.ai_summary,
          (select string_agg(concat_ws(' ', l.description, l.domain), ' ') from links l where l.tweet_id = t.id)
        ) as c
      from bookmarks b
      join tweets t on t.id = b.tweet_id
      left join tweets q on q.id = t.quoted_tweet_id
      where b.user_id = ${userId} ${filter}
    )
    update bookmarks b set
      search_a = docs.a,
      search_b = docs.b_text,
      search_c = docs.c,
      search_text = left(concat_ws(' ', docs.a, docs.b_text, docs.c), 20000)
    from docs
    where b.user_id = docs.user_id and b.tweet_id = docs.tweet_id
  `);
}
