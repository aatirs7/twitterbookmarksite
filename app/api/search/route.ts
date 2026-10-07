import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/user";
import { searchBookmarks, searchParamsFrom } from "@/lib/search/buildSql";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const started = Date.now();
  const result = await searchBookmarks(auth.userId, searchParamsFrom(req.nextUrl.searchParams));
  return NextResponse.json(result, { headers: { "Server-Timing": `db;dur=${Date.now() - started}` } });
}
