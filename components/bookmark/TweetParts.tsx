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
        className="flex shrink-0 items-center justify-center rounded-full bg-raised text-xs font-medium text-muted-foreground"
        style={{ width: size, height: size }}
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
      className="shrink-0 rounded-full bg-raised object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function AuthorLine({ tweet, compact }: { tweet: ItemTweet; compact?: boolean }) {
  if (tweet.isTombstone && !tweet.authorHandle) {
    return <div className="text-sm text-muted-foreground">Unavailable post</div>;
  }
  return (
    <div className={cn("flex flex-col items-center gap-1", compact && "flex-row justify-center gap-2")}>
      <Avatar src={tweet.authorAvatarUrl} name={tweet.authorName} size={compact ? 20 : 36} />
      <div className={cn("flex flex-wrap items-center justify-center gap-x-1.5 text-sm", compact && "text-xs")}>
        <span className="font-medium text-foreground">{tweet.authorName ?? tweet.authorHandle}</span>
        {tweet.authorVerified && <BadgeCheck className="size-3.5 text-brand" aria-label="Verified" />}
        {tweet.authorHandle && <span className="text-muted-foreground">@{tweet.authorHandle}</span>}
        {tweet.createdAt && (
          <a
            href={tweetUrl(tweet.authorHandle, tweet.id)}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:underline"
            title={new Date(tweet.createdAt).toLocaleString()}
          >
            · {relativeDate(tweet.createdAt)}
          </a>
        )}
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
              className="max-h-[80vh] w-full rounded-xl bg-raised"
            />
          ) : (
            <a key={i} href={m.url.replace(/(\.\w+)$/, "$1?name=large")} target="_blank" rel="noreferrer noopener">
              <img src={m.url} alt={m.altText ?? ""} loading="lazy" className="max-h-[80vh] w-auto rounded-xl bg-raised" />
            </a>
          ),
        )}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-xl", shown.length > 1 && "grid-cols-2")}>
      {shown.map((m, i) => (
        <div
          key={i}
          className={cn("relative overflow-hidden bg-raised", shown.length === 3 && i === 0 && "row-span-2")}
          style={{ aspectRatio: shown.length === 1 && m.width && m.height ? `${m.width} / ${m.height}` : "1 / 1" }}
        >
          <img src={m.url} alt={m.altText ?? ""} loading="lazy" className="size-full max-h-96 object-cover" />
          {m.type !== "photo" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                <Play className="size-3 fill-current" />
                {m.type === "animated_gif" ? "GIF" : duration(m.durationMs)}
              </span>
            </div>
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
      className="flex flex-col items-center overflow-hidden rounded-xl border border-border bg-raised/40 text-center transition-colors hover:bg-raised"
    >
      {link.imageUrl && <img src={link.imageUrl} alt="" loading="lazy" className="max-h-48 w-full object-cover" />}
      <div className="flex flex-col items-center gap-0.5 px-3 py-2">
        {link.title && <div className="line-clamp-2 text-sm font-medium">{link.title}</div>}
        {link.domain && <div className="text-xs text-muted-foreground">{link.domain}</div>}
      </div>
    </a>
  );
}

export function QuotedTweet({ tweet, headline }: { tweet: ItemTweet; headline?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background/40 p-3 text-center">
      <AuthorLine tweet={tweet} compact />
      {tweet.isTombstone && !tweet.text ? (
        <div className="text-sm text-muted-foreground">This post is unavailable.</div>
      ) : (
        <TweetText text={tweet.text} headline={headline} clamp className="text-sm" />
      )}
      <MediaGrid media={tweet.media} max={2} />
    </div>
  );
}

export function TagChip({ tag, href, onRemove }: { tag: Pick<ItemTag, "name" | "color" | "slug">; href?: string; onRemove?: () => void }) {
  const color = tag.color ?? "#9AA7B8";
  const body = (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}1f`, color }}
    >
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 rounded-full px-1 opacity-70 hover:opacity-100" aria-label={`Remove ${tag.name}`}>
          ×
        </button>
      )}
    </span>
  );
  return href ? <a href={href}>{body}</a> : body;
}
