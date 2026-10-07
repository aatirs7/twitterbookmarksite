import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookmarkTagBlocks, bookmarkTags, bookmarks, tags } from "@/db/schema";
import { rebuildSearchDocs } from "@/lib/searchDoc";
import { colorForSlug, slugify } from "@/lib/tags/palette";

async function hasBookmark(userId: string, tweetId: string) {
  const [row] = await db
    .select({ tweetId: bookmarks.tweetId })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.tweetId, tweetId)))
    .limit(1);
  return !!row;
}

export async function setNote(userId: string, tweetId: string, note: string | null) {
  if (!(await hasBookmark(userId, tweetId))) return false;
  const value = note && note.trim() ? note.slice(0, 10_000) : null;
  await db.transaction(async (tx) => {
    await tx.update(bookmarks).set({ note: value }).where(and(eq(bookmarks.userId, userId), eq(bookmarks.tweetId, tweetId)));
    await rebuildSearchDocs(tx, userId, [tweetId]);
  });
  return true;
}

export async function setPinned(userId: string, tweetId: string, pinned: boolean) {
  if (!(await hasBookmark(userId, tweetId))) return false;
  await db.update(bookmarks).set({ pinned }).where(and(eq(bookmarks.userId, userId), eq(bookmarks.tweetId, tweetId)));
  return true;
}

/** Adds a tag by slug or name (creating a user tag if needed). Clears any block on it. */
export async function addTag(userId: string, tweetId: string, input: { slug?: string; name?: string }) {
  if (!(await hasBookmark(userId, tweetId))) return null;
  const slug = slugify(input.slug ?? input.name ?? "");
  if (!slug) return null;
  let [tag] = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.slug, slug))).limit(1);
  if (!tag) {
    [tag] = await db
      .insert(tags)
      .values({ userId, slug, name: (input.name ?? input.slug ?? slug).trim().slice(0, 48), color: colorForSlug(slug), createdBy: "user" })
      .onConflictDoUpdate({ target: [tags.userId, tags.slug], set: { slug } })
      .returning();
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(bookmarkTagBlocks)
      .where(and(eq(bookmarkTagBlocks.userId, userId), eq(bookmarkTagBlocks.tweetId, tweetId), eq(bookmarkTagBlocks.tagId, tag.id)));
    await tx
      .insert(bookmarkTags)
      .values({ userId, tweetId, tagId: tag.id, source: "user", confidence: 1 })
      .onConflictDoUpdate({ target: [bookmarkTags.userId, bookmarkTags.tweetId, bookmarkTags.tagId], set: { source: "user" } });
    await rebuildSearchDocs(tx, userId, [tweetId]);
  });
  return { id: tag.id, slug: tag.slug, name: tag.name, color: tag.color, source: "user" as const };
}

/** Removes a tag and records a block so AI tagging never re-adds it. */
export async function removeTag(userId: string, tweetId: string, slug: string) {
  const [tag] = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.slug, slug))).limit(1);
  if (!tag) return false;
  await db.transaction(async (tx) => {
    await tx
      .delete(bookmarkTags)
      .where(and(eq(bookmarkTags.userId, userId), eq(bookmarkTags.tweetId, tweetId), eq(bookmarkTags.tagId, tag.id)));
    await tx.insert(bookmarkTagBlocks).values({ userId, tweetId, tagId: tag.id }).onConflictDoNothing();
    await rebuildSearchDocs(tx, userId, [tweetId]);
  });
  return true;
}
