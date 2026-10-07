import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/user";
import { setPinned } from "@/lib/bookmarks/mutations";

const Body = z.object({ pinned: z.boolean() });

export async function PUT(req: Request, ctx: { params: Promise<{ tweetId: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { tweetId } = await ctx.params;
  const ok = await setPinned(auth.userId, tweetId, parsed.data.pinned);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
