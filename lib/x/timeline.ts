/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RawEntry } from "./normalize";

export interface TimelinePage {
  entries: RawEntry[];
  bottomCursor: string | null;
}

/**
 * Extracts bookmark entries and the bottom cursor from a Bookmarks GraphQL response.
 * Mirrors the parsing done in the extension runner so the same logic can be used for
 * manual file imports and tests.
 */
export function parseBookmarksResponse(json: any): TimelinePage {
  const instructions: any[] = json?.data?.bookmark_timeline_v2?.timeline?.instructions ?? [];
  const entries: RawEntry[] = [];
  let bottomCursor: string | null = null;

  const visit = (entry: any) => {
    const content = entry?.content;
    if (!content) return;
    if (content.cursorType === "Bottom" && typeof content.value === "string") {
      bottomCursor = content.value;
      return;
    }
    const result = content.itemContent?.tweet_results?.result;
    if (result) {
      entries.push({ entryId: String(entry.entryId ?? ""), sortIndex: String(entry.sortIndex ?? ""), result });
    }
  };

  for (const ins of instructions) {
    if (Array.isArray(ins?.entries)) ins.entries.forEach(visit);
    if (ins?.entry) visit(ins.entry);
  }
  return { entries, bottomCursor };
}

/**
 * Accepts any of: an array of entries, `{ entries }`, a single GraphQL response,
 * or an array of GraphQL responses. Returns a flat list of entries.
 */
export function entriesFromImportFile(json: any): RawEntry[] {
  const isEntry = (e: any) => e && typeof e === "object" && "result" in e && "entryId" in e;
  if (Array.isArray(json)) {
    if (json.every(isEntry)) return json;
    return json.flatMap((page) => entriesFromImportFile(page));
  }
  if (Array.isArray(json?.entries)) return json.entries.filter(isEntry);
  if (json?.data) return parseBookmarksResponse(json).entries;
  return [];
}
