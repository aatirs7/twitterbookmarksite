import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookmarkTagBlocks, bookmarkTags, bookmarks, links, media, tags, tweets } from "@/db/schema";
import { rebuildSearchDocs } from "@/lib/searchDoc";
import { colorForSlug, slugify } from "@/lib/tags/palette";
import { ensureSeedTags } from "@/lib/tags/seed";
import { ruleTagBookmarks } from "@/lib/tags/ruleTagBookmarks";
import { getAnthropicKey } from "./apiKey";
import { acquireTaggingLease, releaseTaggingLease, renewTaggingLease } from "./lease";

const MODEL = "claude-haiku-4-5";
const BATCH = 20;

const TOOL: Anthropic.Tool = {
  name: "record_tags",
  description: "Record tags and a one sentence summary for every bookmark in the batch.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "tags", "new_tag", "summary"],
          properties: {
            id: { type: "string", description: "The bookmark id exactly as given" },
            tags: {
              type: "array",
              description: "1 to 3 existing tag slugs, most relevant first",
              items: { type: "string" },
            },
            new_tag: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "description"],
                  properties: { name: { type: "string" }, description: { type: "string" } },
                },
              ],
            },
            summary: { type: "string", description: "One sentence, max 140 characters" },
          },
        },
      },
    },
  },
};

interface ToolItem {
  id: string;
  tags: string[];
  new_tag: { name: string; description: string } | null;
  summary: string;
}

const EM_DASH = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, "g");
const EN_DASH = new RegExp(String.fromCharCode(0x2013), "g");
const ELLIPSIS = String.fromCharCode(0x2026);

function cleanSummary(s: string): string {
  let out = s.replace(EM_DASH, ", ").replace(EN_DASH, "-").replace(/\s+/g, " ").trim();
  if (out.length > 140) out = out.slice(0, 139).replace(/\s+\S*$/, "") + ELLIPSIS;
  return out;
}

async function loadTaxonomy(userId: string) {
  return db
    .select({ id: tags.id, slug: tags.slug, name: tags.name, description: tags.description })
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name));
}

function systemPrompt(taxonomy: { slug: string; name: string; description: string | null }[]) {
  const list = taxonomy.map((t) => `- ${t.slug}: ${t.name}. ${t.description ?? ""}`.trim()).join("\n");
  return `You organize a person's saved X (Twitter) bookmarks into a personal library.

For each bookmark, pick 1 to 3 tags from the taxonomy below, using the slug exactly. Prefer existing tags. Only propose new_tag when nothing in the taxonomy fits and the theme is likely to recur across many bookmarks; otherwise set new_tag to null. When you propose a new tag, you may leave tags empty or include the closest existing tags too.

Also write a summary: one plain sentence of at most 140 characters that says what the bookmark is about and why it might be useful. Do not use em dashes. Do not start with "This tweet" or "The author".

Call record_tags once with an entry for every bookmark id you were given.

Taxonomy:
${list}`;
}

async function loadBatchInput(userId: string, ids: string[]) {
  const rows = await db
    .select({
      tweetId: bookmarks.tweetId,
      handle: tweets.authorHandle,
      text: tweets.text,
      articleTitle: tweets.articleTitle,
      quotedText: sql<string | null>`(select q.text from tweets q where q.id = ${tweets.quotedTweetId})`,
    })
    .from(bookmarks)
    .innerJoin(tweets, eq(tweets.id, bookmarks.tweetId))
    .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.tweetId, ids)));
  const linkRows = await db
    .select({ tweetId: links.tweetId, title: links.title, domain: links.domain })
    .from(links)
    .where(inArray(links.tweetId, ids));
  const mediaRows = await db
    .select({ tweetId: media.tweetId, type: media.type })
    .from(media)
    .where(inArray(media.tweetId, ids));

  return rows.map((r) => ({
    id: r.tweetId,
    author: r.handle ? `@${r.handle}` : null,
    text: (r.text ?? "").slice(0, 1500),
    article_title: r.articleTitle ?? undefined,
    quoted_text: r.quotedText ? r.quotedText.slice(0, 500) : undefined,
    links: linkRows
      .filter((l) => l.tweetId === r.tweetId)
      .map((l) => [l.title, l.domain].filter(Boolean).join(" | ")),
    media: [...new Set(mediaRows.filter((m) => m.tweetId === r.tweetId).map((m) => m.type))],
  }));
}

