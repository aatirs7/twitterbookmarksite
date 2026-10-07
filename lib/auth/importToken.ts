import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { importTokens } from "@/db/schema";

const TOKEN_PREFIX = "trove_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a new import token. The plaintext is returned once and never stored. */
export async function createImportToken(userId: string, name: string) {
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  const [row] = await db
    .insert(importTokens)
    .values({ userId, name: name.trim() || "Extension", tokenHash: hashToken(token), prefix: secret.slice(0, 6) })
    .returning({ id: importTokens.id, prefix: importTokens.prefix, createdAt: importTokens.createdAt });
  return { ...row, token };
}

export class ImportAuthError extends Error {}

/** Resolves the user for a Bearer import token, or throws ImportAuthError. */
export async function authenticateImportRequest(req: Request): Promise<{ userId: string; tokenId: string }> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new ImportAuthError("Missing bearer token");
  const [row] = await db
    .select({ id: importTokens.id, userId: importTokens.userId })
    .from(importTokens)
    .where(and(eq(importTokens.tokenHash, hashToken(match[1])), isNull(importTokens.revokedAt)))
    .limit(1);
  if (!row) throw new ImportAuthError("Invalid or revoked token");
  await db.update(importTokens).set({ lastUsedAt: new Date() }).where(eq(importTokens.id, row.id));
  return { userId: row.userId, tokenId: row.id };
}
