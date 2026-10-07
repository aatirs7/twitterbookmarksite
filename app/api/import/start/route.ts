import { z } from "zod";
import { HttpError, importPreflight, importRoute } from "@/lib/http/importRoute";
import { startRun } from "@/lib/import/runs";

export const OPTIONS = importPreflight;

const Body = z.object({ mode: z.enum(["incremental", "full"]).default("incremental") });

export const POST = importRoute(async ({ req, userId }) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, "Invalid body");
  const runId = await startRun(userId, parsed.data.mode);
  return { runId };
});
