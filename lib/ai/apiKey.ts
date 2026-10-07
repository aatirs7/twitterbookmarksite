import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export type KeySource = "user" | "env" | null;

/** The Anthropic key to use for a user: their own saved key first, then the server env key. */
export async function getAnthropicKey(userId: string): Promise<{ key: string | null; source: KeySource; hint: string | null }> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  const own = decryptSecret(row?.anthropicKeyEnc);
  if (own) return { key: own, source: "user", hint: row?.anthropicKeyHint ?? null };
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: "env", hint: null };
  return { key: null, source: null, hint: null };
}

export async function saveAnthropicKey(userId: string, key: string | null) {
  const values = key
    ? { anthropicKeyEnc: encryptSecret(key), anthropicKeyHint: `${key.slice(0, 7)}...${key.slice(-4)}` }
    : { anthropicKeyEnc: null, anthropicKeyHint: null };
  await db
    .insert(userSettings)
    .values({ userId, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...values, updatedAt: new Date() } });
}
