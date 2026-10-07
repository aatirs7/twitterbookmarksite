import { NextResponse } from "next/server";
import { getTaggingStatus } from "@/lib/ai/recategorize";
import { requireApiUser } from "@/lib/auth/user";

/** Progress of categorizing: how many active bookmarks still wait for a category. */
export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await getTaggingStatus(auth.userId));
}
