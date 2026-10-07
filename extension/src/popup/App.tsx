import { useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { isActive } from "../shared/storage";
import type { RunState, SyncMode } from "../shared/types";
import { Button, Card, countdown, Dot, fmt, plural, timeAgo, useNow } from "../shared/ui";
import { sendToWorker, useStore, type StoreState } from "../shared/useStore";

type Conn =
  | { state: "checking" }
  | { state: "ok"; bookmarks?: number }
  | { state: "bad"; message: string }
  | { state: "none" };

function useConnection(troveUrl: string, token: string, loaded: boolean): Conn {
  const [conn, setConn] = useState<Conn>({ state: "checking" });
  useEffect(() => {
    if (!loaded) return;
    if (!token) {
      setConn({ state: "none" });
      return;
    }
    let alive = true;
    setConn({ state: "checking" });
    api
      .ping({ troveUrl, token })
      .then((r) => alive && setConn({ state: "ok", bookmarks: r.bookmarks }))
      .catch((err: unknown) => {
        if (!alive) return;
        const message =
          err instanceof ApiError && err.status === 401
            ? "Import token rejected"
            : err instanceof ApiError && err.status === 0
              ? "Trove is unreachable"
              : err instanceof Error
                ? err.message
                : "Connection failed";
        setConn({ state: "bad", message });
      });
    return () => {
      alive = false;
    };
  }, [troveUrl, token, loaded]);
  return conn;
}

export function App() {
  const store = useStore();
  const conn = useConnection(store.troveUrl, store.token, store.loaded);
  const now = useNow(1000);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Ask the worker to check whether a run it thinks is active is still alive.
  useEffect(() => {
    void sendToWorker({ type: "reconcile" }).catch(() => undefined);
  }, []);

  async function act(message: Parameters<typeof sendToWorker>[0]) {
    setError(null);
    setBusy(true);
    try {
      const res = await sendToWorker(message);
      if (res && res.ok === false && res.error) setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!store.loaded) return <Shell><p className="text-muted text-sm">Loading</p></Shell>;

  return (
    <Shell>
      <header className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Trove</h1>
        <ConnectionLine conn={conn} />
      </header>

      {!store.token ? (
        <Card>
          <p className="text-sm">Add your Trove import token to start syncing.</p>
          <Button onClick={() => chrome.runtime.openOptionsPage()}>Open Options</Button>
        </Card>
      ) : (
        <>
          <TemplateStatus store={store} now={now} />
          <RunPanel store={store} now={now} busy={busy} act={act} />
        </>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      <footer className="flex flex-col items-center gap-1 text-xs text-muted">
        <span>{store.lastSync ? `Last sync ${timeAgo(store.lastSync.at, now)}` : "Not synced yet"}</span>
        <Button variant="text" className="text-xs" onClick={() => chrome.runtime.openOptionsPage()}>
          Options
        </Button>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="w-[340px] min-h-[240px] p-5 flex flex-col items-center gap-4 text-center">{children}</main>;
}

function ConnectionLine({ conn }: { conn: Conn }) {
  const [tone, text] =
    conn.state === "ok"
      ? (["ok", conn.bookmarks !== undefined ? `Connected, ${plural(conn.bookmarks, "bookmark", "bookmarks")}` : "Connected"] as const)
      : conn.state === "checking"
        ? (["muted", "Checking connection"] as const)
        : conn.state === "none"
          ? (["warn", "No import token"] as const)
          : (["danger", conn.message] as const);
  return (
    <p className="flex items-center justify-center gap-2 text-xs text-muted">
      <Dot tone={tone} />
      <span>{text}</span>
    </p>
  );
}

function TemplateStatus({ store, now }: { store: StoreState; now: number }) {
  if (store.template) {
    return (
      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <Dot tone="ok" />
        <span>X ready, learned {timeAgo(store.template.capturedAt, now)}</span>
      </p>
    );
  }
  return (
    <Card>
      <p className="text-sm">Open your X bookmarks once so Trove can learn the request format.</p>
      <Button variant="secondary" onClick={() => chrome.tabs.create({ url: "https://x.com/i/bookmarks" })}>
        Open X bookmarks
      </Button>
    </Card>
  );
}

function progressText(run: RunState): string {
  return `Page ${fmt(run.page)}, ${plural(run.received, "bookmark", "bookmarks")} received, ${fmt(run.inserted)} new`;
}

function RunPanel({
  store,
  now,
  busy,
  act,
}: {
  store: StoreState;
  now: number;
  busy: boolean;
  act: (m: Parameters<typeof sendToWorker>[0]) => Promise<void>;
}) {
  const [confirmFull, setConfirmFull] = useState(false);
  const run = store.run;

  if (run && isActive(run)) {
    let headline = "Syncing";
    let detail: string | null = run.page > 0 ? progressText(run) : null;
    if (run.status === "starting") {
      headline = "Starting";
      detail = "Opening X and preparing the run";
    } else if (run.status === "finishing") {
      headline = "Wrapping up";
    } else if (run.status === "waiting" && run.waitUntil) {
      headline = `X rate limit reached, resuming in ${countdown(run.waitUntil - now)}`;
    } else if (run.page === 0) {
      detail = "Fetching the first page";
    }
    return (
      <Card>
        <p className="text-xs uppercase tracking-wide text-muted">{run.mode === "full" ? "Full resync" : "Sync new"}</p>
        <p className="text-sm font-medium">{headline}</p>
        {detail && <p className="text-sm text-muted">{detail}</p>}
        {run.status !== "finishing" && (
          <Button variant="danger" disabled={busy} onClick={() => act({ type: "cancel" })}>
            Cancel
          </Button>
        )}
      </Card>
    );
  }

  if (run?.status === "resumable") {
    return (
      <Card>
        <p className="text-sm font-medium">{run.message}</p>
        {run.page > 0 && <p className="text-sm text-muted">{progressText(run)}</p>}
        <Button disabled={busy || !store.template} onClick={() => act({ type: "resume" })}>
          Resume
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => act({ type: "cancel" })}>
          Cancel sync
        </Button>
      </Card>
    );
  }

  if (run && (run.status === "done" || run.status === "cancelled" || run.status === "error")) {
    const s = run.summary;
    const received = s?.received ?? run.received;
    const inserted = s?.inserted ?? run.inserted;
    const title = run.status === "done" ? "Sync complete" : run.status === "cancelled" ? "Sync cancelled" : "Sync failed";
    return (
      <Card>
        <p className={`text-sm font-semibold ${run.status === "error" ? "text-danger" : ""}`}>{title}</p>
        <p className="text-sm text-muted">
          {plural(received, "bookmark", "bookmarks")} received, {fmt(inserted)} new
          {s && s.removed > 0 ? `, ${fmt(s.removed)} removed from X` : ""}
        </p>
        {run.message && <p className="text-sm text-muted">{run.message}</p>}
        <div className="flex flex-col items-center gap-1">
          {run.status === "done" && <Button onClick={() => chrome.tabs.create({ url: store.troveUrl })}>Open Trove</Button>}
          <Button variant="text" onClick={() => act({ type: "dismiss" })}>
            {run.status === "done" ? "Done" : "Dismiss"}
          </Button>
        </div>
      </Card>
    );
  }

  const ready = !!store.template;
  const start = (mode: SyncMode) => {
    setConfirmFull(false);
    void act({ type: "sync", mode });
  };

  if (confirmFull) {
    return (
      <Card>
        <p className="text-sm font-medium">Full resync walks every bookmark on X.</p>
        <p className="text-sm text-muted">It can take a while and marks anything you unbookmarked as removed.</p>
        <Button disabled={busy || !ready} onClick={() => start("full")}>
          Start full resync
        </Button>
        <Button variant="text" onClick={() => setConfirmFull(false)}>
          Back
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button disabled={busy || !ready} onClick={() => start("incremental")}>
        Sync new
      </Button>
      <Button variant="text" disabled={busy || !ready} onClick={() => setConfirmFull(true)}>
        Full resync
      </Button>
    </div>
  );
}
