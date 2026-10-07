import { useEffect, useState } from "react";
import { DEFAULT_TROVE_URL, normalizeUrl } from "./storage";
import type { LastSync, RunState, RuntimeMessage, StoredTemplate } from "./types";

export interface StoreState {
  loaded: boolean;
  troveUrl: string;
  token: string;
  template?: StoredTemplate;
  run?: RunState;
  lastSync?: LastSync;
}

const KEYS = ["troveUrl", "token", "bookmarksTemplate", "run", "lastSync"];

function fromRaw(raw: Record<string, unknown>): StoreState {
  return {
    loaded: true,
    troveUrl: normalizeUrl((raw.troveUrl as string) || DEFAULT_TROVE_URL),
    token: ((raw.token as string) ?? "").trim(),
    template: raw.bookmarksTemplate as StoredTemplate | undefined,
    run: raw.run as RunState | undefined,
    lastSync: raw.lastSync as LastSync | undefined,
  };
}

/** Live view of chrome.storage.local; re-renders whenever the service worker writes. */
export function useStore(): StoreState {
  const [state, setState] = useState<StoreState>({ loaded: false, troveUrl: DEFAULT_TROVE_URL, token: "" });
  useEffect(() => {
    let alive = true;
    const load = () =>
      chrome.storage.local.get(KEYS).then((raw) => {
        if (alive) setState(fromRaw(raw));
      });
    void load();
    const onChanged = (_changes: unknown, area: string) => {
      if (area === "local") void load();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);
  return state;
}

export async function sendToWorker<T = { ok: boolean; error?: string }>(message: RuntimeMessage): Promise<T> {
  return (await chrome.runtime.sendMessage(message)) as T;
}
