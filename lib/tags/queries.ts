import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Facet } from "@/lib/bookmarks/types";

export interface TagSummary extends Facet {
  id: string;
  description: string | null;
  keywords: string | null;
  createdBy: string;
  avatars: string[];
}

/** All of a user's tags with active bookmark counts and up to 3 recent author avatars. */
export async function listUserTags(userId: string): Promise<TagSummary[]> {
  const res = await db.execute(sql`
    select tg.id, tg.slug as value, tg.name as label, tg.color, tg.description, tg.keywords, tg.created_by as "createdBy",
      count(b.tweet_id)::int as count,
      coalesce((
        select array_agg(distinct_avatars.url) from (
          select t2.author_avatar_url as url, max(b2.sort_key) as k
          from bookmark_tags bt2
          join bookmarks b2 on b2.user_id = bt2.user_id and b2.tweet_id = bt2.tweet_id and b2.removed_at is null
          join tweets t2 on t2.id = bt2.tweet_id
          where bt2.tag_id = tg.id and t2.author_avatar_url is not null
          group by t2.author_avatar_url
          order by k desc nulls last
          limit 3
        ) distinct_avatars
      ), '{}') as avatars
    from tags tg
    left join bookmark_tags bt on bt.tag_id = tg.id
    left join bookmarks b on b.user_id = bt.user_id and b.tweet_id = bt.tweet_id and b.removed_at is null
    where tg.user_id = ${userId}
    group by tg.id
    order by count(b.tweet_id) desc, tg.name asc
  `);
  return res.rows as unknown as TagSummary[];
}

export interface AuthorSummary {
  handle: string;
  name: string | null;
  avatar: string | null;
  verified: boolean;
  count: number;
}

export async function listAuthors(userId: string): Promise<AuthorSummary[]> {
  const res = await db.execute(sql`
    select t.author_handle_lc as handle,
      (array_agg(t.author_name order by t.updated_at desc))[1] as name,
      (array_agg(t.author_avatar_url order by t.updated_at desc))[1] as avatar,
      bool_or(t.author_verified) as verified,
      count(*)::int as count
    from bookmarks b join tweets t on t.id = b.tweet_id
    where b.user_id = ${userId} and b.removed_at is null and t.author_handle_lc is not null
    group by t.author_handle_lc
    order by count(*) desc, t.author_handle_lc asc
  `);
  return res.rows as unknown as AuthorSummary[];
}
