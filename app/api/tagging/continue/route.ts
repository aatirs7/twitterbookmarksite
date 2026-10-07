import { NextResponse } from "next/server";
import { runTagging } from "@/lib/ai/tagBookmarks";
import { requireApiUser } from "@/lib/auth/user";

export const maxDuration = 60;

/**
 * Sorts pending bookmarks for up to ~45 s. The settings page calls this in a loop while a recategorize
 * is in progress, so it finishes in minutes instead of waiting on the hourly job. Only bookmarks already
 * queued are processed, and the lease means at most one worker spends credits at a time.
 */
export async function POST() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const result = await runTagging(auth.userId, 1000, Date.now() + 45_000);
  return NextResponse.json(result);
}
