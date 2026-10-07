/**
 * Service worker: orchestrates syncs and talks to XBookmarkVault Web.
 *
 * It is stateless on purpose. Every handler reloads the run from chrome.storage.local,
 * because MV3 workers are killed after ~30 s idle and the runner's next page message
 * may be what wakes a fresh worker. Syncs are only ever started by the user.
 */
import { api, ApiError, chunkEntries } from "./shared/api";
import {
  clearRun,
  clearTemplate,
  getRun,
  getSettings,
  getTemplate,
  isActive,
  patchRun,
  setLastSync,
  setRun,
  setTemplate,
} from "./shared/storage";
import {
  BOOKMARKS_PATH_RE,
  type BookmarksTemplate,
  type PageAck,
  type RunnerConfig,
  type RunnerOutbound,
  type RunState,
  type RuntimeMessage,
  type SyncMode,
} from "./shared/types";

const BOOKMARKS_URL = "https://x.com/i/bookmarks";
const RESUME_MESSAGE = "The sync was interrupted. Resume to continue where it left off.";

/* ---------- tiny mutex so state changes in one worker instance do not interleave ---------- */

let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/* ---------- message routing ---------- */

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  handle(message, sender).then(
    (res) => sendResponse(res),
    (err: unknown) => sendResponse({ ok: false, error: errMsg(err) }),
  );
  return true; // async response
});

async function handle(message: RuntimeMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "template":
      return onTemplate(message.template, sender);
    case "runner":
      return onRunnerMessage(message.msg, sender);
    case "sync":
      return startSync(message.mode);
    case "resume":
      return resume();
    case "cancel":
      return cancel();
    case "dismiss":
      return dismiss();
    case "reconcile":
      return { ok: true, run: await reconcile() };
    default:
      return { ok: false, error: "Unknown message" };
  }
}

/* ---------- template capture ---------- */

function isXTab(sender: chrome.runtime.MessageSender): boolean {
  try {
    return !!sender.tab?.url && new URL(sender.tab.url).hostname === "x.com" && sender.id === chrome.runtime.id;
  } catch {
    return false;
  }
}

async function onTemplate(t: BookmarksTemplate, sender: chrome.runtime.MessageSender) {
  if (!isXTab(sender)) return { ok: false };
  let url: URL;
  try {
    url = new URL(t.url);
  } catch {
    return { ok: false };
  }
  if (url.hostname !== "x.com" || !BOOKMARKS_PATH_RE.test(url.pathname)) return { ok: false };
  if (typeof t.authorization !== "string" || !/^Bearer\s+\S+/i.test(t.authorization)) return { ok: false };
  await setTemplate({
    url: t.url,
    method: t.method === "POST" ? "POST" : "GET",
    authorization: t.authorization,
    extraHeaders: t.extraHeaders && typeof t.extraHeaders === "object" ? t.extraHeaders : {},
    capturedAt: Date.now(),
  });
  return { ok: true };
}

/* ---------- tabs and injection ---------- */

function waitForTabComplete(tabId: number, timeoutMs = 45_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("X took too long to load"));
    }, timeoutMs);
    const onUpdated = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === "complete") {
        cleanup();
        resolve();
      }
    };
    const onRemoved = (id: number) => {
      if (id === tabId) {
        cleanup();
        reject(new Error("The X tab was closed"));
      }
    };
    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === "complete") {
          cleanup();
          resolve();
        }
      },
      () => undefined,
    );
  });
}

/** Finds an open x.com tab, or opens a background one at the bookmarks page. */
async function getXTab(preferredTabId: number | null): Promise<{ tabId: number; created: boolean }> {
  if (preferredTabId !== null) {
    const tab = await chrome.tabs.get(preferredTabId).catch(() => undefined);
    if (tab?.id !== undefined && !tab.discarded && tab.url?.startsWith("https://x.com/")) {
      await waitForTabComplete(tab.id);
      return { tabId: tab.id, created: false };
    }
  }
  const tabs = await chrome.tabs.query({ url: "https://x.com/*" });
  const existing = tabs.find((t) => t.id !== undefined && !t.discarded);
  if (existing?.id !== undefined) {
    await waitForTabComplete(existing.id);
    return { tabId: existing.id, created: false };
  }
  const tab = await chrome.tabs.create({ url: BOOKMARKS_URL, active: false });
  if (tab.id === undefined) throw new Error("Could not open an X tab");
  await waitForTabComplete(tab.id);
  return { tabId: tab.id, created: true };
}

