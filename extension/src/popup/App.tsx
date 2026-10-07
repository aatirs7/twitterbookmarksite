import { useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { isActive } from "../shared/storage";
import type { RunState, SyncMode } from "../shared/types";
import { Button, Card, countdown, Dot, extVersion, fmt, Label, plural, ProgressBar, StatStrip, timeAgo, useNow } from "../shared/ui";
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
              ? "XBookmarkVault is unreachable"
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

  if (!store.loaded)
    return (
      <Shell>
        <Header conn={conn} />
        <Label>Loading</Label>
      </Shell>
    );

  return (
    <Shell>
      <Header conn={conn} />

      {!store.token ? (
        <Card label="01 / Setup">
          <p className="text-[13px] text-fg max-w-[260px]">Add your XBookmarkVault import token to start syncing.</p>
          <Button className="w-full" onClick={() => chrome.runtime.openOptionsPage()}>
            Open Options
          </Button>
        </Card>
      ) : (
        <>
          <TemplateStatus store={store} now={now} />
          <RunPanel store={store} now={now} busy={busy} act={act} />
        </>
      )}

      {error && (
        <p className="well w-full px-3 py-2 text-[12px] text-danger wrap-anywhere" role="alert">
          {error}
        </p>
      )}

      <footer className="w-full flex flex-col items-center gap-2 pt-1">
        <div className="rule" />
        <div className="flex items-center justify-center gap-3">
          <span className="label-mono tabular">{store.lastSync ? `Last sync ${timeAgo(store.lastSync.at, now)}` : "Not synced yet"}</span>
          <span aria-hidden className="h-3 w-px bg-line" />
          <Button variant="text" onClick={() => chrome.runtime.openOptionsPage()}>
            Options
          </Button>
        </div>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="grid-bg w-[368px] min-h-[240px] px-4 pt-5 pb-2.5 flex flex-col items-center gap-2.5 text-center">{children}</main>;
}

function Header({ conn }: { conn: Conn }) {
  const version = extVersion();
  return (
    <header className="flex flex-col items-center gap-2.5 pb-1.5">
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="wordmark text-[30px]">XBookmark<span className="italic opacity-60">Vault</span></h1>
        <Label>
          Sync{version && <span className="normal-case"> / v{version}</span>}
        </Label>
      </div>
      <ConnectionLine conn={conn} />
    </header>
  );
}

function ConnectionLine({ conn }: { conn: Conn }) {
  const [tone, label, detail] =
    conn.state === "ok"
      ? (["ok", "Connected", conn.bookmarks !== undefined ? `${plural(conn.bookmarks, "bookmark", "bookmarks")} in XBookmarkVault` : null] as const)
      : conn.state === "checking"
        ? (["muted", "Checking", null] as const)
        : conn.state === "none"
          ? (["warn", "No token", "No import token"] as const)
          : (["danger", "Offline", conn.message] as const);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="well inline-flex items-center justify-center gap-2 rounded-full px-3 py-1">
        <Dot tone={tone} pulse={conn.state === "ok"} />
        <span className="label-mono text-muted">{label}</span>
      </p>
      {detail && <p className="text-[12px] text-muted tabular wrap-anywhere max-w-[300px]">{detail}</p>}
    </div>
  );
}

function TemplateStatus({ store, now }: { store: StoreState; now: number }) {
  if (store.template) {
    return (
      <section className="panel w-full px-4 py-3 flex flex-col items-center gap-1.5">
        <Label>01 / X template</Label>
        <p className="flex items-center justify-center gap-2 text-[13px] text-fg">
          <Dot tone="ok" />
          <span>X ready, learned {timeAgo(store.template.capturedAt, now)}</span>
        </p>
      </section>
    );
  }
  return (
    <Card label="01 / X template">
      <p className="flex items-center justify-center gap-2 text-[13px] text-fg">
        <Dot tone="warn" />
        <span>Not learned yet</span>
      </p>
      <p className="text-[12px] text-muted max-w-[270px]">Open your X bookmarks once so XBookmarkVault can learn the request format.</p>
      <Button variant="secondary" className="w-full" onClick={() => chrome.tabs.create({ url: "https://x.com/i/bookmarks" })}>
        Open X bookmarks
      </Button>
    </Card>
  );
}

