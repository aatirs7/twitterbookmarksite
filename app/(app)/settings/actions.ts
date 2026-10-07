"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { bookmarkTags, bookmarks, importTokens, tags } from "@/db/schema";
import Anthropic from "@anthropic-ai/sdk";
import { saveAnthropicKey } from "@/lib/ai/apiKey";
import { tagBookmarks } from "@/lib/ai/tagBookmarks";
import { createImportToken } from "@/lib/auth/importToken";
import { requireUser } from "@/lib/auth/user";
import { rebuildSearchDocs } from "@/lib/searchDoc";
import { TAG_PALETTE, colorForSlug, slugify } from "@/lib/tags/palette";

export async function createTokenAction(name: string) {
  const userId = await requireUser();
  const created = await createImportToken(userId, name);
  revalidatePath("/settings");
  return { token: created.token, prefix: created.prefix };
}

export async function revokeTokenAction(id: string) {
  const userId = await requireUser();
  await db
    .update(importTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(importTokens.id, id), eq(importTokens.userId, userId), isNull(importTokens.revokedAt)));
  revalidatePath("/settings");
}

async function tweetIdsForTag(userId: string, tagId: string) {
  const rows = await db
    .select({ tweetId: bookmarkTags.tweetId })
    .from(bookmarkTags)
    .where(and(eq(bookmarkTags.userId, userId), eq(bookmarkTags.tagId, tagId)));
  return rows.map((r) => r.tweetId);
}

async function ownedTag(userId: string, id: string) {
  const [tag] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).limit(1);
  if (!tag) throw new Error("Tag not found");
  return tag;
}

export async function updateTagAction(id: string, patch: { name?: string; description?: string; keywords?: string; color?: string }) {
  const userId = await requireUser();
  const tag = await ownedTag(userId, id);
  const set: Partial<typeof tags.$inferInsert> = {};
  if (patch.name !== undefined && patch.name.trim()) {
    set.name = patch.name.trim().slice(0, 48);
    const slug = slugify(set.name);
    const [clash] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.userId, userId), eq(tags.slug, slug))).limit(1);
    if (clash && clash.id !== id) throw new Error("A tag with that name already exists. Merge them instead.");
    set.slug = slug;
  }
  if (patch.description !== undefined) set.description = patch.description.trim().slice(0, 300) || null;
  if (patch.keywords !== undefined) set.keywords = patch.keywords.trim().slice(0, 4000) || null;
  if (patch.color !== undefined && (TAG_PALETTE as readonly string[]).includes(patch.color)) set.color = patch.color;
  if (Object.keys(set).length === 0) return;
  await db.update(tags).set(set).where(eq(tags.id, tag.id));
  if (set.name) {
    const ids = await tweetIdsForTag(userId, id);
    if (ids.length) await rebuildSearchDocs(db, userId, ids);
  }
  revalidatePath("/settings");
}

export async function createTagAction(name: string, description: string, keywords = "") {
  const userId = await requireUser();
  const slug = slugify(name);
  if (!slug) throw new Error("Name required");
  await db
    .insert(tags)
    .values({ userId, slug, name: name.trim().slice(0, 48), description: description.trim() || null, keywords: keywords.trim() || null, color: colorForSlug(slug), createdBy: "user" })
    .onConflictDoNothing();
  revalidatePath("/settings");
}

export async function acceptTagAction(id: string) {
  const userId = await requireUser();
  await ownedTag(userId, id);
  await db.update(tags).set({ createdBy: "user" }).where(eq(tags.id, id));
  revalidatePath("/settings");
}

export async function deleteTagAction(id: string) {
  const userId = await requireUser();
  await ownedTag(userId, id);
  const ids = await tweetIdsForTag(userId, id);
  await db.transaction(async (tx) => {
    await tx.delete(tags).where(eq(tags.id, id));
    if (ids.length) await rebuildSearchDocs(tx, userId, ids);
  });
  revalidatePath("/settings");
}

/** Moves every use of `fromId` onto `intoId`, then deletes `fromId`. */
export async function mergeTagsAction(fromId: string, intoId: string) {
  const userId = await requireUser();
  if (fromId === intoId) return;
  await ownedTag(userId, fromId);
  await ownedTag(userId, intoId);
  const ids = await tweetIdsForTag(userId, fromId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into bookmark_tags (user_id, tweet_id, tag_id, source, confidence)
      select user_id, tweet_id, ${intoId}::uuid, source, confidence from bookmark_tags
      where user_id = ${userId} and tag_id = ${fromId}::uuid
      on conflict do nothing
    `);
    await tx.execute(sql`
      insert into bookmark_tag_blocks (user_id, tweet_id, tag_id)
      select user_id, tweet_id, ${intoId}::uuid from bookmark_tag_blocks
      where user_id = ${userId} and tag_id = ${fromId}::uuid
      on conflict do nothing
    `);
    await tx.delete(tags).where(eq(tags.id, fromId));
    if (ids.length) await rebuildSearchDocs(tx, userId, ids);
  });
  revalidatePath("/settings");
}

/** Clears automatic categories so every bookmark is sorted again; categories added by hand stay. */
export async function retagAllAction() {
  const userId = await requireUser();
  await db.transaction(async (tx) => {
    await tx.delete(bookmarkTags).where(and(eq(bookmarkTags.userId, userId), eq(bookmarkTags.source, "ai")));
    await tx.update(bookmarks).set({ taggedAt: null }).where(eq(bookmarks.userId, userId));
  });
  after(async () => {
    try {
      // Keyword rules finish instantly; Claude works through as many as fit, and the hourly job does the rest.
      await tagBookmarks(userId, 100_000, Date.now() + 270_000);
    } catch (err) {
      console.error("[retag] failed", err);
    }
  });
  revalidatePath("/settings");
}

/** Checks the key against the Anthropic API, then stores it encrypted. */
export async function saveAnthropicKeyAction(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUser();
  const key = raw.trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) return { ok: false, error: "That does not look like an Anthropic API key (sk-ant-...)." };
  try {
    await new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15_000 }).models.retrieve("claude-haiku-4-5");
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "Anthropic rejected this key." };
    if (err instanceof Anthropic.PermissionDeniedError) return { ok: false, error: "This key cannot use Claude Haiku 4.5." };
    if (!(err instanceof Anthropic.APIError)) return { ok: false, error: "Could not reach Anthropic to check the key. Try again." };
  }
  await saveAnthropicKey(userId, key);
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeAnthropicKeyAction() {
  const userId = await requireUser();
  await saveAnthropicKey(userId, null);
  revalidatePath("/settings");
}
