import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const tweets = pgTable(
  "tweets",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id"),
    authorHandle: text("author_handle"),
    authorHandleLc: text("author_handle_lc"),
    authorName: text("author_name"),
    authorAvatarUrl: text("author_avatar_url"),
    authorVerified: boolean("author_verified").notNull().default(false),
    text: text("text").notNull().default(""),
    lang: text("lang"),
    createdAt: ts("created_at"),
    replyCount: integer("reply_count").notNull().default(0),
    retweetCount: integer("retweet_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    quoteCount: integer("quote_count").notNull().default(0),
    viewCount: integer("view_count"),
    conversationId: text("conversation_id"),
    inReplyToTweetId: text("in_reply_to_tweet_id"),
    inReplyToHandle: text("in_reply_to_handle"),
    quotedTweetId: text("quoted_tweet_id"),
    isArticle: boolean("is_article").notNull().default(false),
    articleTitle: text("article_title"),
    hasMedia: boolean("has_media").notNull().default(false),
    hasVideo: boolean("has_video").notNull().default(false),
    hasLink: boolean("has_link").notNull().default(false),
    isTombstone: boolean("is_tombstone").notNull().default(false),
    raw: jsonb("raw"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("tweets_author_handle_lc_idx").on(t.authorHandleLc),
    index("tweets_author_handle_trgm_idx").using("gin", sql`${t.authorHandleLc} gin_trgm_ops`),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id").notNull(),
    tweetId: text("tweet_id")
      .notNull()
      .references(() => tweets.id),
    sortIndex: text("sort_index"),
    sortKey: numeric("sort_key"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenRunId: uuid("last_seen_run_id"),
    removedAt: ts("removed_at"),
    note: text("note"),
    pinned: boolean("pinned").notNull().default(false),
    aiSummary: text("ai_summary"),
    taggedAt: ts("tagged_at"),
    searchA: text("search_a").notNull().default(""),
    searchB: text("search_b").notNull().default(""),
    searchC: text("search_c").notNull().default(""),
    searchText: text("search_text").notNull().default(""),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(search_a, '')), 'A') || setweight(to_tsvector('simple', coalesce(search_b, '')), 'B') || setweight(to_tsvector('simple', coalesce(search_c, '')), 'C')`,
    ),
    searchEn: tsvector("search_en").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(search_a, ''))`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.tweetId] }),
    index("bookmarks_search_tsv_idx").using("gin", t.searchTsv),
    index("bookmarks_search_en_idx").using("gin", t.searchEn),
    index("bookmarks_search_text_trgm_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
    index("bookmarks_user_sort_idx").on(t.userId, t.sortKey.desc()),
    index("bookmarks_user_tagged_idx").on(t.userId, t.taggedAt),
    index("bookmarks_active_idx").on(t.userId).where(sql`${t.removedAt} is null`),
  ],
);

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    tweetId: text("tweet_id")
      .notNull()
      .references(() => tweets.id),
    position: integer("position").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    videoUrl: text("video_url"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    altText: text("alt_text"),
    archivedUrl: text("archived_url"),
  },
  (t) => [uniqueIndex("media_tweet_position_idx").on(t.tweetId, t.position)],
);

export const links = pgTable(
  "links",
  {
    id: serial("id").primaryKey(),
    tweetId: text("tweet_id")
      .notNull()
      .references(() => tweets.id),
    url: text("url").notNull(),
    domain: text("domain"),
    title: text("title"),
    description: text("description"),
    imageUrl: text("image_url"),
  },
  (t) => [
    uniqueIndex("links_tweet_url_idx").on(t.tweetId, t.url),
    index("links_domain_idx").on(t.domain),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Comma separated rules for the free categorizer: words, "phrases", site.com, @handle. */
    keywords: text("keywords"),
    color: text("color"),
    createdBy: text("created_by").notNull().default("system"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_user_slug_idx").on(t.userId, t.slug)],
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    userId: text("user_id").notNull(),
    tweetId: text("tweet_id").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    confidence: real("confidence"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.tweetId, t.tagId] }),
    index("bookmark_tags_tag_idx").on(t.tagId),
  ],
);

export const bookmarkTagBlocks = pgTable(
  "bookmark_tag_blocks",
  {
    userId: text("user_id").notNull(),
    tweetId: text("tweet_id").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tweetId, t.tagId] })],
);

export const importTokens = pgTable(
  "import_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    prefix: text("prefix").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("import_tokens_hash_idx").on(t.tokenHash)],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    mode: text("mode").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    pages: integer("pages").notNull().default(0),
    received: integer("received").notNull().default(0),
    inserted: integer("inserted").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    removed: integer("removed").notNull().default(0),
    status: text("status").notNull().default("running"),
    error: text("error"),
  },
  (t) => [index("sync_runs_user_started_idx").on(t.userId, t.startedAt.desc())],
);

/** Per-user settings. Secrets are stored encrypted (AES-256-GCM, see lib/crypto.ts). */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  anthropicKeyEnc: text("anthropic_key_enc"),
  anthropicKeyHint: text("anthropic_key_hint"),
  /** When the last full Claude recategorize started; used for a cooldown so it cannot be re-run by accident. */
  lastClaudeRecategorizeAt: ts("last_claude_recategorize_at"),
  /** Short lease so only one worker sorts with Claude at a time (no double spending). */
  taggingLeaseUntil: ts("tagging_lease_until"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type Tweet = typeof tweets.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
