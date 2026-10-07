import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/user";
import { ingestEntries } from "@/lib/import/ingest";
import { entriesFromImportFile } from "@/lib/x/timeline";
import { db } from "@/db";
import { syncRuns } from "@/db/schema";
import { finishRun } from "@/lib/import/runs";

export const maxDuration = 300;

/** Manual fallback: accepts a JSON file of entries (or raw Bookmarks GraphQL responses). */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  let json: unknown;
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    json = file instanceof File ? JSON.parse(await file.text()) : await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read JSON" }, { status: 400 });
  }

  const entries = entriesFromImportFile(json);
  if (entries.length === 0) return NextResponse.json({ error: "No entries found in file" }, { status: 400 });

  const [run] = await db.insert(syncRuns).values({ userId, mode: "file" }).returning({ id: syncRuns.id });
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < entries.length; i += 100) {
    const r = await ingestEntries({ userId, runId: run.id, mode: "file", entries: entries.slice(i, i + 100), page: i / 100 + 1 });
    inserted += r.inserted;
    updated += r.updated;
    skipped += r.skipped;
  }
  await finishRun({ userId, runId: run.id, completed: true });
  return NextResponse.json({ received: entries.length, inserted, updated, skipped });
}
