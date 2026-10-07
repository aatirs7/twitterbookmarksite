"use client";

import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BookmarkItem, Facet } from "@/lib/bookmarks/types";
import { api } from "@/lib/client/api";
import { TagEditor } from "./TagEditor";

/** Pin toggle, autosaving note and tag editor for the detail page. */
export function DetailEditor({ item, allTags }: { item: BookmarkItem; allTags: Facet[] }) {
  const [pinned, setPinned] = useState(item.pinned);
  const [note, setNote] = useState(item.note ?? "");
  const [tags, setTags] = useState(item.tags);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef(item.note ?? "");

  useEffect(() => {
    if (note === saved.current) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        await api.setNote(item.tweetId, note.trim() || null);
        saved.current = note;
        setStatus("saved");
      } catch (e) {
        setStatus("idle");
        toast.error((e as Error).message);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [note, item.tweetId]);

  return (
    <div className="flex w-full flex-col items-center gap-5 border-t border-border pt-5">
      <Button
        variant={pinned ? "secondary" : "ghost"}
        onClick={async () => {
          const next = !pinned;
          setPinned(next);
          try {
            await api.setPinned(item.tweetId, next);
          } catch (e) {
            setPinned(!next);
            toast.error((e as Error).message);
          }
        }}
      >
        <Pin className="size-4" />
        {pinned ? "Pinned" : "Pin"}
      </Button>

      <div className="flex w-full flex-col items-center gap-2">
        <label htmlFor="note" className="text-sm font-medium">
          Note
        </label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Why did you save this?" className="text-center" />
        <span className="h-4 text-xs text-muted-foreground">{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : ""}</span>
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        <span className="text-sm font-medium">Tags</span>
        <TagEditor tweetId={item.tweetId} tags={tags} allTags={allTags} onChange={setTags} />
      </div>
    </div>
  );
}
