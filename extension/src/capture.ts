/**
 * MAIN world, document_start on x.com.
 * Watches X's own requests and records the Bookmarks GraphQL request template
 * (URL with queryId/features/fieldToggles, bearer token, optional transaction id).
 */
import { BOOKMARKS_PATH_RE, CAPTURE_SOURCE, type BookmarksTemplate } from "./shared/types";

declare global {
  interface Window {
    __troveCaptureInstalled?: boolean;
  }
}

(() => {
  if (window.__troveCaptureInstalled) return;
  window.__troveCaptureInstalled = true;

  const OPTIONAL_HEADERS = ["x-client-transaction-id"];
  let lastKey = "";
  let lastSent = 0;

  function absolute(url: string | URL): string {
    try {
      return new URL(String(url), location.href).href;
    } catch {
      return String(url);
    }
  }

  function emit(url: string, method: string, headers: Record<string, string>) {
    if (!BOOKMARKS_PATH_RE.test(new URL(url).pathname)) return;
    const authorization = headers["authorization"];
    if (!authorization) return;
    const extraHeaders: Record<string, string> = {};
    for (const name of OPTIONAL_HEADERS) if (headers[name]) extraHeaders[name] = headers[name];

    // Dedupe: same queryId + features + auth within a minute is the same template.
    const u = new URL(url);
    u.searchParams.delete("variables");
    const key = `${u.href}|${authorization}`;
    const now = Date.now();
    if (key === lastKey && now - lastSent < 60_000) return;
    lastKey = key;
    lastSent = now;

    const template: BookmarksTemplate = { url, method: method.toUpperCase(), authorization, extraHeaders };
    window.postMessage({ source: CAPTURE_SOURCE, template }, "*");
  }

  function safeEmit(url: string, method: string, headers: Record<string, string>) {
    try {
      emit(url, method, headers);
    } catch {
      /* never break X */
    }
  }

  /* ---------- XMLHttpRequest ---------- */
  type Tracked = XMLHttpRequest & { __trove?: { url: string; method: string; headers: Record<string, string> } };
  const xhrProto = XMLHttpRequest.prototype;
  const origOpen = xhrProto.open;
  const origSetHeader = xhrProto.setRequestHeader;
  const origSend = xhrProto.send;

  xhrProto.open = function (this: Tracked, method: string, url: string | URL, ...rest: unknown[]) {
    try {
      this.__trove = { url: absolute(url), method, headers: {} };
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (origOpen as any).call(this, method, url, ...rest);
  } as typeof xhrProto.open;

  xhrProto.setRequestHeader = function (this: Tracked, name: string, value: string) {
    try {
      if (this.__trove) this.__trove.headers[name.toLowerCase()] = value;
    } catch {
      /* ignore */
    }
    return origSetHeader.call(this, name, value);
  };

  xhrProto.send = function (this: Tracked, body?: Document | XMLHttpRequestBodyInit | null) {
    const t = this.__trove;
    if (t) safeEmit(t.url, t.method, t.headers);
    return origSend.call(this, body);
  };

  /* ---------- fetch ---------- */
  const origFetch = window.fetch;
  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    try {
      const isRequest = typeof Request !== "undefined" && input instanceof Request;
      const url = absolute(isRequest ? (input as Request).url : (input as string | URL));
      if (BOOKMARKS_PATH_RE.test(new URL(url).pathname)) {
        const headers: Record<string, string> = {};
        if (isRequest) (input as Request).headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
        if (init?.headers) new Headers(init.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
        const method = init?.method ?? (isRequest ? (input as Request).method : "GET");
        safeEmit(url, method, headers);
      }
    } catch {
      /* never break X */
    }
    return origFetch.call(this, input, init);
  } as typeof window.fetch;
})();

export {};
