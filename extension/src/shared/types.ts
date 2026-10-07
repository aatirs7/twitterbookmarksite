export type SyncMode = "incremental" | "full";

/** The Bookmarks GraphQL request X's own web app made, captured by capture.ts. */
export interface BookmarksTemplate {
  url: string;
  method: string;
  authorization: string;
  /** Optional extra headers such as x-client-transaction-id. */
  extraHeaders: Record<string, string>;
}

export interface StoredTemplate extends BookmarksTemplate {
  capturedAt: number;
}

export interface BookmarkEntry {
  entryId: string;
  sortIndex: string;
  result: unknown;
}

export type RunStatus =
  | "starting"
  | "running"
  | "waiting"
  | "resumable"
  | "finishing"
  | "done"
  | "cancelled"
  | "error";

export interface RunState {
  runId: string;
  mode: SyncMode;
  status: RunStatus;
  /** Cursor of the last page the server accepted; the next fetch starts here. Null means start from the top. */
  lastCursor: string | null;
  /** Number of X pages the server has accepted. */
  page: number;
  received: number;
  inserted: number;
  updated: number;
  tabId: number | null;
  /** True when the extension opened the X tab itself (closed again at the end). */
  createdTab: boolean;
  startedAt: number;
  /** Last time we heard from the runner (page, heartbeat, wait notice). */
  heartbeatAt: number;
  /** Epoch ms when an X rate limit wait ends. */
  waitUntil: number | null;
  /** User facing message for errors or resumable runs. */
  message: string | null;
  /** Set when the run ended and the server returned a summary. */
  summary: RunSummary | null;
}

export interface RunSummary {
  status: string;
  pages: number;
  received: number;
  inserted: number;
  updated: number;
  removed: number;
}

export interface LastSync {
  at: number;
  mode: SyncMode;
  status: RunStatus;
  received: number;
  inserted: number;
}

export interface Settings {
  troveUrl: string;
  token: string;
}

/* ---------- Page <-> bridge messages (window.postMessage) ---------- */

export const CAPTURE_SOURCE = "trove-capture";
export const RUNNER_SOURCE = "trove-runner";
export const BRIDGE_SOURCE = "trove-bridge";

export interface RunnerConfig {
  runId: string;
  mode: SyncMode;
  template: BookmarksTemplate;
  startCursor: string | null;
  /** Page number (1-based) of the first page this runner fetches. */
  startPage: number;
}

export type RunnerOutbound =
  | {
      source: typeof RUNNER_SOURCE;
      type: "page";
      requestId: string;
      runId: string;
      page: number;
      entries: BookmarkEntry[];
      /** Cursor to resume from once this page is stored. */
      nextCursor: string | null;
      /** True when the runner already knows this is the last page. */
      last: boolean;
    }
  | { source: typeof RUNNER_SOURCE; type: "waiting"; runId: string; waitUntil: number }
  | { source: typeof RUNNER_SOURCE; type: "done"; runId: string; reason: string }
  | {
      source: typeof RUNNER_SOURCE;
      type: "error";
      runId: string;
      kind: "template" | "auth" | "network" | "parse" | "ack";
      status?: number;
      message: string;
    };

export interface PageAck {
  /** Whether the runner should fetch the next page. */
  continue: boolean;
  caughtUp?: boolean;
  error?: string;
  /** True when the message never reached the service worker (safe to retry). */
  transport?: boolean;
}

/* ---------- Extension runtime messages ---------- */

export type RuntimeMessage =
  | { type: "template"; template: BookmarksTemplate }
  | { type: "runner"; msg: RunnerOutbound }
  | { type: "sync"; mode: SyncMode }
  | { type: "resume" }
  | { type: "cancel" }
  | { type: "dismiss" }
  | { type: "reconcile" };

export const BOOKMARKS_PATH_RE = /\/i\/api\/graphql\/[^/?#]+\/Bookmarks(?:[?#]|$)/;
