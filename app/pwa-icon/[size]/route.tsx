import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand/icon";

const SIZES = new Set([192, 512]);

/** Install icons for the web app manifest: /pwa-icon/192 and /pwa-icon/512 (both maskable-safe). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const n = Number((await ctx.params).size);
  if (!SIZES.has(n)) return new Response("Not found", { status: 404 });
  const res = new ImageResponse(<BrandIcon size={n} scale={0.5} />, { width: n, height: n });
  res.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return res;
}
