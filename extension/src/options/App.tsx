import { useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { clearTemplate, DEFAULT_TROVE_URL, normalizeUrl, saveSettings } from "../shared/storage";
import { Button, Card, Dot, plural, timeAgo, useNow } from "../shared/ui";
import { useStore } from "../shared/useStore";

type TestResult = { tone: "ok" | "danger" | "muted"; text: string } | null;

export function App() {
  const store = useStore();
  const now = useNow(15_000);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult>(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (store.loaded && !initialised) {
      setUrl(store.troveUrl);
      setToken(store.token);
      setInitialised(true);
    }
  }, [store.loaded, store.troveUrl, store.token, initialised]);

  const validUrl = (() => {
    try {
      const u = new URL(normalizeUrl(url));
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  })();
  const dirty = initialised && (normalizeUrl(url) !== store.troveUrl || token.trim() !== store.token);

  async function save() {
    if (!validUrl) return;
    await saveSettings({ troveUrl: url, token });
    setSaved("Saved");
    setTimeout(() => setSaved(null), 2000);
  }

  async function testConnection() {
    setTest({ tone: "muted", text: "Testing" });
    try {
      const r = await api.ping({ troveUrl: normalizeUrl(url), token: token.trim() });
      const count = r.bookmarks !== undefined ? `, ${plural(r.bookmarks, "bookmark", "bookmarks")} stored` : "";
      setTest({ tone: "ok", text: `Connected${count}` });
    } catch (err) {
      const text =
        err instanceof ApiError && err.status === 401
          ? `Token rejected: ${err.message}`
          : err instanceof ApiError && err.status === 403
            ? "Trove refused this extension origin. Check EXTENSION_ORIGIN on the server."
            : err instanceof Error
              ? err.message
              : String(err);
      setTest({ tone: "danger", text });
    }
  }

  const origin = `chrome-extension://${chrome.runtime.id}`;

  return (
    <main className="mx-auto max-w-lg px-4 py-10 flex flex-col items-center gap-6 text-center">
      <header className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Trove Sync</h1>
        <p className="text-sm text-muted">Settings for syncing your X bookmarks to Trove.</p>
      </header>

      <Card className="gap-4 p-6">
        <h2 className="text-lg font-semibold">Connection</h2>

        <label className="w-full flex flex-col items-center gap-1">
          <span className="text-sm font-medium">Trove Web URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={DEFAULT_TROVE_URL}
            className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-center text-fg"
            spellCheck={false}
          />
          {!validUrl && url && <span className="text-xs text-danger">Enter a full http or https URL</span>}
        </label>

        <label className="w-full flex flex-col items-center gap-1">
          <span className="text-sm font-medium">Import token</span>
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the token from Trove settings"
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-center text-fg font-mono"
            spellCheck={false}
          />
          <Button variant="text" className="text-xs" onClick={() => setShowToken((v) => !v)}>
            {showToken ? "Hide token" : "Show token"}
          </Button>
        </label>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button disabled={!dirty || !validUrl} onClick={save}>
            Save
          </Button>
          <Button variant="secondary" disabled={!validUrl || !token.trim()} onClick={testConnection}>
            Test connection
          </Button>
        </div>
        {saved && <p className="text-sm text-ok">{saved}</p>}
        {test && (
          <p className="flex items-center justify-center gap-2 text-sm">
            <Dot tone={test.tone} />
            <span>{test.text}</span>
          </p>
        )}
        <p className="text-xs text-muted">
          Extension origin for the server&apos;s EXTENSION_ORIGIN setting:
          <br />
          <code className="font-mono text-fg select-all">{origin}</code>
        </p>
      </Card>

      <Card className="gap-3 p-6">
        <h2 className="text-lg font-semibold">X request template</h2>
        {store.template ? (
          <>
            <p className="text-sm text-muted">Learned {timeAgo(store.template.capturedAt, now)} from your X bookmarks page.</p>
            <Button variant="danger" onClick={() => void clearTemplate()}>
              Forget X template
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Not learned yet. Open your X bookmarks once so Trove can learn the request format.</p>
            <Button variant="secondary" onClick={() => chrome.tabs.create({ url: "https://x.com/i/bookmarks" })}>
              Open X bookmarks
            </Button>
          </>
        )}
      </Card>

      <p className="text-xs text-muted">Syncs only run when you start them from the toolbar popup.</p>
    </main>
  );
}
