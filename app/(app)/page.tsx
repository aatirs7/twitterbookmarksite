import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Library } from "@/components/library/Library";
import { paramsFromRecord, paramsToSearch } from "@/components/library/params";
import { requireUser } from "@/lib/auth/user";
import { searchBookmarks, searchParamsFrom } from "@/lib/search/buildSql";
import { listUserTags } from "@/lib/tags/queries";

async function loadStats(userId: string) {
  const res = await db.execute(sql`
    select count(*)::int as bookmarks, count(distinct t.author_handle_lc)::int as authors
    from bookmarks b join tweets t on t.id = b.tweet_id
    where b.user_id = ${userId} and b.removed_at is null
  `);
  return res.rows[0] as { bookmarks: number; authors: number };
}

export default async function LibraryPage({ searchParams }: PageProps<"/">) {
  const userId = await requireUser();
  const params = paramsFromRecord(await searchParams);
  const [initial, tags, counts] = await Promise.all([
    searchBookmarks(userId, searchParamsFrom(paramsToSearch(params))),
    listUserTags(userId),
    loadStats(userId),
  ]);
  const allTags = tags.map(({ value, label, count, color }) => ({ value, label, count, color }));
  const stats = { ...counts, tags: tags.filter((t) => t.count > 0).length };
  return <Library initialParams={params} initial={initial} allTags={allTags} stats={stats} />;
}