async function injectRunner(tabId: number, cfg: RunnerConfig) {
  // Bridge may be missing in tabs opened before the extension was installed. It guards double install.
  await chrome.scripting.executeScript({ target: { tabId }, files: ["bridge.js"] });
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (c: RunnerConfig) => {
      (window as unknown as { __troveRunnerConfig?: RunnerConfig }).__troveRunnerConfig = c;
    },
    args: [cfg],
  });
  await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["runner.js"] });
}

async function probeRunner(tabId: number, runId: string): Promise<boolean> {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (id: string) => {
        const r = (window as unknown as { __troveRunner?: { runId: string; isRunning: () => boolean } }).__troveRunner;
        return !!r && r.runId === id && r.isRunning();
      },
      args: [runId],
    });
    return res?.result === true;
  } catch {
    return false;
  }
}

async function stopRunner(tabId: number | null, runId: string) {
  if (tabId === null) return;
  await chrome.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: (id: string) => {
        const r = (window as unknown as { __troveRunner?: { runId: string; stop: () => void } }).__troveRunner;
        if (r && r.runId === id) r.stop();
      },
      args: [runId],
    })
    .catch(() => undefined);
}

/* ---------- run lifecycle ---------- */

async function requireReady(): Promise<BookmarksTemplate> {
  const settings = await getSettings();
  if (!settings.token) throw new Error("Add your import token in Options first.");
  const template = await getTemplate();
  if (!template) throw new Error("Open your X bookmarks once so XBookmarkVault can learn the request format.");
  return template;
}

function startSync(mode: SyncMode) {
  return withLock(async () => {
    const current = await reconcileUnlocked();
    if (isActive(current)) throw new Error("A sync is already running.");
    if (current?.status === "resumable") throw new Error("Resume or cancel the interrupted sync first.");
    const template = await requireReady();

    const now = Date.now();
    const run: RunState = {
      runId: "",
      mode,
      status: "starting",
      lastCursor: null,
      page: 0,
      received: 0,
      inserted: 0,
      updated: 0,
      tabId: null,
      createdTab: false,
      startedAt: now,
      heartbeatAt: now,
      waitUntil: null,
      message: null,
      summary: null,
    };
    await setRun(run);

    let tab: { tabId: number; created: boolean };
    let runId: string;
    try {
      tab = await getXTab(null);
      ({ runId } = await api.start(mode));
    } catch (err) {
      await setRun({ ...run, status: "error", message: errMsg(err) });
      throw err;
    }

    const started: RunState = { ...run, runId, status: "running", tabId: tab.tabId, createdTab: tab.created, heartbeatAt: Date.now() };
    await setRun(started);
    try {
      await injectRunner(tab.tabId, { runId, mode, template, startCursor: null, startPage: 1 });
    } catch (err) {
      void completeRun(runId, { completed: false, error: `Could not start the runner in the X tab: ${errMsg(err)}` });
      throw err;
    }
    return { ok: true };
  });
}

function resume() {
  return withLock(async () => {
    const run = await reconcileUnlocked();
    if (!run || run.status !== "resumable") throw new Error("There is no interrupted sync to resume.");
    const template = await requireReady();
    const tab = await getXTab(run.tabId);
    await patchRun(run.runId, {
      status: "running",
      tabId: tab.tabId,
      createdTab: run.createdTab || tab.created,
      heartbeatAt: Date.now(),
      waitUntil: null,
      message: null,
    });
    try {
      await injectRunner(tab.tabId, {
        runId: run.runId,
        mode: run.mode,
        template,
        startCursor: run.lastCursor,
        startPage: run.page + 1,
      });
    } catch (err) {
      await patchRun(run.runId, { status: "resumable", message: `Could not resume: ${errMsg(err)}` });
      throw err;
    }
    return { ok: true };
  });
}

