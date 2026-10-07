/**
 * ISOLATED world content script on x.com.
 * Relays messages between MAIN world scripts (capture, runner) and the service worker.
 * The runner is stopped directly by the service worker via chrome.scripting.
 * Also injected on demand by the service worker, so it guards against double install.
 */
import {
  BRIDGE_SOURCE,
  CAPTURE_SOURCE,
  RUNNER_SOURCE,
  type BookmarksTemplate,
  type PageAck,
  type RunnerOutbound,
  type RuntimeMessage,
} from "./shared/types";

declare global {
  interface Window {
    __troveBridgeInstalled?: boolean;
  }
}

(() => {
  if (window.__troveBridgeInstalled) return;
  window.__troveBridgeInstalled = true;

  const toPage = (data: Record<string, unknown>) => window.postMessage({ source: BRIDGE_SOURCE, ...data }, location.origin);

  // async so a synchronous throw (extension context invalidated) becomes a rejection.
  async function send(message: RuntimeMessage): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") return;
    const data = event.data as { source?: string };

    if (data.source === CAPTURE_SOURCE) {
      const { template } = event.data as { template: BookmarksTemplate };
      send({ type: "template", template }).catch(() => {
        /* extension reloaded or SW unavailable; capture again next load */
      });
      return;
    }

    if (data.source === RUNNER_SOURCE) {
      const msg = event.data as RunnerOutbound;
      const p = send({ type: "runner", msg });
      if (msg.type !== "page") {
        p.catch(() => {});
        return;
      }
      // Page messages need an ack so the runner knows whether to fetch the next page.
      p.then(
        (ack) => toPage({ type: "ack", requestId: msg.requestId, ack: (ack ?? { continue: false, error: "No reply from extension" }) as PageAck }),
        (err: unknown) =>
          toPage({
            type: "ack",
            requestId: msg.requestId,
            ack: { continue: false, error: `Extension unavailable: ${err instanceof Error ? err.message : String(err)}`, transport: true },
          }),
      );
    }
  });
})();

export {};
