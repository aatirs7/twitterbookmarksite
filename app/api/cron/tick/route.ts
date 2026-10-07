import { NextResponse } from "next/server";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, syncRuns } from "@/db/schema";
import { tagBookmarks } from "@/lib/ai/tagBookmarks";

export const maxDuration = 60;

const BUDGET_MS = 50_000;

/**
 * The single hourly cron. Self-gating: each step only runs when there is work,
 * and the tick stops when the 50 s budget is spent.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deadline = Date.now() + BUDGET_MS;
  const report: Record<string, number> = {};

  // 1. Categorize untagged bookmarks (Claude when a key is set, free keyword rules otherwise).
  {
    const users = await db
      .selectDistinct({ userId: bookmarks.userId })
      .from(bookmarks)
      .where(and(isNull(bookmarks.taggedAt), isNull(bookmarks.removedAt)));
    let tagged = 0;
    for (const { userId } of users) {
      if (Date.now() > deadline) break;
      tagged += await tagBookmarks(userId, 100, deadline);
    }
    if (tagged) report.tagged = tagged;
  }

  // 2. Media archiving (phase 3) slots in here.

  // 3. Fail runs stuck in `running` for more than 2 hours.
  if (Date.now() < deadline) {
    const stuck = await db
      .update(syncRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: sql`concat_ws(E'\n', ${syncRuns.error}, 'Timed out: no finish after 2 hours')`,
      })
      .where(and(eq(syncRuns.status, "running"), lt(syncRuns.startedAt, sql`now() - interval '2 hours'`)))
      .returning({ id: syncRuns.id });
    if (stuck.length) report.stuckRuns = stuck.length;
  }

  return NextResponse.json({ ok: true, ...report });
}
