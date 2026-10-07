"use client";

import type { ItemTag } from "@/lib/bookmarks/types";

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

export const api = {
  setPinned: (tweetId: string, pinned: boolean) => send(`/api/bookmarks/${tweetId}/pin`, "PUT", { pinned }),
  setNote: (tweetId: string, note: string | null) => send(`/api/bookmarks/${tweetId}/note`, "PUT", { note }),
  addTag: (tweetId: string, input: { slug?: string; name?: string }) =>
    send<{ tag: ItemTag }>(`/api/bookmarks/${tweetId}/tags`, "POST", input),
  removeTag: (tweetId: string, slug: string) => send(`/api/bookmarks/${tweetId}/tags`, "DELETE", { slug }),
  send,
};
