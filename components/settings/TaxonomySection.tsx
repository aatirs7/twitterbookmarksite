"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { acceptTagAction, createTagAction, deleteTagAction, mergeTagsAction, updateTagAction } from "@/app/(app)/settings/actions";
import { TAG_PALETTE } from "@/lib/tags/palette";
import { cn } from "@/lib/utils";

interface TagRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  keywords: string | null;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex w-full flex-col items-center gap-1">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

function CategoryRow({ tag, all }: { tag: TagRow; all: TagRow[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tag.name);
  const [description, setDescription] = useState(tag.description ?? "");
  const [keywords, setKeywords] = useState(tag.keywords ?? "");
  const [mergeInto, setMergeInto] = useState("");
  const { pending, run } = useAction();
  const dirty = name !== tag.name || description !== (tag.description ?? "") || keywords !== (tag.keywords ?? "");
  const color = tag.color ?? "#9AA7B8";

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2.5 px-4 py-3 transition-colors hover:bg-raised/50"
      >
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[14px]">{tag.name}</span>
        <span className="font-mono text-[11px] text-faint tabular">{tag.count.toLocaleString()}</span>
        {tag.createdBy === "ai" && <span className="label-mono text-brand">New, review</span>}
        <ChevronDown className={cn("size-3.5 text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="flex flex-col items-center gap-3 px-4 pb-5">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {TAG_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => run(() => updateTagAction(tag.id, { color: c }))}
                className={cn("size-5 rounded-full transition-transform hover:scale-110", c === tag.color && "ring-2 ring-foreground/50 ring-offset-2")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="grid w-full max-w-lg gap-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-center" />
            </Field>
            <Field label="Keywords (free sorting)">
              <Textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={3}
                placeholder='free, "promo code", figma.com, @handle'
                className="text-center font-mono text-[11.5px]"
              />
            </Field>
            <Field label="Description (Claude sorting)">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-center text-[13px]" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button size="sm" disabled={!dirty || pending} onClick={() => run(() => updateTagAction(tag.id, { name, description, keywords }), "Saved")}>
              Save
            </Button>
            {tag.createdBy === "ai" && (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => acceptTagAction(tag.id), "Kept")}>
                Keep it
              </Button>
            )}
            <Popover>
              <PopoverTrigger className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] text-muted-foreground hover:bg-raised hover:text-foreground">
                Merge into...
              </PopoverTrigger>
              <PopoverContent className="items-center text-center">
                <p className="text-xs text-muted-foreground">Move every bookmark in {tag.name} into:</p>
                <select
                  value={mergeInto}
                  onChange={(e) => setMergeInto(e.target.value)}
                  className="well h-8 w-full rounded-lg px-2 text-center text-sm"
                >
                  <option value="">Choose a category</option>
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
              <PopoverTrigger className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] text-destructive hover:bg-raised">Delete</PopoverTrigger>
              <PopoverContent className="items-center text-center">
                <p className="text-xs">
                  Delete {tag.name}? Its {tag.count} bookmarks stay, they just lose this category.
                </p>
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteTagAction(tag.id), "Deleted")}>
                  Delete category
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}

export function TaxonomySection({ tags }: { tags: TagRow[] }) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const { pending, run } = useAction();
  // Proposed categories first so they get reviewed, then largest first.
  const sorted = [...tags].sort((a, b) => Number(b.createdBy === "ai") - Number(a.createdBy === "ai") || b.count - a.count);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="etched w-full max-w-2xl overflow-hidden rounded-2xl">
        {sorted.map((t) => (
          <CategoryRow key={`${t.id}-${t.name}-${t.description}-${t.keywords}-${t.color}`} tag={t} all={tags} />
        ))}
      </div>

      <Popover>
        <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[13px] text-muted-foreground hover:bg-raised hover:text-foreground">
          <Plus className="size-3.5" /> New category
        </PopoverTrigger>
        <PopoverContent className="w-80 items-center text-center">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="text-center" />
          <Textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            placeholder='Keywords: recipe, cooking, "meal prep"'
            className="text-center font-mono text-[11.5px]"
          />
          <Button
            size="sm"
            disabled={!name.trim() || pending}
            onClick={() =>
              run(async () => {
                await createTagAction(name, "", keywords);
                setName("");
                setKeywords("");
              }, "Category created. Recategorize to apply it to older bookmarks.")
            }
          >
            Create
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
