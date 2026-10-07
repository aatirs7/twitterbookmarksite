import { useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { clearTemplate, DEFAULT_TROVE_URL, normalizeUrl, saveSettings } from "../shared/storage";
import { Button, Card, Dot, extVersion, Label, plural, timeAgo, useNow } from "../shared/ui";
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
  const [copied, setCopied] = useState(false);

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
  const version = extVersion();

  async function copyOrigin() {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid-bg min-h-screen">
      <main className="mx-auto max-w-[560px] px-4 pt-14 pb-12 flex flex-col items-center gap-3 text-center">
        <header className="flex flex-col items-center gap-2.5 pb-6">
          <Label>
            Trove / Sync{version && <span className="normal-case"> / v{version}</span>}
          </Label>
          <h1 className="wordmark text-[56px]">Trove</h1>
          <p className="text-[13px] text-muted max-w-[360px]">Settings for syncing your X bookmarks to Trove.</p>
        </header>

        <Card label="01 / Connection" className="gap-4 p-6">
          <label className="w-full flex flex-col items-center gap-2">
            <span className="label-mono">Trove Web URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={DEFAULT_TROVE_URL}
              className="input"
              spellCheck={false}
            />
            {!validUrl && url && <span className="text-[12px] text-danger">Enter a full http or https URL</span>}
          </label>

          <label className="w-full flex flex-col items-center gap-2">
            <span className="label-mono">Import token</span>
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the token from Trove settings"
              autoComplete="off"
              className="input input-mono"
              spellCheck={false}
            />
            <Button variant="text" onClick={() => setShowToken((v) => !v)}>
              {showToken ? "Hide token" : "Show token"}
            </Button>
          </label>

          <div className="w-full grid grid-cols-2 gap-2">
            <Button disabled={!dirty || !validUrl} onClick={save}>
              Save
            </Button>
            <Button variant="secondary" disabled={!validUrl || !token.trim()} onClick={testConnection}>
              Test connection
            </Button>
          </div>
          {saved && (
            <p className="flex items-center justify-center gap-2 text-[13px] text-ok">
              <Dot tone="ok" />
              <span>{saved}</span>
            </p>
          )}
          {test && (
            <p className="well w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] text-fg wrap-anywhere">
              <Dot tone={test.tone} pulse={test.tone === "ok"} />
              <span>{test.text}</span>
            </p>
          )}

          <div className="rule my-1" />

          <div className="w-full flex flex-col items-center gap-2">
            <span className="label-mono">Extension origin</span>
            <p className="text-[12px] text-muted">For the server&apos;s EXTENSION_ORIGIN setting.</p>
            <div className="well w-full flex items-center justify-center gap-2 pl-3 pr-1.5 py-1.5">
              <code className="flex-1 min-w-0 font-mono text-[12px] text-fg select-all wrap-anywhere">{origin}</code>
              <Button variant="text" className="flex-none" onClick={() => void copyOrigin()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </Card>

        <Card label="02 / X template" className="gap-3 p-6">
          {store.template ? (
            <>
              <p className="flex items-center justify-center gap-2 text-[14px] font-medium text-fg">
                <Dot tone="ok" />
                <span>Template ready</span>
              </p>
              <p className="text-[13px] text-muted">Learned {timeAgo(store.template.capturedAt, now)} from your X bookmarks page.</p>
              <Button variant="danger" onClick={() => void clearTemplate()}>
                Forget X template
              </Button>
            </>
          ) : (
            <>
              <p className="flex items-center justify-center gap-2 text-[14px] font-medium text-fg">
                <Dot tone="warn" />
                <span>Not learned yet</span>
              </p>
              <p className="text-[13px] text-muted max-w-[380px]">Open your X bookmarks once so Trove can learn the request format.</p>
              <Button variant="secondary" onClick={() => chrome.tabs.create({ url: "https://x.com/i/bookmarks" })}>
                Open X bookmarks
              </Button>
            </>
          )}
        </Card>

        <p className="label-mono pt-4 max-w-[480px]">Syncs only run when you start them from the toolbar popup.</p>
      </main>
    </div>
  );
}
