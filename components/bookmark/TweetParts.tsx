/* eslint-disable @next/next/no-img-element */
import { BadgeCheck, Play } from "lucide-react";
import type { ItemLink, ItemMedia, ItemTag, ItemTweet } from "@/lib/bookmarks/types";
import { duration, relativeDate, tweetUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TweetText } from "./TweetText";

export function Avatar({ src, name, size = 36 }: { src: string | null; name: string | null; size?: number }) {
  if (!src) {
    return (
      <div
        className="well flex shrink-0 items-center justify-center rounded-full font-serif text-muted-foreground"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {(name ?? "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-raised object-cover ring-1 ring-hairline"
      style={{ width: size, height: size }}
    />
  );
}

export function AuthorLine({ tweet, compact }: { tweet: ItemTweet; compact?: boolean }) {
  if (tweet.isTombstone && !tweet.authorHandle) {
    return <div className="label-mono">Unavailable post</div>;
  }
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs">
        <Avatar src={tweet.authorAvatarUrl} name={tweet.authorName} size={18} />
        <span className="font-medium">{tweet.authorName ?? tweet.authorHandle}</span>
        {tweet.authorHandle && <span className="text-muted-foreground">@{tweet.authorHandle}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar src={tweet.authorAvatarUrl} name={tweet.authorName} size={34} />
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center justify-center gap-1 text-[14px] leading-tight">
          <span className="font-semibold tracking-[-0.01em]">{tweet.authorName ?? tweet.authorHandle}</span>
          {tweet.authorVerified && <BadgeCheck className="size-3.5 shrink-0 text-brand" aria-label="Verified" />}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[12.5px] text-muted-foreground">
          {tweet.authorHandle && <span>@{tweet.authorHandle}</span>}
          {tweet.createdAt && (
            <>
              <span className="text-faint">/</span>
              <a
                href={tweetUrl(tweet.authorHandle, tweet.id)}
                target="_blank"
                rel="noreferrer noopener"
                className="tabular hover:text-foreground"
                title={new Date(tweet.createdAt).toLocaleString()}
              >
                {relativeDate(tweet.createdAt)}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaGrid({ media, full, max = 4 }: { media: ItemMedia[]; full?: boolean; max?: number }) {
  if (media.length === 0) return null;
  const shown = full ? media : media.slice(0, max);
  if (full) {
    return (
      <div className="flex flex-col items-center gap-3">
        {shown.map((m, i) =>
          m.type !== "photo" && m.videoUrl ? (
            <video
              key={i}
              src={m.videoUrl}
              poster={m.url}
              controls
              loop={m.type === "animated_gif"}
              autoPlay={m.type === "animated_gif"}
              muted={m.type === "animated_gif"}
              playsInline
              className="well max-h-[80vh] w-full rounded-xl"
            />
          ) : (
            <a key={i} href={m.url.replace(/(\.\w+)$/, "$1?name=large")} target="_blank" rel="noreferrer noopener">
              <img src={m.url} alt={m.altText ?? ""} loading="lazy" className="well max-h-[80vh] w-auto rounded-xl" />
            </a>
          ),
        )}
      </div>
    );
  }
  const single = shown.length === 1;
  return (
    <div
      className={cn("well grid gap-px overflow-hidden rounded-xl bg-hairline", !single && "grid-cols-2")}
      style={!single ? { aspectRatio: shown.length === 2 ? "2 / 1" : "1 / 1" } : undefined}
    >
      {shown.map((m, i) => (
        <div key={i} className={cn("relative overflow-hidden bg-raised", shown.length === 3 && i === 0 && "row-span-2")}>
          <img
            src={m.url}
            alt={m.altText ?? ""}
            loading="lazy"
            width={single ? (m.width ?? undefined) : undefined}
            height={single ? (m.height ?? undefined) : undefined}
            className={single ? "block h-auto max-h-[320px] w-full object-cover object-top" : "size-full object-cover"}
          />
          {m.type !== "photo" && (
            <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-foreground backdrop-blur">
              <Play className="size-2.5 fill-current" />
              {m.type === "animated_gif" ? "GIF" : duration(m.durationMs)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function LinkCard({ link }: { link: ItemLink }) {
  const hasPreview = link.title || link.imageUrl;
  if (!hasPreview) return null;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="group/link well flex flex-col items-center overflow-hidden rounded-xl text-center transition-colors hover:border-hairline-strong"
    >
      {link.imageUrl && <img src={link.imageUrl} alt="" loading="lazy" className="aspect-[1.91/1] w-full border-b border-hairline object-cover" />}
      <div className="flex flex-col items-center gap-1 px-3 py-2.5">
        {link.domain && <span className="label-mono">{link.domain}</span>}
        {link.title && <div className="line-clamp-2 text-[13px] leading-snug font-medium group-hover/link:text-brand">{link.title}</div>}
      </div>
    </a>
  );
}

export function QuotedTweet({ tweet, headline }: { tweet: ItemTweet; headline?: string | null }) {
  return (
    <div className="well flex flex-col items-center gap-2 rounded-xl p-3 text-center">
      <AuthorLine tweet={tweet} compact />
      {tweet.isTombstone && !tweet.text ? (
        <div className="label-mono">This post is unavailable</div>
      ) : (
        <TweetText text={tweet.text} headline={headline} clamp className="text-[13px] text-muted-foreground" />
      )}
      <div className="w-full">
        <MediaGrid media={tweet.media} max={2} />
      </div>
    </div>
  );
}

export function TagChip({ tag, href, onRemove }: { tag: Pick<ItemTag, "name" | "color" | "slug">; href?: string; onRemove?: () => void }) {
  const color = tag.color ?? "#9AA7B8";
  const body = (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background/60 px-2 py-0.5 text-[11.5px] text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-0.5 rounded px-0.5 text-faint hover:text-foreground" aria-label={`Remove ${tag.name}`}>
          ×
        </button>
      )}
    </span>
  );
  return href ? <a href={href}>{body}</a> : body;
}
