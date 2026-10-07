"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import type { Facet, ItemTag } from "@/lib/bookmarks/types";
import { api } from "@/lib/client/api";
import { TagChip } from "./TweetParts";

/** Inline editor for a bookmark's tags. `allTags` powers suggestions. */
export function TagEditor({
  tweetId,
  tags,
  allTags,
  onChange,
}: {
  tweetId: string;
  tags: ItemTag[];
  allTags: Facet[];
  onChange: (tags: ItemTag[]) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const current = new Set(tags.map((t) => t.slug));
  const q = value.trim().toLowerCase();
  const suggestions = allTags
    .filter((t) => !current.has(t.value) && (!q || t.label.toLowerCase().includes(q) || t.value.includes(q)))
    .slice(0, 8);

  async function add(input: { slug?: string; name?: string }) {
    setBusy(true);
    try {
      const { tag } = await api.addTag(tweetId, input);
      if (!current.has(tag.slug)) onChange([...tags, tag]);
      setValue("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(slug: string) {
    const prev = tags;
    onChange(tags.filter((t) => t.slug !== slug));
    try {
      await api.removeTag(tweetId, slug);
    } catch (e) {
      onChange(prev);
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex flex-wrap justify-center gap-1.5">
        {tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>}
        {tags.map((t) => (
          <TagChip key={t.slug} tag={t} onRemove={() => remove(t.slug)} />
        ))}
      </div>
      <form
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q) return;
          const exact = allTags.find((t) => t.value === q || t.label.toLowerCase() === q);
          void add(exact ? { slug: exact.value } : { name: value.trim() });
        }}
      >
        <Input
          autoFocus
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a tag, Enter to create"
          className="text-center"
        />
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {suggestions.map((s) => (
            <button key={s.value} type="button" onClick={() => add({ slug: s.value })} className="opacity-80 hover:opacity-100">
              <TagChip tag={{ name: s.label, slug: s.value, color: s.color ?? null }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
