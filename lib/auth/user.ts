import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { OWNER_ID, SESSION_COOKIE, verifySessionValue } from "./session";

async function signedIn(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionValue(jar.get(SESSION_COOKIE)?.value);
}

/** For pages: returns the owner id or redirects to the login page. */
export async function requireUser(): Promise<string> {
  if (!(await signedIn())) redirect("/login");
  return OWNER_ID;
}

/** For API routes: returns the owner id, or a 401 response. */
export async function requireApiUser(): Promise<{ userId: string } | { response: NextResponse }> {
  if (!(await signedIn())) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId: OWNER_ID };
}
