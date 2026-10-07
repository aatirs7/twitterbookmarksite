import "server-only";
import { NextResponse } from "next/server";
import { authenticateImportRequest, ImportAuthError } from "@/lib/auth/importToken";

function allowedOrigins(): string[] {
  return (process.env.EXTENSION_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("<"));
}

/** Returns the origin to echo back, or null when the request origin is not allowed. */
function resolveOrigin(req: Request): { ok: boolean; origin: string | null } {
  const origin = req.headers.get("origin");
  if (!origin) return { ok: true, origin: null };
  const allowed = allowedOrigins();
  if (allowed.length === 0) {
    // Not configured yet: accept any extension origin so first-time setup works.
    return { ok: origin.startsWith("chrome-extension://"), origin };
  }
  return { ok: allowed.includes(origin), origin };
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function importPreflight(req: Request) {
  const { ok, origin } = resolveOrigin(req);
  if (!ok) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

type Handler = (ctx: { req: Request; userId: string }) => Promise<unknown>;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps an import route: CORS check, bearer auth, JSON response, error mapping. */
export function importRoute(handler: Handler) {
  return async (req: Request) => {
    const { ok, origin } = resolveOrigin(req);
    const headers = corsHeaders(origin);
    if (!ok) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    try {
      const { userId } = await authenticateImportRequest(req);
      const body = await handler({ req, userId });
      return NextResponse.json(body, { headers });
    } catch (err) {
      if (err instanceof ImportAuthError) return NextResponse.json({ error: err.message }, { status: 401, headers });
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status, headers });
      console.error("[import]", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500, headers });
    }
  };
}
