import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { getAnthropicKey } from "./apiKey";

/** A full Claude recategorize costs money, so it can only run once per this window. */
export const CLAUDE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface TaggingStatus {
  total: number;
  pending: number;
  done: number;
  engine: "claude" | "rules";
  /** ISO time when a new full recategorize is allowed again, or null when allowed now. */
  cooldownUntil: string | null;
}

export async function getTaggingStatus(userId: string): Promise<TaggingStatus> {
  const [counts, key, settings] = await Promise.all([
    db.execute(sql`
      select count(*)::int as total, count(*) filter (where tagged_at is null)::int as pending
      from bookmarks where user_id = ${userId} and removed_at is null
    `),
    getAnthropicKey(userId),
    db.select({ last: userSettings.lastClaudeRecategorizeAt }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
  ]);
  const { total, pending } = counts.rows[0] as { total: number; pending: number };
  const engine = key.source ? "claude" : "rules";
  const last = settings[0]?.last?.getTime() ?? 0;
  const until = last + CLAUDE_COOLDOWN_MS;
  return {
    total,
    pending,
    done: total - pending,
    engine,
    cooldownUntil: engine === "claude" && until > Date.now() ? new Date(until).toISOString() : null,
  };
}

/**
 * Atomically claims the Claude recategorize slot. Returns false if another run claimed it within the
 * cooldown window, so two quick clicks (or two tabs) cannot both start a paid run.
 */
export async function claimClaudeRecategorize(userId: string): Promise<boolean> {
  const res = await db.execute(sql`
    insert into user_settings (user_id, last_claude_recategorize_at, updated_at)
    values (${userId}, now(), now())
    on conflict (user_id) do update set last_claude_recategorize_at = now(), updated_at = now()
    where user_settings.last_claude_recategorize_at is null
       or user_settings.last_claude_recategorize_at < now() - make_interval(secs => ${CLAUDE_COOLDOWN_MS / 1000})
    returning user_id
  `);
  return res.rows.length > 0;
}
