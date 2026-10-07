import type { LastSync, RunState, Settings, StoredTemplate } from "./types";

export const DEFAULT_TROVE_URL: string = __TROVE_URL__;

interface StorageShape {
  bookmarksTemplate?: StoredTemplate;
  run?: RunState;
  lastSync?: LastSync;
  troveUrl?: string;
  token?: string;
}

export type StorageKey = keyof StorageShape;

async function get<K extends StorageKey>(key: K): Promise<StorageShape[K]> {
  const data = await chrome.storage.local.get(key);
  return data[key] as StorageShape[K];
}

async function set<K extends StorageKey>(key: K, value: StorageShape[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function getSettings(): Promise<Settings> {
  const data = (await chrome.storage.local.get(["troveUrl", "token"])) as StorageShape;
  return {
    troveUrl: normalizeUrl(data.troveUrl || DEFAULT_TROVE_URL),
    token: (data.token ?? "").trim(),
  };
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  const patch: StorageShape = {};
  if (s.troveUrl !== undefined) patch.troveUrl = normalizeUrl(s.troveUrl);
  if (s.token !== undefined) patch.token = s.token.trim();
  await chrome.storage.local.set(patch);
}

export const getTemplate = () => get("bookmarksTemplate");
export const setTemplate = (t: StoredTemplate) => set("bookmarksTemplate", t);
export const clearTemplate = () => chrome.storage.local.remove("bookmarksTemplate");

export const getRun = () => get("run");
export const setRun = (r: RunState) => set("run", r);
export const clearRun = () => chrome.storage.local.remove("run");

/** Read-modify-write on the persisted run. Returns the updated run, or undefined if none matches. */
export async function patchRun(runId: string, patch: Partial<RunState>): Promise<RunState | undefined> {
  const run = await getRun();
  if (!run || run.runId !== runId) return undefined;
  const next = { ...run, ...patch };
  await setRun(next);
  return next;
}

export const getLastSync = () => get("lastSync");
export const setLastSync = (l: LastSync) => set("lastSync", l);

export function isActive(run: RunState | undefined): boolean {
  return !!run && (run.status === "starting" || run.status === "running" || run.status === "waiting" || run.status === "finishing");
}