function progressText(run: RunState): string {
  return `Page ${fmt(run.page)}, ${plural(run.received, "bookmark", "bookmarks")} received, ${fmt(run.inserted)} new`;
}

function RunStats({ run }: { run: RunState }) {
  return (
    <>
      <StatStrip
        stats={[
          { label: "Page", value: fmt(run.page) },
          { label: "Received", value: fmt(run.received) },
          { label: "New", value: fmt(run.inserted), tone: run.inserted > 0 ? "ok" : undefined },
        ]}
      />
      <span className="sr-only">{progressText(run)}</span>
    </>
  );
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
    const waiting = run.status === "waiting" && !!run.waitUntil;
    let headline = "Syncing";
    let detail: string | null = null;
    if (run.status === "starting") {
      headline = "Starting";
      detail = "Opening X and preparing the run";
    } else if (run.status === "finishing") {
      headline = "Wrapping up";
    } else if (waiting) {
      headline = "X rate limit reached";
    } else if (run.page === 0) {
      detail = "Fetching the first page";
    }
    return (
      <Card label={`02 / ${run.mode === "full" ? "Full resync" : "Sync new"}`}>
        <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-fg">
          <Dot tone={waiting ? "warn" : "accent"} pulse={!waiting} />
          <span>{headline}</span>
        </p>
        {waiting && run.waitUntil && (
          <div className="well w-full flex flex-col items-center gap-2 px-3 pt-3.5 pb-3">
            <span className="countdown" aria-live="polite">
              {countdown(run.waitUntil - now)}
            </span>
            <Label>Rate limited, resuming in</Label>
          </div>
        )}
        {run.page > 0 && <RunStats run={run} />}
        {detail && <p className="text-[12px] text-muted">{detail}</p>}
        <ProgressBar paused={waiting} />
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
      <Card label="02 / Paused">
        <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-fg wrap-anywhere">
          <Dot tone="warn" />
          <span>{run.message}</span>
        </p>
        {run.page > 0 && <RunStats run={run} />}
        <Button className="w-full" disabled={busy || !store.template} onClick={() => act({ type: "resume" })}>
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
    const tone = run.status === "done" ? "ok" : run.status === "cancelled" ? "muted" : "danger";
    const stats: { label: string; value: string; tone?: "ok" | "danger" }[] = [
      { label: "Received", value: fmt(received) },
      { label: "New", value: fmt(inserted), tone: inserted > 0 ? "ok" : undefined },
    ];
    if (s && s.removed > 0) stats.push({ label: "Removed", value: fmt(s.removed), tone: "danger" });
    return (
      <Card label="02 / Summary">
        <p className={`flex items-center justify-center gap-2 text-[13px] font-semibold ${run.status === "error" ? "text-danger" : "text-fg"}`}>
          <Dot tone={tone} />
          <span>{title}</span>
        </p>
        <StatStrip stats={stats} />
        <span className="sr-only">
          {plural(received, "bookmark", "bookmarks")} received, {fmt(inserted)} new
          {s && s.removed > 0 ? `, ${fmt(s.removed)} removed from X` : ""}
        </span>
        {run.message && <p className="text-[12px] text-muted wrap-anywhere">{run.message}</p>}
        <div className="w-full flex flex-col items-center gap-1">
          {run.status === "done" && (
            <Button className="w-full" onClick={() => chrome.tabs.create({ url: store.troveUrl })}>
              Open XBookmarkVault
            </Button>
          )}
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
      <Card label="02 / Full resync">
        <p className="text-[13px] font-medium text-fg">Full resync walks every bookmark on X.</p>
        <p className="text-[12px] text-muted max-w-[280px]">It can take a while and marks anything you unbookmarked as removed.</p>
        <Button className="w-full" disabled={busy || !ready} onClick={() => start("full")}>
          Start full resync
        </Button>
        <Button variant="text" onClick={() => setConfirmFull(false)}>
          Back
        </Button>
      </Card>
    );
  }

  return (
    <Card label="02 / Sync">
      <Button className="w-full" disabled={busy || !ready} onClick={() => start("incremental")}>
        Sync new
      </Button>
      <Button variant="text" disabled={busy || !ready} onClick={() => setConfirmFull(true)}>
        Full resync
      </Button>
    </Card>
  );
}
