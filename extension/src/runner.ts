/**
 * MAIN world on x.com, injected on demand by the service worker.
 * Paginates X's Bookmarks GraphQL endpoint with the user's own session and hands each
 * page to the service worker (via bridge.ts), waiting for an ack before fetching the next.
 *
 * Injection: the service worker first sets window.__troveRunnerConfig, then injects this file.
 */
import {
  BRIDGE_SOURCE,
  RUNNER_SOURCE,
  type BookmarkEntry,
  type PageAck,
  type RunnerConfig,
  type RunnerOutbound,
} from "./shared/types";

interface RunnerHandle {
  runId: string;
  generation: number;
  stop: () => void;
  isRunning: () => boolean;
}

declare global {
  interface Window {
    __troveRunnerConfig?: RunnerConfig;
    __troveRunner?: RunnerHandle;
    __troveRunnerGeneration?: number;
  }
}

class StopError extends Error {}

class RunnerError extends Error {
  constructor(
    public kind: "template" | "auth" | "network" | "parse" | "ack",
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

(() => {
  const cfg = window.__troveRunnerConfig;
  delete window.__troveRunnerConfig;
  if (!cfg) return;

  // Replace any previous runner in this tab (for example a resume after a stall).
  window.__troveRunner?.stop();
  const generation = (window.__troveRunnerGeneration ?? 0) + 1;
  window.__troveRunnerGeneration = generation;

  let stopped = false;
  let running = true;
  const controller = new AbortController();
  const pendingAcks = new Map<string, (ack: PageAck) => void>();
  const sleepers = new Set<() => void>();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    for (const resolve of pendingAcks.values()) resolve({ continue: false });
    pendingAcks.clear();
    for (const wake of sleepers) wake();
    sleepers.clear();
  };

  window.__troveRunner = { runId: cfg.runId, generation, stop, isRunning: () => running && !stopped };

  const post = (msg: RunnerOutbound) => window.postMessage(msg, location.origin);

  function onMessage(event: MessageEvent) {
    if (event.source !== window || !event.data || event.data.source !== BRIDGE_SOURCE) return;
    const data = event.data as { type: string; requestId?: string; runId?: string; ack?: PageAck };
    if (data.type === "ack" && data.requestId) {
      const resolve = pendingAcks.get(data.requestId);
      if (resolve) {
        pendingAcks.delete(data.requestId);
        resolve(data.ack ?? { continue: false });
      }
    } else if (data.type === "stop" && data.runId === cfg!.runId) {
      stop();
    }
  }
  window.addEventListener("message", onMessage);

  /** Sleep that wakes early (and throws) when the run is stopped. */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (stopped) return reject(new StopError());
      const wake = () => {
        clearTimeout(timer);
        reject(new StopError());
      };
      const timer = setTimeout(() => {
        sleepers.delete(wake);
        resolve();
      }, ms);
      sleepers.add(wake);
    });
  }

  function readCookie(name: string): string {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  }

  let dropExtraHeaders = false;

  function buildRequest(cursor: string | null): { url: string; init: RequestInit } {
    const t = cfg!.template;
    const u = new URL(t.url);
    const variables = JSON.parse(u.searchParams.get("variables") || "{}") as Record<string, unknown>;
    variables.count = 100;
    if (cursor) variables.cursor = cursor;
    else delete variables.cursor;

    const headers: Record<string, string> = {
      ...(dropExtraHeaders ? {} : t.extraHeaders),
      authorization: t.authorization,
      "x-csrf-token": readCookie("ct0"),
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "content-type": "application/json",
    };

    if (t.method === "POST") {
      // Rare: send the same params as a JSON body.
      const body: Record<string, unknown> = { variables, queryId: u.pathname.split("/").at(-2) };
      for (const key of ["features", "fieldToggles"]) {
        const v = u.searchParams.get(key);
        if (v) body[key] = JSON.parse(v);
      }
      return {
        url: u.origin + u.pathname,
        init: { method: "POST", headers, body: JSON.stringify(body), credentials: "include", signal: controller.signal },
      };
    }
    u.searchParams.set("variables", JSON.stringify(variables));
    return { url: u.href, init: { method: "GET", headers, credentials: "include", signal: controller.signal } };
  }

  interface ParsedPage {
    entries: BookmarkEntry[];
    nextCursor: string | null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parsePage(json: any): ParsedPage {
    const instructions = json?.data?.bookmark_timeline_v2?.timeline?.instructions;
    if (!Array.isArray(instructions)) {
      const err = Array.isArray(json?.errors) && json.errors[0]?.message ? `: ${json.errors[0].message}` : "";
      throw new RunnerError("parse", `Unexpected response from X${err}`);
    }
    const entries: BookmarkEntry[] = [];
    let nextCursor: string | null = null;
    for (const ins of instructions) {
      const list = [...(Array.isArray(ins?.entries) ? ins.entries : []), ...(ins?.entry ? [ins.entry] : [])];
      for (const entry of list) {
        const content = entry?.content;
        const result = content?.itemContent?.tweet_results?.result;
        if (result) {
          entries.push({ entryId: String(entry.entryId), sortIndex: String(entry.sortIndex), result });
        } else if (content?.cursorType === "Bottom" && typeof content.value === "string") {
          nextCursor = content.value;
        }
      }
    }
    return { entries, nextCursor };
  }

  let rateRemaining: number | null = null;
  let rateReset: number | null = null;

  async function waitForRateLimit(resetEpochSec: number | null) {
    const until = resetEpochSec ? resetEpochSec * 1000 + 5000 : Date.now() + 60_000;
    post({ source: RUNNER_SOURCE, type: "waiting", runId: cfg!.runId, waitUntil: until });
    await sleep(Math.max(0, until - Date.now()));
  }

  async function fetchPage(cursor: string | null): Promise<ParsedPage> {
    let failures = 0;
    let rateWaits = 0;
    for (;;) {
      if (stopped) throw new StopError();
      const { url, init } = buildRequest(cursor);
      let res: Response;
      try {
        res = await fetch(url, init);
      } catch (err) {
        if (stopped) throw new StopError();
        if (++failures > 3) throw new RunnerError("network", `Network error talking to X: ${String(err)}`);
        await sleep(2000 * failures);
        continue;
      }
      const remaining = res.headers.get("x-rate-limit-remaining");
      const reset = res.headers.get("x-rate-limit-reset");
      rateRemaining = remaining !== null && remaining !== "" ? Number(remaining) : null;
      rateReset = reset ? Number(reset) : null;

      if (res.status === 429) {
        if (++rateWaits > 20) throw new RunnerError("network", "X kept rate limiting the sync", 429);
        await waitForRateLimit(rateReset);
        continue;
      }
      if (res.status === 400 || res.status === 404) {
        // A stale captured x-client-transaction-id can be rejected on its own; retry once without it.
        if (!dropExtraHeaders && Object.keys(cfg!.template.extraHeaders ?? {}).length > 0) {
          dropExtraHeaders = true;
          continue;
        }
        throw new RunnerError("template", "X changed its bookmarks request. Open your X bookmarks again, then retry.", res.status);
      }
      if (res.status === 401 || res.status === 403) {
        throw new RunnerError("auth", "X rejected the request. Make sure you are logged into X, then retry.", res.status);
      }
      if (!res.ok) {
        if (++failures > 3) throw new RunnerError("network", `X responded ${res.status}`, res.status);
        await sleep(2000 * failures);
        continue;
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new RunnerError("parse", "X returned a response that is not JSON");
      }
      return parsePage(json);
    }
  }

  let seq = 0;
  async function sendPage(page: number, entries: BookmarkEntry[], nextCursor: string | null, last: boolean): Promise<PageAck> {
    for (let attempt = 0; ; attempt++) {
      if (stopped) throw new StopError();
      const requestId = `${cfg!.runId}:${page}:${++seq}`;
      const ack = await new Promise<PageAck>((resolve) => {
        const timer = setTimeout(() => {
          pendingAcks.delete(requestId);
          resolve({ continue: false, error: "Timed out waiting for the extension", transport: true });
        }, 5 * 60_000);
        pendingAcks.set(requestId, (a) => {
          clearTimeout(timer);
          resolve(a);
        });
        post({ source: RUNNER_SOURCE, type: "page", requestId, runId: cfg!.runId, page, entries, nextCursor, last });
      });
      // A transport failure means the service worker never saw the page; retry a few times.
      if (ack.transport && attempt < 3) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (ack.transport) throw new RunnerError("ack", ack.error ?? "Lost contact with the extension");
      return ack;
    }
  }

  async function run() {
    let cursor = cfg!.startCursor;
    let page = cfg!.startPage;
    for (;;) {
      const { entries, nextCursor } = await fetchPage(cursor);
      if (entries.length === 0) {
        post({ source: RUNNER_SOURCE, type: "done", runId: cfg!.runId, reason: "No more bookmarks" });
        return;
      }
      const last = !nextCursor || nextCursor === cursor;
      const ack = await sendPage(page, entries, last ? null : nextCursor, last);
      if (!ack.continue || last) return; // the service worker finishes the run
      cursor = nextCursor;
      page++;
      if (rateRemaining === 0) await waitForRateLimit(rateReset);
      else await sleep(1000 + Math.random() * 500);
    }
  }

  run()
    .catch((err: unknown) => {
      if (err instanceof StopError || stopped) return;
      const e = err instanceof RunnerError ? err : new RunnerError("parse", String(err));
      post({ source: RUNNER_SOURCE, type: "error", runId: cfg!.runId, kind: e.kind, status: e.status, message: e.message });
    })
    .finally(() => {
      running = false;
      window.removeEventListener("message", onMessage);
      if (window.__troveRunner?.generation === generation) delete window.__troveRunner;
    });
})();

export {};
