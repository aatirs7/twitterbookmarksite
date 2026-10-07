import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/user";
import { addTag, removeTag } from "@/lib/bookmarks/mutations";

const AddBody = z.object({ slug: z.string().max(64).optional(), name: z.string().max(64).optional() });
const RemoveBody = z.object({ slug: z.string().max(64) });

export async function POST(req: Request, ctx: { params: Promise<{ tweetId: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.slug && !parsed.data.name)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { tweetId } = await ctx.params;
  const tag = await addTag(auth.userId, tweetId, parsed.data);
  return tag ? NextResponse.json({ tag }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ tweetId: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const parsed = RemoveBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { tweetId } = await ctx.params;
  const ok = await removeTag(auth.userId, tweetId, parsed.data.slug);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