function cancel() {
  return withLock(async () => {
    const run = await getRun();
    if (!run) return { ok: true };
    if (run.status === "starting" && !run.runId) {
      await setRun({ ...run, status: "cancelled", message: null });
      return { ok: true };
    }
    if (!isActive(run) && run.status !== "resumable") return { ok: true };
    if (run.status === "finishing") return { ok: true };
    await patchRun(run.runId, { status: "finishing", waitUntil: null, heartbeatAt: Date.now() });
    await stopRunner(run.tabId, run.runId);
    void completeRun(run.runId, { completed: false, cancelled: true });
    return { ok: true };
  });
}

function dismiss() {
  return withLock(async () => {
    const run = await getRun();
    if (run && (run.status === "done" || run.status === "cancelled" || run.status === "error")) await clearRun();
    return { ok: true };
  });
}

interface Outcome {
  completed: boolean;
  cancelled?: boolean;
  error?: string;
}

/** Tells XBookmarkVault the run is over and records the final state. Safe to call once per run. */
async function completeRun(runId: string, outcome: Outcome) {
  const before = await withLock(async () => {
    const run = await getRun();
    if (!run || run.runId !== runId) return undefined;
    if (run.status === "done" || run.status === "cancelled" || run.status === "error") return undefined;
    return patchRun(runId, { status: "finishing", waitUntil: null, heartbeatAt: Date.now() });
  });
  if (!before) return;

  let summary: RunState["summary"] = null;
  let notifyError: string | null = null;
  try {
    const res = await api.finish({
      runId,
      completed: outcome.completed,
      ...(outcome.cancelled ? { cancelled: true } : {}),
      ...(outcome.error ? { error: outcome.error.slice(0, 2000) } : {}),
    });
    summary = res.run;
  } catch (err) {
    notifyError = errMsg(err);
  }

  const status: RunState["status"] = outcome.completed ? "done" : outcome.cancelled ? "cancelled" : "error";
  let message = outcome.error ?? null;
  if (notifyError) message = [message, `Could not notify XBookmarkVault: ${notifyError}`].filter(Boolean).join(" ");

  await withLock(async () => {
    await patchRun(runId, { status, summary, message, waitUntil: null });
    if (outcome.completed) {
      await setLastSync({
        at: Date.now(),
        mode: before.mode,
        status,
        received: summary?.received ?? before.received,
        inserted: summary?.inserted ?? before.inserted,
      });
    }
  });

  if (before.createdTab && before.tabId !== null) await chrome.tabs.remove(before.tabId).catch(() => undefined);
}

/* ---------- runner messages ---------- */

async function onRunnerMessage(msg: RunnerOutbound, sender: chrome.runtime.MessageSender): Promise<PageAck | { ok: boolean }> {
  const run = await getRun();
  const tabId = sender.tab?.id;
  const valid =
    !!run && run.runId === msg.runId && (run.status === "running" || run.status === "waiting") && tabId === run.tabId && isXTab(sender);

  if (msg.type === "page") {
    if (!valid) return { continue: false };
    return onPage(run!, msg);
  }
  if (!valid) return { ok: false };

  switch (msg.type) {
    case "waiting":
      await withLock(() => patchRun(run!.runId, { status: "waiting", waitUntil: msg.waitUntil, heartbeatAt: Date.now() }));
      return { ok: true };
    case "done":
      void completeRun(run!.runId, { completed: true });
      return { ok: true };
    case "error": {
      if (msg.kind === "template") await clearTemplate();
      void completeRun(run!.runId, { completed: false, error: msg.message });
      return { ok: true };
    }
  }
  return { ok: false };
}

