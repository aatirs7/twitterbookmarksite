import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/user";
import { setNote } from "@/lib/bookmarks/mutations";

const Body = z.object({ note: z.string().max(10_000).nullable() });

export async function PUT(req: Request, ctx: { params: Promise<{ tweetId: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { tweetId } = await ctx.params;
  const ok = await setNote(auth.userId, tweetId, parsed.data.note);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
