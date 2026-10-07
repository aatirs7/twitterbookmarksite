import { z } from "zod";
import { HttpError, importPreflight, importRoute } from "@/lib/http/importRoute";
import { ingestEntries } from "@/lib/import/ingest";
import { getOwnedRun } from "@/lib/import/runs";

export const OPTIONS = importPreflight;
export const maxDuration = 60;

const Body = z.object({
  runId: z.uuid(),
  page: z.number().int().nonnegative().optional(),
  entries: z.array(
    z.object({ entryId: z.string(), sortIndex: z.coerce.string(), result: z.unknown() }),
  ).max(500),
});

export const POST = importRoute(async ({ req, userId }) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Invalid body");
  const { runId, page, entries } = parsed.data;
  const run = await getOwnedRun(userId, runId);
  if (run.status !== "running") throw new HttpError(409, `Run is ${run.status}`);
  const r = await ingestEntries({
    userId,
    runId,
    page,
    mode: run.mode === "full" ? "full" : "incremental",
    entries: entries.map((e) => ({ entryId: e.entryId, sortIndex: e.sortIndex, result: e.result })),
  });
  return { received: r.received, inserted: r.inserted, updated: r.updated, skipped: r.skipped, caughtUp: r.caughtUp };
});
