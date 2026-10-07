import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { DetailEditor } from "@/components/bookmark/DetailEditor";
import { RelatedGrid } from "@/components/bookmark/RelatedGrid";
import { AuthorLine, LinkCard, MediaGrid, QuotedTweet } from "@/components/bookmark/TweetParts";
import { TweetText } from "@/components/bookmark/TweetText";
import { requireUser } from "@/lib/auth/user";
import { hydrateBookmarks, type BaseRow } from "@/lib/bookmarks/hydrate";
import { relatedBookmarks } from "@/lib/bookmarks/related";
import { compactNumber, fullDate, tweetUrl } from "@/lib/format";
import { listUserTags } from "@/lib/tags/queries";

export default async function BookmarkDetailPage({ params }: PageProps<"/b/[tweetId]">) {
  const userId = await requireUser();
  const { tweetId } = await params;
  const res = await db.execute(sql`
    select tweet_id, sort_key, first_seen_at, removed_at, note, pinned, ai_summary
    from bookmarks where user_id = ${userId} and tweet_id = ${tweetId}
  `);
  const [item] = await hydrateBookmarks(userId, res.rows as unknown as BaseRow[]);
  if (!item) notFound();
  const [related, tags] = await Promise.all([relatedBookmarks(userId, tweetId), listUserTags(userId)]);
  const allTags = tags.map(({ value, label, count, color }) => ({ value, label, count, color }));
  const { tweet } = item;

  const metrics: [string, number | null][] = [
    ["Replies", tweet.replyCount],
    ["Reposts", tweet.retweetCount],
    ["Quotes", tweet.quoteCount],
    ["Likes", tweet.likeCount],
    ["Views", tweet.viewCount],
  ];

  return (
    <div className="flex flex-col items-center gap-10">
      <article className="etched rise flex w-full max-w-2xl flex-col items-center gap-5 rounded-2xl p-6 text-center sm:p-10">
        <AuthorLine tweet={tweet} />
        {tweet.inReplyToHandle && <div className="text-xs text-muted-foreground">Replying to @{tweet.inReplyToHandle}</div>}
        {tweet.isArticle && tweet.articleTitle && <h1 className="font-serif text-4xl leading-tight tracking-[-0.02em]">{tweet.articleTitle}</h1>}
        {tweet.isTombstone && !tweet.text ? (
          <p className="text-muted-foreground">This post is no longer available on X.</p>
        ) : (
          <TweetText text={tweet.text} className="text-[17px] leading-[1.65]" />
        )}
        <div className="w-full">
          <MediaGrid media={tweet.media} full />
        </div>
        {tweet.links.map((l) => (
          <div key={l.url} className="flex w-full flex-col items-center gap-1">
            <LinkCard link={l} />
            <a href={l.url} target="_blank" rel="noreferrer noopener" className="max-w-full truncate text-xs text-brand hover:underline">
              {l.url}
            </a>
          </div>
        ))}
        {tweet.quoted && (
          <div className="w-full">
            <QuotedTweet tweet={tweet.quoted} />
          </div>
        )}

        {!tweet.isTombstone && (
          <div className="flex w-full flex-wrap items-stretch justify-center gap-y-2 border-y border-hairline py-3">
            {metrics
              .filter(([, v]) => v !== null)
              .map(([label, v]) => (
                <span key={label} className="flex flex-col items-center gap-0.5 px-4">
                  <span className="tabular text-base font-semibold">{compactNumber(v)}</span>
                  <span className="label-mono">{label}</span>
                </span>
              ))}
          </div>
        )}

        <div className="label-mono flex flex-col items-center gap-1.5">
          {tweet.createdAt && <span>Posted {fullDate(tweet.createdAt)}</span>}
          <span>Bookmarked around {fullDate(item.bookmarkedAt)}</span>
          {item.removedAt && <span>Removed from X bookmarks {fullDate(item.removedAt)}</span>}
          <a href={tweetUrl(tweet.authorHandle, tweet.id)} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
            Open on X
          </a>
        </div>

        {item.aiSummary && <p className="max-w-lg font-serif text-xl leading-snug text-muted-foreground italic">{item.aiSummary}</p>}

        <DetailEditor item={item} allTags={allTags} />
      </article>

      {related.length > 0 && (
        <section className="flex w-full flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="label-mono text-brand">Related</span>
            <span className="h-px w-6 bg-hairline-strong" />
            <span className="label-mono">{related.length} close by</span>
          </div>
          <RelatedGrid items={related} allTags={allTags} />
        </section>
      )}

      <Link href="/" className="label-mono hover:text-foreground">
        Back to library
      </Link>
    </div>
  );
}
