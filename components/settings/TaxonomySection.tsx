"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptTagAction,
  createTagAction,
  deleteTagAction,
  mergeTagsAction,
  retagAllAction,
  updateTagAction,
} from "@/app/(app)/settings/actions";
import { TAG_PALETTE } from "@/lib/tags/palette";
import { cn } from "@/lib/utils";

interface TagRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  count: number;
  createdBy: string;
}

function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  return { pending, run };
}

function TagCard({ tag, all }: { tag: TagRow; all: TagRow[] }) {
  const [name, setName] = useState(tag.name);
  const [description, setDescription] = useState(tag.description ?? "");
  const [mergeInto, setMergeInto] = useState("");
  const { pending, run } = useAction();
  const dirty = name !== tag.name || description !== (tag.description ?? "");

  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl bg-raised/60 p-4", tag.createdBy === "ai" && "ring-1 ring-brand/50")}>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger className="size-4 rounded-full ring-2 ring-border" style={{ backgroundColor: tag.color ?? "#9AA7B8" }} aria-label="Change color" />
          <PopoverContent className="w-auto">
            <div className="grid grid-cols-5 gap-2">
              {TAG_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => run(() => updateTagAction(tag.id, { color: c }))}
                  className={cn("size-6 rounded-full", c === tag.color && "ring-2 ring-foreground/60")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">{tag.count.toLocaleString()} bookmarks</span>
      </div>
      {tag.createdBy === "ai" && <span className="text-xs text-brand">Proposed by AI</span>}
      <Input value={name} onChange={(e) => setName(e.target.value)} className="text-center font-medium" aria-label="Tag name" />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description for the AI tagger"
        className="text-center text-xs"
      />
      <div className="flex flex-wrap justify-center gap-1">
        {dirty && (
          <Button size="sm" disabled={pending} onClick={() => run(() => updateTagAction(tag.id, { name, description }), "Saved")}>
            Save
          </Button>
        )}
        {tag.createdBy === "ai" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => acceptTagAction(tag.id), "Accepted")}>
            Accept
          </Button>
        )}
        <Popover>
          <PopoverTrigger className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] text-muted-foreground hover:bg-raised hover:text-foreground">
            Merge
          </PopoverTrigger>
          <PopoverContent className="items-center text-center">
            <p className="text-xs text-muted-foreground">Move every bookmark tagged {tag.name} into:</p>
            <select
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-center text-sm"
            >
              <option value="">Choose a tag</option>
              {all
                .filter((t) => t.id !== tag.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <Button size="sm" disabled={!mergeInto || pending} onClick={() => run(() => mergeTagsAction(tag.id, mergeInto), "Merged")}>
              Merge
            </Button>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] text-destructive hover:bg-raised">
            Delete
          </PopoverTrigger>
          <PopoverContent className="items-center text-center">
            <p className="text-xs">Delete {tag.name} from {tag.count} bookmarks?</p>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteTagAction(tag.id), "Deleted")}>
              Delete tag
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function TaxonomySection({ tags }: { tags: TagRow[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { pending, run } = useAction();
  const proposed = tags.filter((t) => t.createdBy === "ai");
  const rest = tags.filter((t) => t.createdBy !== "ai");

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex flex-wrap justify-center gap-2">
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-raised">New tag</PopoverTrigger>
          <PopoverContent className="items-center text-center">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="text-center" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description" className="text-center" />
            <Button
              size="sm"
              disabled={!name.trim() || pending}
              onClick={() =>
                run(async () => {
                  await createTagAction(name, description);
                  setName("");
                  setDescription("");
                }, "Tag created")
              }
            >
              Create
            </Button>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-raised">Retag all</PopoverTrigger>
          <PopoverContent className="items-center text-center">
            <p className="text-xs">Clear AI tags and summaries and run the tagger again. Tags you added stay.</p>
            <Button size="sm" disabled={pending} onClick={() => run(() => retagAllAction(), "Retagging started")}>
              Retag everything
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {proposed.length > 0 && (
        <div className="flex w-full flex-col items-center gap-3">
          <h3 className="text-sm font-medium">Waiting for review</h3>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {proposed.map((t) => (
              <TagCard key={`${t.id}-${t.name}-${t.description}`} tag={t} all={tags} />
            ))}
          </div>
        </div>
      )}

      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((t) => (
          <TagCard key={`${t.id}-${t.name}-${t.description}`} tag={t} all={tags} />
        ))}
      </div>
    </div>
  );
}
