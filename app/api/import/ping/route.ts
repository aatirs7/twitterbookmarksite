import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { importPreflight, importRoute } from "@/lib/http/importRoute";

export const OPTIONS = importPreflight;

export const GET = importRoute(async ({ userId }) => {
  const [row] = await db
    .select({ n: count() })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.removedAt)));
  return { ok: true, user: { id: userId }, bookmarks: row?.n ?? 0 };
});
