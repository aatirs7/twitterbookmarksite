import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * A per-user lease so only one worker (cron, after(), or the settings page) sorts with Claude at once.
 * Two workers would pick the same pending bookmarks and pay for them twice.
 */
export async function acquireTaggingLease(userId: string, ms: number): Promise<boolean> {
  const res = await db.execute(sql`
    insert into user_settings (user_id, tagging_lease_until, updated_at)
    values (${userId}, now() + make_interval(secs => ${ms / 1000}), now())
    on conflict (user_id) do update set tagging_lease_until = now() + make_interval(secs => ${ms / 1000})
    where user_settings.tagging_lease_until is null or user_settings.tagging_lease_until < now()
    returning user_id
  `);
  return res.rows.length > 0;
}

/** Extends a lease this worker already holds. */
export async function renewTaggingLease(userId: string, ms: number) {
  await db.execute(sql`
    update user_settings set tagging_lease_until = now() + make_interval(secs => ${ms / 1000}) where user_id = ${userId}
  `);
}

export async function releaseTaggingLease(userId: string) {
  await db.execute(sql`update user_settings set tagging_lease_until = null where user_id = ${userId}`);
}
