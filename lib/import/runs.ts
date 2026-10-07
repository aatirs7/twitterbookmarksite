import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, syncRuns } from "@/db/schema";
import { HttpError } from "@/lib/http/importRoute";

export type SyncMode = "incremental" | "full";

export async function startRun(userId: string, mode: SyncMode) {
  await db
    .update(syncRuns)
    .set({ status: "cancelled", finishedAt: new Date(), error: "Superseded by a newer run" })
    .where(and(eq(syncRuns.userId, userId), eq(syncRuns.status, "running")));
  const [run] = await db.insert(syncRuns).values({ userId, mode }).returning({ id: syncRuns.id });
  return run.id;
}

export async function getOwnedRun(userId: string, runId: string) {
  const [run] = await db
    .select()
    .from(syncRuns)
    .where(and(eq(syncRuns.id, runId), eq(syncRuns.userId, userId)))
    .limit(1);
  if (!run) throw new HttpError(404, "Run not found");
  return run;
}

/** Closes a run. Full runs that completed soft-delete bookmarks not seen in the run. */
export async function finishRun(opts: {
  userId: string;
  runId: string;
  completed: boolean;
  cancelled?: boolean;
  error?: string | null;
}) {
  const run = await getOwnedRun(opts.userId, opts.runId);
  let removed = 0;
  if (run.mode === "full" && opts.completed && run.status === "running") {
    const rows = await db
      .update(bookmarks)
      .set({ removedAt: new Date() })
      .where(
        and(
          eq(bookmarks.userId, opts.userId),
          isNull(bookmarks.removedAt),
          sql`${bookmarks.lastSeenRunId} is distinct from ${opts.runId}::uuid`,
        ),
      )
      .returning({ tweetId: bookmarks.tweetId });
    removed = rows.length;
  }
  const status = opts.completed ? "done" : opts.cancelled ? "cancelled" : "failed";
  const [updated] = await db
    .update(syncRuns)
    .set({
      status,
      finishedAt: new Date(),
      removed,
      ...(opts.error ? { error: sql`left(concat_ws(E'\n', ${syncRuns.error}, ${opts.error}), 8000)` } : {}),
    })
    .where(and(eq(syncRuns.id, opts.runId), ne(syncRuns.status, "done")))
    .returning();
  return updated ?? (await getOwnedRun(opts.userId, opts.runId));
}
