import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM for small secrets at rest (like a user's Anthropic key).
// The key is derived from SESSION_SECRET, so rotating that secret makes stored values unreadable.

function key(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.TROVE_PASSWORD;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHash("sha256").update(`xbv:secrets:${secret}`).digest();
}

/** Returns `iv.tag.ciphertext`, each base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

/** Returns the plaintext, or null if the value is missing or cannot be decrypted. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const [iv, tag, enc] = value.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
