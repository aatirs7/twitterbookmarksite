// Dev smoke test: ingests the synthetic fixture for a throwaway user, runs searches, cleans up.
// Run with: pnpm smoke
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const fs = await import("node:fs");
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const { parseBookmarksResponse } = await import("@/lib/x/timeline");
  const { ingestEntries } = await import("@/lib/import/ingest");
  const { startRun, finishRun } = await import("@/lib/import/runs");
  const { searchBookmarks } = await import("@/lib/search/buildSql");
  const { addTag } = await import("@/lib/bookmarks/mutations");
  const { relatedBookmarks } = await import("@/lib/bookmarks/related");

  const userId = `smoke_${Date.now()}`;
  const page = parseBookmarksResponse(JSON.parse(fs.readFileSync("tests/fixtures/synthetic-page.json", "utf8")));
  const check = (label: string, ok: boolean, extra?: unknown) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}`, extra ?? "");
    if (!ok) process.exitCode = 1;
  };

  try {
    const run1 = await startRun(userId, "incremental");
    const r1 = await ingestEntries({ userId, runId: run1, mode: "incremental", entries: page.entries, page: 1 });
    check("first ingest inserts 8", r1.inserted === 8 && r1.caughtUp === false, r1);
    const r2 = await ingestEntries({ userId, runId: run1, mode: "incremental", entries: page.entries, page: 2 });
    check("second ingest is caughtUp", r2.inserted === 0 && r2.caughtUp === true, r2);
    await finishRun({ userId, runId: run1, completed: true });

    await addTag(userId, "1800000000000000006", { name: "Dev tools" });
    await addTag(userId, "1800000000000000001", { name: "Dev tools" });
    const rel = await relatedBookmarks(userId, "1800000000000000001");
    check("related finds shared-tag bookmark", rel.some((i) => i.tweetId === "1800000000000000006"), rel.map((i) => i.tweetId));
    const relText = await relatedBookmarks(userId, "1800000000000000002");
    check("related runs on text-only bookmark", Array.isArray(relText), relText.length);

    const s = async (q: string, extra: Record<string, unknown> = {}) => searchBookmarks(userId, { q, ...extra });
    let res = await s("claude code");
    check("'claude code' finds plain tweet first", res.items[0]?.tweetId === "1800000000000000001", res.items.map((i) => i.tweetId));
    check("headline has sentinels", !!res.items[0]?.headline?.includes("\u0001"), res.items[0]?.headline);
    res = await s("cla");
    check("prefix 'cla' matches", res.total >= 1, res.total);
    res = await s("from:photog");
    check("from:photog", res.total === 1 && res.items[0].tweetId === "1800000000000000004", res.total);
    res = await s("has:video");
    check("has:video", res.total === 1 && res.items[0].tweet.media[0].videoUrl?.includes("v_high") === true, res.total);
    res = await s("site:github.com");
    check("site:github.com", res.total === 1 && res.items[0].tweet.links[0].title === "Great Repo", res.total);
    res = await s("claude -agents");
    check("-agents excludes", res.items.every((i) => i.tweetId !== "1800000000000000001"), res.items.map((i) => i.tweetId));
    res = await s("tag:dev-tools");
    check("tag:dev-tools", res.total === 2, res.total);
    res = await s("original quoted");
    check("quoted text searchable", res.items[0]?.tweetId === "1800000000000000003" && !!res.items[0].tweet.quoted, res.items.map((i) => i.tweetId));
    res = await s("long article");
    check("article title searchable", res.items.some((i) => i.tweetId === "1800000000000000008"), res.total);
    res = await s("explaining");
    check("english stemming (explaining -> explains)", res.items.some((i) => i.tweetId === "1800000000000000002"), res.total);
    res = await s("studoi");
    check("fuzzy fallback", res.fuzzy === true, { fuzzy: res.fuzzy, total: res.total });
    res = await s("");
    check("empty query lists all, newest first", res.total === 8 && res.items[0].tweetId === "1800000000000000001", res.total);
    check("facets", res.facets.authors.length > 0 && res.facets.domains.some((d) => d.value === "github.com"), res.facets);

    // Full resync that only sees half the bookmarks removes the rest.
    const run2 = await startRun(userId, "full");
    await ingestEntries({ userId, runId: run2, mode: "full", entries: page.entries.slice(0, 4), page: 1 });
    const fin = await finishRun({ userId, runId: run2, completed: true });
    check("full resync removes 4", fin.removed === 4, fin.removed);
    res = await s("");
    check("removed hidden by default", res.total === 4, res.total);
    res = await s("", { removed: "only" });
    check("removed=only shows 4", res.total === 4, res.total);

    const t0 = Date.now();
    await s("claude code");
    console.log(`search latency ${Date.now() - t0} ms (tiny dataset, includes network)`);
  } finally {
    await db.execute(sql`delete from bookmark_tags where user_id = ${userId}`);
    await db.execute(sql`delete from bookmark_tag_blocks where user_id = ${userId}`);
    await db.execute(sql`delete from tags where user_id = ${userId}`);
    await db.execute(sql`delete from bookmarks where user_id = ${userId}`);
    await db.execute(sql`delete from sync_runs where user_id = ${userId}`);
    await db.execute(sql`delete from media where tweet_id like '18000000000000000%' or tweet_id like '17000000000000000%'`);
    await db.execute(sql`delete from links where tweet_id like '18000000000000000%' or tweet_id like '17000000000000000%'`);
    await db.execute(sql`delete from tweets where id like '18000000000000000%' or id like '17000000000000000%'`);
    process.exit();
  }
}

main();
