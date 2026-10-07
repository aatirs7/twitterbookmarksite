import { getSettings } from "./storage";
import type { BookmarkEntry, RunSummary, SyncMode } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
  /** Network errors (status 0) and 5xx are worth retrying. */
  get transient(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CallOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** Extra attempts for transient failures. */
  retries?: number;
  /** Override settings (used by Options "Test connection" before saving). */
  troveUrl?: string;
  token?: string;
}

export async function callTrove<T>(path: string, opts: CallOptions = {}): Promise<T> {
  const settings = await getSettings();
  const base = opts.troveUrl ?? settings.troveUrl;
  const token = opts.token ?? settings.token;
  if (!token) throw new ApiError(401, "No import token set. Add one in Options.");
  const retries = opts.retries ?? 3;

  let attempt = 0;
  for (;;) {
    try {
      return await once<T>(base + path, token, opts);
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError(0, String(err));
      if (!e.transient || attempt >= retries) throw e;
      attempt++;
      await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 500);
    }
  }
}

async function once<T>(url: string, token: string, opts: CallOptions): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach XBookmarkVault (${err instanceof Error ? err.message : String(err)})`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non JSON body */
  }
  if (!res.ok) {
    const serverError =
      json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : "";
    throw new ApiError(res.status, serverError || `XBookmarkVault responded ${res.status}`);
  }
  return json as T;
}

export interface PingResponse {
  ok: boolean;
  user: { id?: string; handle?: string };
  bookmarks?: number;
}

export interface PageResponse {
  received: number;
  inserted: number;
  updated: number;
  skipped?: number;
  caughtUp: boolean;
}

export const api = {
  ping: (o?: Pick<CallOptions, "troveUrl" | "token">) =>
    callTrove<PingResponse>("/api/import/ping", { ...o, retries: 0 }),
  start: (mode: SyncMode) => callTrove<{ runId: string }>("/api/import/start", { method: "POST", body: { mode } }),
  page: (runId: string, page: number, entries: BookmarkEntry[]) =>
    callTrove<PageResponse>("/api/import/page", { method: "POST", body: { runId, page, entries } }),
  finish: (body: { runId: string; completed: boolean; cancelled?: boolean; error?: string }) =>
    callTrove<{ run: RunSummary & { id: string } }>("/api/import/finish", { method: "POST", body }),
};

const MAX_BYTES = 3 * 1024 * 1024;
const encoder = new TextEncoder();

function sizeOf(runId: string, page: number, entries: BookmarkEntry[]): number {
  return encoder.encode(JSON.stringify({ runId, page, entries })).length;
}

/**
 * Splits a page so every request body stays under 3 MB: whole page if it fits,
 * otherwise chunks of 25, and any chunk still too large is halved until it fits.
 */
export function chunkEntries(runId: string, page: number, entries: BookmarkEntry[]): BookmarkEntry[][] {
  if (entries.length === 0 || sizeOf(runId, page, entries) <= MAX_BYTES) return [entries];
  const out: BookmarkEntry[][] = [];
  const split = (chunk: BookmarkEntry[]) => {
    if (chunk.length <= 1 || sizeOf(runId, page, chunk) <= MAX_BYTES) {
      out.push(chunk);
      return;
    }
    const mid = Math.ceil(chunk.length / 2);
    split(chunk.slice(0, mid));
    split(chunk.slice(mid));
  };
  for (let i = 0; i < entries.length; i += 25) split(entries.slice(i, i + 25));
  return out;
}
