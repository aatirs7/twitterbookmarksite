import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireApiUser } from "@/lib/auth/user";
import { hydrateBookmarks, type BaseRow } from "@/lib/bookmarks/hydrate";
import type { BookmarkItem } from "@/lib/bookmarks/types";
import { tweetUrl } from "@/lib/format";

export const maxDuration = 120;

function toMarkdown(items: BookmarkItem[]): string {
  const out: string[] = [`# XBookmarkVault export`, ``, `${items.length} bookmarks, exported ${new Date().toISOString()}`, ``];
  for (const i of items) {
    const t = i.tweet;
    out.push(`## ${t.authorName ?? t.authorHandle ?? "Unknown"} (@${t.authorHandle ?? "unknown"})`);
    out.push(``);
    out.push(`${tweetUrl(t.authorHandle, t.id)}${t.createdAt ? ` | ${t.createdAt.slice(0, 10)}` : ""}${i.removedAt ? " | removed from X" : ""}`);
    out.push(``);
    if (t.articleTitle) out.push(`**${t.articleTitle}**`, ``);
    out.push(t.text.split("\n").map((l) => `> ${l}`).join("\n"));
    out.push(``);
    if (t.quoted) {
      out.push(`Quoting @${t.quoted.authorHandle ?? "unknown"}:`, ``);
      out.push(t.quoted.text.split("\n").map((l) => `> > ${l}`).join("\n"), ``);
    }
    for (const l of t.links) out.push(`- [${l.title ?? l.url}](${l.url})`);
    for (const m of t.media) out.push(`- ${m.type}: ${m.videoUrl ?? m.url}`);
    if (t.links.length || t.media.length) out.push(``);
    if (i.tags.length) out.push(`Tags: ${i.tags.map((x) => x.name).join(", ")}`, ``);
    if (i.aiSummary) out.push(`Summary: ${i.aiSummary}`, ``);
    if (i.note) out.push(`Note: ${i.note}`, ``);
    out.push(`---`, ``);
  }
  return out.join("\n");
}

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const format = req.nextUrl.searchParams.get("format") === "md" ? "md" : "json";

  const items: BookmarkItem[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const res = await db.execute(sql`
      select tweet_id, sort_key, first_seen_at, removed_at, note, pinned, ai_summary
      from bookmarks where user_id = ${auth.userId}
      order by sort_key desc nulls last, first_seen_at desc
      limit ${pageSize} offset ${offset}
    `);
    const rows = res.rows as unknown as BaseRow[];
    items.push(...(await hydrateBookmarks(auth.userId, rows)));
    if (rows.length < pageSize) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "md") {
    return new NextResponse(toMarkdown(items), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="xbookmarkvault-${stamp}.md"`,
      },
    });
  }
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: items.length, bookmarks: items }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="xbookmarkvault-${stamp}.json"`,
    },
  });
}
