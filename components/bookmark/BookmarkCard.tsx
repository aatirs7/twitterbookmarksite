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
  /** Position in the list, shown as a catalog number. */
  index?: number;
}

function IconAction({ label, onClick, href, active, children }: {
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "inline-flex h-9 flex-1 items-center justify-center text-faint transition-colors hover:bg-raised/70 hover:text-foreground",
    active && "text-brand hover:text-brand",
  );
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <a href={href} target="_blank" rel="noreferrer noopener" aria-label={label} className={cls} />
          ) : (
            <button type="button" aria-label={label} onClick={onClick} className={cls} />
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
  { item, allTags, focused, index, dialog: dialogProp, onDialogChange, onUpdate, onFocus },
  ref,
) {
  const [localDialog, setLocalDialog] = useState<CardDialog>(null);
  const dialog = dialogProp !== undefined ? dialogProp : localDialog;
  const setDialog = onDialogChange ?? setLocalDialog;
  const [expanded, setExpanded] = useState(false);
  const { tweet } = item;
  const long = tweet.text.length > 420 || tweet.text.split("\n").length > 8;

  return (
    // The slot never moves, so lifting the card cannot pull it out from under the pointer.
    <div className="card-slot group/card">
    <article
      ref={ref}
      tabIndex={0}
      onFocus={onFocus}
      data-tweet-id={item.tweetId}
      className={cn(
        "etched group relative flex flex-col overflow-hidden rounded-2xl text-center outline-none transition-[border-color,transform,box-shadow] duration-300 ease-out",
        "group-hover/card:-translate-y-1 group-hover/card:border-brand/45 group-hover/card:shadow-[inset_0_1px_0_0_var(--highlight),0_18px_40px_-16px_rgb(15_17_21/0.35),0_0_0_4px_var(--mark)]",
        "focus-visible:border-brand/60 motion-reduce:group-hover/card:translate-y-0",
        focused && "border-brand/60",
        item.removedAt && "opacity-70",
      )}
    >
      {index !== undefined && (
        <span className="label-mono absolute top-3 left-3.5 tabular opacity-70">{String(index + 1).padStart(3, "0")}</span>
      )}
      {(item.pinned || item.removedAt) && (
        <span className={cn("label-mono absolute top-3 right-3.5", item.pinned ? "text-brand" : "")}>
          {item.pinned ? "Pinned" : "Removed"}
        </span>
      )}

      <div className="flex flex-col items-center gap-3 px-5 pt-5 pb-4">
        <AuthorLine tweet={tweet} />

        {tweet.isArticle && tweet.articleTitle && (
          <div className="font-serif text-[22px] leading-tight tracking-[-0.01em]">{tweet.articleTitle}</div>
        )}

        {tweet.isTombstone && !tweet.text ? (
          <div className="label-mono py-2">No longer available on X</div>
        ) : (
          <div className="w-full">
            <TweetText text={tweet.text} headline={item.headline} clamp={!expanded} className="text-[14.5px] leading-[1.6]" />
            {long && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="label-mono mt-2 text-brand hover:opacity-80">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {tweet.media.length > 0 && (
          <Link href={`/b/${item.tweetId}`} className="w-full" tabIndex={-1}>
            <MediaGrid media={tweet.media} />
          </Link>
        )}

        {tweet.links.filter((l) => l.title || l.imageUrl).map((l) => (
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
          <div className="w-full rounded-xl border border-dashed border-hairline-strong px-3 py-2 text-[13px]">
            <div className="label-mono mb-1">Note</div>
            {item.note}
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {item.tags.map((t) => (
              <TagChip key={t.slug} tag={t} href={`/?tags=${encodeURIComponent(t.slug)}`} />
            ))}
          </div>
        )}

        {item.aiSummary && (
          <p className="max-h-0 overflow-hidden font-serif text-[15px] leading-snug text-muted-foreground italic opacity-0 transition-all duration-300 group-focus-within:max-h-24 group-focus-within:opacity-100 group-hover:max-h-24 group-hover:opacity-100">
            {item.aiSummary}
          </p>
        )}
      </div>

      <footer className="mt-auto flex items-stretch border-t border-hairline">
        <IconAction label="Open on X (o)" href={tweetUrl(tweet.authorHandle, item.tweetId)}>
          <ExternalLink className="size-3.5" />
        </IconAction>
        <span className="w-px bg-hairline" />
        <IconAction label={item.pinned ? "Unpin (p)" : "Pin (p)"} active={item.pinned} onClick={() => togglePin(item, onUpdate)}>
          <Pin className="size-3.5" />
        </IconAction>
        <span className="w-px bg-hairline" />
        <IconAction label="Note (n)" active={!!item.note} onClick={() => setDialog("note")}>
          <StickyNote className="size-3.5" />
        </IconAction>
        <span className="w-px bg-hairline" />
        <IconAction label="Edit tags (t)" onClick={() => setDialog("tags")}>
          <TagIcon className="size-3.5" />
        </IconAction>
        <span className="w-px bg-hairline" />
        <IconAction label="Copy link (c)" onClick={() => copyLink(item)}>
          <Link2 className="size-3.5" />
        </IconAction>
        <span className="w-px bg-hairline" />
        <Link
          href={`/b/${item.tweetId}`}
          className="label-mono inline-flex h-9 flex-1 items-center justify-center transition-colors hover:bg-raised/70 hover:text-foreground"
        >
          Open
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
    </div>
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