async function onPage(run: RunState, msg: Extract<RunnerOutbound, { type: "page" }>): Promise<PageAck> {
  const proceed = await withLock(async () => {
    const current = await getRun();
    if (!current || current.runId !== run.runId || (current.status !== "running" && current.status !== "waiting")) return false;
    await patchRun(run.runId, { status: "running", waitUntil: null, heartbeatAt: Date.now() });
    return true;
  });
  if (!proceed) return { continue: false };

  let received = 0;
  let inserted = 0;
  let updated = 0;
  let allCaughtUp = true;
  try {
    for (const chunk of chunkEntries(run.runId, msg.page, msg.entries)) {
      const res = await api.page(run.runId, msg.page, chunk);
      received += res.received ?? 0;
      inserted += res.inserted ?? 0;
      updated += res.updated ?? 0;
      if (!res.caughtUp) allCaughtUp = false;
    }
  } catch (err) {
    const message =
      err instanceof ApiError && err.status === 409
        ? "XBookmarkVault closed this sync run. Start a new sync."
        : `Could not send page ${msg.page} to XBookmarkVault: ${errMsg(err)}`;
    void completeRun(run.runId, { completed: false, error: message });
    return { continue: false, error: message };
  }

  const after = await withLock(async () => {
    const current = await getRun();
    if (!current || current.runId !== run.runId) return undefined;
    const stillActive = current.status === "running" || current.status === "waiting";
    // Totals are recorded even if a cancel landed mid-request; the server stored the page.
    return patchRun(run.runId, {
      page: Math.max(current.page, msg.page),
      lastCursor: msg.nextCursor ?? current.lastCursor,
      received: current.received + received,
      inserted: current.inserted + inserted,
      updated: current.updated + updated,
      heartbeatAt: Date.now(),
    }).then((r) => (stillActive ? r : undefined));
  });
  if (!after) return { continue: false };

  const caughtUp = run.mode === "incremental" && allCaughtUp;
  if (msg.last || caughtUp) {
    void completeRun(run.runId, { completed: true });
    return { continue: false, caughtUp };
  }
  return { continue: true, caughtUp: false };
}

/* ---------- resume detection ---------- */

/** If the stored run claims to be active but its runner is gone, mark it resumable. */
async function reconcileUnlocked(): Promise<RunState | undefined> {
  const run = await getRun();
  if (!run) return run;
  if (run.status === "starting") {
    if (Date.now() - run.startedAt < 90_000) return run;
    if (!run.runId) {
      const next: RunState = { ...run, status: "error", message: "The sync did not start. Try again." };
      await setRun(next);
      return next;
    }
  } else if (run.status === "finishing") {
    // The worker died while closing the run. Give up on it rather than leaving it stuck.
    if (Date.now() - run.heartbeatAt < 120_000) return run;
    return patchRun(run.runId, { status: "error", message: "The sync stopped while finishing. XBookmarkVault may not have recorded the end of this run." });
  } else if (run.status !== "running" && run.status !== "waiting") {
    return run;
  }
  // Grace period: the runner may still be being injected.
  if (Date.now() - run.heartbeatAt < 15_000) return run;
  if (run.tabId !== null && (await probeRunner(run.tabId, run.runId))) return run;
  return patchRun(run.runId, { status: "resumable", waitUntil: null, message: RESUME_MESSAGE });
}

const reconcile = () => withLock(reconcileUnlocked);

chrome.tabs.onRemoved.addListener((tabId) => {
  void withLock(async () => {
    const run = await getRun();
    if (run && run.tabId === tabId && (run.status === "running" || run.status === "waiting")) {
      await patchRun(run.runId, { status: "resumable", waitUntil: null, tabId: null, createdTab: false, message: RESUME_MESSAGE });
    }
  });
});

// Browser restart: any runner from the previous session is gone.
chrome.runtime.onStartup.addListener(() => {
  void withLock(async () => {
    const run = await getRun();
    if (run && run.runId && (isActive(run) || run.status === "resumable")) {
      await patchRun(run.runId, { status: "resumable", waitUntil: null, tabId: null, createdTab: false, message: RESUME_MESSAGE });
    }
  });
});

// Every worker start (including restarts mid-run): check whether the runner is still alive.
void reconcile();
