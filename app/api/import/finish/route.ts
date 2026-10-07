import { after } from "next/server";
import { z } from "zod";
import { HttpError, importPreflight, importRoute } from "@/lib/http/importRoute";
import { finishRun } from "@/lib/import/runs";
import { tagBookmarks } from "@/lib/ai/tagBookmarks";

export const OPTIONS = importPreflight;
export const maxDuration = 300;

const Body = z.object({
  runId: z.uuid(),
  completed: z.boolean(),
  cancelled: z.boolean().optional(),
  error: z.string().max(2000).optional(),
});

export const POST = importRoute(async ({ req, userId }) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Invalid body");
  const run = await finishRun({ userId, ...parsed.data });
  after(async () => {
    try {
      await tagBookmarks(userId, 200);
    } catch (err) {
      console.error("[finish] tagging failed", err);
    }
  });
  return {
    run: {
      id: run.id,
      status: run.status,
      pages: run.pages,
      received: run.received,
      inserted: run.inserted,
      updated: run.updated,
      removed: run.removed,
    },
  };
});
