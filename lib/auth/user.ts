import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const allowCache = new Map<string, boolean>();

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isAllowed(userId: string): Promise<boolean> {
  const cached = allowCache.get(userId);
  if (cached !== undefined) return cached;
  const list = allowedEmails();
  if (list.length === 0) return true;
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
  const ok = emails.some((e) => list.includes(e));
  allowCache.set(userId, ok);
  return ok;
}

/** For pages: returns the Clerk user id or redirects to sign-in / not-allowed. */
export async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await isAllowed(userId))) redirect("/not-allowed");
  return userId;
}

/** For API routes: returns the user id, or a 401/403 response. */
export async function requireApiUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const { userId } = await auth();
  if (!userId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isAllowed(userId))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId };
}
