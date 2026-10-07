// Single-owner session: a password from TROVE_PASSWORD and an HMAC-signed cookie.
// Uses Web Crypto so the same code runs in the proxy and in route handlers.

export const SESSION_COOKIE = "trove_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Every table is keyed by user_id; a single owner keeps the door open for multi-user later. */
export const OWNER_ID = process.env.TROVE_OWNER_ID || "owner";

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.TROVE_PASSWORD;
  if (!s) throw new Error("TROVE_PASSWORD is not set");
  return s;
}

const enc = new TextEncoder();

function toBase64Url(buf: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cookie value: `<expiresEpochSeconds>.<signature>`. */
export async function createSessionValue(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  return `${exp}.${await hmac(`${OWNER_ID}.${exp}`)}`;
}

export async function verifySessionValue(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await hmac(`${OWNER_ID}.${exp}`));
  } catch {
    return false;
  }
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.TROVE_PASSWORD;
  if (!expected) return false;
  // Compare digests so timing does not leak length or content.
  const [a, b] = await Promise.all([hmac(`pw:${input}`), hmac(`pw:${expected}`)]);
  return safeEqual(a, b);
}
