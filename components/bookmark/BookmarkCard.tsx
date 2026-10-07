"use client";

import Link from "next/link";
import { forwardRef, useState } from "react";
import { ExternalLink, Link2, Pin, StickyNote, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BookmarkItem, Facet, ItemTag } from "@/lib/bookmarks/types";
import { api } from "@/lib/client/api";
import { tweetUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TagEditor } from "./TagEditor";
import { AuthorLine, LinkCard, MediaGrid, QuotedTweet, TagChip } from "./TweetParts";
import { TweetText } from "./TweetText";

export type CardDialog = "note" | "tags" | null;

interface Props {
  item: BookmarkItem;
  allTags: Facet[];
  focused?: boolean;
  dialog?: CardDialog;
  onDialogChange?: (d: CardDialog) => void;
  onUpdate: (item: BookmarkItem) => void;
  onFocus?: () => void;
}

function IconAction({ label, onClick, href, active, children }: {
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn("text-muted-foreground hover:text-foreground", active && "text-brand hover:text-brand");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <a href={href} target="_blank" rel="noreferrer noopener" aria-label={label} className={cn("inline-flex size-8 items-center justify-center rounded-lg hover:bg-raised", cls)} />
          ) : (
            <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} className={cls} />
          )
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export async function togglePin(item: BookmarkItem, onUpdate: (i: BookmarkItem) => void) {
  const next = !item.pinned;
  onUpdate({ ...item, pinned: next });
  try {
    await api.setPinned(item.tweetId, next);
    toast.success(next ? "Pinned" : "Unpinned");
  } catch (e) {
    onUpdate(item);
    toast.error((e as Error).message);
  }
}

export async function copyLink(item: BookmarkItem) {
  await navigator.clipboard.writeText(tweetUrl(item.tweet.authorHandle, item.tweetId));
  toast.success("Link copied");
}

export const BookmarkCard = forwardRef<HTMLElement, Props>(function BookmarkCard(
  { item, allTags, focused, dialog: dialogProp, onDialogChange, onUpdate, onFocus },
  ref,
) {
  const [localDialog, setLocalDialog] = useState<CardDialog>(null);
  const dialog = dialogProp !== undefined ? dialogProp : localDialog;
  const setDialog = onDialogChange ?? setLocalDialog;
  const [expanded, setExpanded] = useState(false);
  const { tweet } = item;
  const long = tweet.text.length > 420 || tweet.text.split("\n").length > 8;

  return (
    <article
      ref={ref}
      tabIndex={0}
      onFocus={onFocus}
      data-tweet-id={item.tweetId}
      className={cn(
        "group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-center outline-none transition-shadow",
        "focus-visible:ring-2 focus-visible:ring-ring/60",
        focused && "ring-2 ring-ring/60",
        item.removedAt && "opacity-75",
      )}
    >
      <AuthorLine tweet={tweet} />

      {item.pinned && (
        <span className="inline-flex items-center gap-1 text-xs text-brand">
          <Pin className="size-3" /> Pinned
        </span>
      )}

      {tweet.isArticle && tweet.articleTitle && <div className="text-base font-semibold">{tweet.articleTitle}</div>}

      {tweet.isTombstone && !tweet.text ? (
        <div className="text-sm text-muted-foreground">This post is no longer available on X.</div>
      ) : (
        <div className="w-full">
          <TweetText text={tweet.text} headline={item.headline} clamp={!expanded} />
          {long && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm text-brand hover:underline">
              {expanded ? "Less" : "More"}
            </button>
          )}
        </div>
      )}

      {tweet.media.length > 0 && (
        <Link href={`/b/${item.tweetId}`} className="w-full" tabIndex={-1}>
          <MediaGrid media={tweet.media} />
        </Link>
      )}

      {tweet.links.map((l) => (
        <div key={l.url} className="w-full">
          <LinkCard link={l} />
        </div>
      ))}

      {tweet.quoted && (
        <div className="w-full">
          <QuotedTweet tweet={tweet.quoted} />
        </div>
      )}

      {item.note && (
        <div className="w-full rounded-xl bg-raised/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Note: </span>
          {item.note}
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {item.tags.map((t) => (
            <TagChip key={t.slug} tag={t} href={`/?tags=${encodeURIComponent(t.slug)}`} />
          ))}
        </div>
      )}

      {item.aiSummary && (
        <p className="max-h-0 overflow-hidden text-sm italic text-muted-foreground opacity-0 transition-all duration-200 group-hover:max-h-24 group-hover:opacity-100 group-focus-within:max-h-24 group-focus-within:opacity-100 group-focus:max-h-24 group-focus:opacity-100">
          {item.aiSummary}
        </p>
      )}

      {item.removedAt && <div className="text-xs text-muted-foreground">Removed from X bookmarks</div>}

      <footer className="flex items-center justify-center gap-0.5">
        <IconAction label="Open on X (o)" href={tweetUrl(tweet.authorHandle, item.tweetId)}>
          <ExternalLink className="size-4" />
        </IconAction>
        <IconAction label={item.pinned ? "Unpin (p)" : "Pin (p)"} active={item.pinned} onClick={() => togglePin(item, onUpdate)}>
          <Pin className="size-4" />
        </IconAction>
        <IconAction label="Note (n)" active={!!item.note} onClick={() => setDialog("note")}>
          <StickyNote className="size-4" />
        </IconAction>
        <IconAction label="Edit tags (t)" onClick={() => setDialog("tags")}>
          <TagIcon className="size-4" />
        </IconAction>
        <IconAction label="Copy link" onClick={() => copyLink(item)}>
          <Link2 className="size-4" />
        </IconAction>
        <Link href={`/b/${item.tweetId}`} className="ml-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-raised hover:text-foreground">
          Details
        </Link>
      </footer>

      <NoteDialog
        open={dialog === "note"}
        onOpenChange={(o) => setDialog(o ? "note" : null)}
        initial={item.note ?? ""}
        onSave={async (note) => {
          const prev = item;
          onUpdate({ ...item, note: note || null });
          try {
            await api.setNote(item.tweetId, note || null);
            toast.success("Note saved");
          } catch (e) {
            onUpdate(prev);
            toast.error((e as Error).message);
          }
        }}
      />
      <Dialog open={dialog === "tags"} onOpenChange={(o) => setDialog(o ? "tags" : null)}>
        <DialogContent className="text-center">
          <DialogHeader className="items-center text-center">
            <DialogTitle>Tags</DialogTitle>
          </DialogHeader>
          <TagEditor
            tweetId={item.tweetId}
            tags={item.tags}
            allTags={allTags}
            onChange={(tags: ItemTag[]) => onUpdate({ ...item, tags })}
          />
        </DialogContent>
      </Dialog>
    </article>
  );
});

function NoteDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: string;
  onSave: (note: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-center">
        <DialogHeader className="items-center text-center">
          <DialogTitle>Note</DialogTitle>
        </DialogHeader>
        {open && <NoteForm initial={initial} onCancel={() => onOpenChange(false)} onSave={(v) => onSave(v).then(() => onOpenChange(false))} />}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (note: string) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void onSave(value.trim());
        }}
        rows={5}
        placeholder="Why did you save this?"
      />
      <div className="flex justify-center gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(value.trim())}>Save</Button>
      </div>
    </>
  );
}