async function tagBatch(client: Anthropic, userId: string, ids: string[]) {
  const taxonomy = await loadTaxonomy(userId);
  const input = await loadBatchInput(userId, ids);
  if (input.length === 0) return 0;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: systemPrompt(taxonomy), cache_control: { type: "ephemeral" } }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: `Bookmarks:\n${JSON.stringify(input)}` }],
  });

  const block = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) throw new Error(`No tool call (stop_reason=${response.stop_reason})`);
  const items = ((block.input as { items?: ToolItem[] }).items ?? []).filter((i) => ids.includes(i.id));

  const bySlug = new Map(taxonomy.map((t) => [t.slug, t.id]));
  const blocks = await db
    .select({ tweetId: bookmarkTagBlocks.tweetId, tagId: bookmarkTagBlocks.tagId })
    .from(bookmarkTagBlocks)
    .where(and(eq(bookmarkTagBlocks.userId, userId), inArray(bookmarkTagBlocks.tweetId, ids)));
  const blocked = new Set(blocks.map((b) => `${b.tweetId}:${b.tagId}`));

  // Create proposed tags first (shared across the batch).
  for (const item of items) {
    if (!item.new_tag?.name) continue;
    const slug = slugify(item.new_tag.name);
    if (!slug || bySlug.has(slug)) continue;
    const [created] = await db
      .insert(tags)
      .values({
        userId,
        slug,
        name: item.new_tag.name.trim().slice(0, 48),
        description: cleanSummary(item.new_tag.description ?? ""),
        color: colorForSlug(slug),
        createdBy: "ai",
      })
      .onConflictDoNothing()
      .returning({ id: tags.id });
    if (created) bySlug.set(slug, created.id);
  }

  const seen = new Set<string>();
  await db.transaction(async (tx) => {
    for (const item of items) {
      const slugs = [...item.tags];
      if (item.new_tag?.name) slugs.push(slugify(item.new_tag.name));
      const tagIds = [...new Set(slugs.map((s) => bySlug.get(s.toLowerCase())).filter((x): x is string => !!x))]
        .filter((tagId) => !blocked.has(`${item.id}:${tagId}`))
        .slice(0, 3);

      // Replace previous AI tags; user tags are never touched.
      await tx
        .delete(bookmarkTags)
        .where(and(eq(bookmarkTags.userId, userId), eq(bookmarkTags.tweetId, item.id), eq(bookmarkTags.source, "ai")));
      if (tagIds.length) {
        await tx
          .insert(bookmarkTags)
          .values(tagIds.map((tagId, i) => ({ userId, tweetId: item.id, tagId, source: "ai", confidence: 1 - i * 0.2 })))
          .onConflictDoNothing();
      }
      await tx
        .update(bookmarks)
        .set({ aiSummary: cleanSummary(item.summary ?? "") || null, taggedAt: new Date() })
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.tweetId, item.id)));
      seen.add(item.id);
    }
    // Anything the model skipped is marked tagged so it does not loop forever.
    const missed = ids.filter((id) => !seen.has(id));
    if (missed.length) {
      await tx
        .update(bookmarks)
        .set({ taggedAt: new Date() })
        .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.tweetId, missed)));
    }
    await rebuildSearchDocs(tx, userId, ids);
  });
  return seen.size;
}

/**
 * Tags untagged active bookmarks for a user. With an Anthropic key (saved in Settings, or ANTHROPIC_API_KEY),
 * uses Claude (up to `limit`, 20 per call);
 * otherwise the free keyword categorizer handles everything pending.
 * Stops early when `deadline` (epoch ms) passes. Returns the number processed.
 */
export async function tagBookmarks(userId: string, limit: number, deadline?: number): Promise<number> {
  return (await runTagging(userId, limit, deadline)).done;
}

const LEASE_MS = 90_000;

/** Same as tagBookmarks, but also reports when another worker already holds the Claude lease. */
export async function runTagging(userId: string, limit: number, deadline?: number): Promise<{ done: number; busy: boolean }> {
  await ensureSeedTags(userId);
  // Without an API key, use the free keyword categorizer. It is cheap, so it takes everything pending.
  const { key } = await getAnthropicKey(userId);
  if (!key) return { done: await ruleTagBookmarks(userId, Infinity, deadline), busy: false };

  // Only one Claude worker per user at a time, so the same bookmarks are never paid for twice.
  if (!(await acquireTaggingLease(userId, LEASE_MS))) return { done: 0, busy: true };
  const client = new Anthropic({ apiKey: key });
  let done = 0;
  try {
    while (done < limit) {
      if (deadline && Date.now() > deadline) break;
      const next = await db
        .select({ tweetId: bookmarks.tweetId })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.taggedAt), isNull(bookmarks.removedAt)))
        .orderBy(asc(bookmarks.firstSeenAt), asc(bookmarks.sortKey))
        .limit(Math.min(BATCH, limit - done));
      if (next.length === 0) break;
      await renewTaggingLease(userId, LEASE_MS);
      try {
        const n = await tagBatch(client, userId, next.map((p) => p.tweetId));
        if (n === 0) break;
        done += n;
      } catch (err) {
        console.error("[tagBookmarks] batch failed", err);
        if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.APIConnectionError) break;
        // Anything else (a malformed post, a bad response): sort this batch with keyword rules so it never blocks the queue.
        done += await ruleTagBookmarks(userId, next.length);
      }
    }
  } finally {
    await releaseTaggingLease(userId);
  }
  return { done, busy: false };
}
