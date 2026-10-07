CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "bookmark_tag_blocks" (
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "bookmark_tag_blocks_user_id_tweet_id_tag_id_pk" PRIMARY KEY("user_id","tweet_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "bookmark_tags" (
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"tag_id" uuid NOT NULL,
	"source" text NOT NULL,
	"confidence" real,
	CONSTRAINT "bookmark_tags_user_id_tweet_id_tag_id_pk" PRIMARY KEY("user_id","tweet_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"sort_index" text,
	"sort_key" numeric,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_run_id" uuid,
	"removed_at" timestamp with time zone,
	"note" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"ai_summary" text,
	"tagged_at" timestamp with time zone,
	"search_a" text DEFAULT '' NOT NULL,
	"search_b" text DEFAULT '' NOT NULL,
	"search_c" text DEFAULT '' NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(search_a, '')), 'A') || setweight(to_tsvector('simple', coalesce(search_b, '')), 'B') || setweight(to_tsvector('simple', coalesce(search_c, '')), 'C')) STORED,
	"search_en" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(search_a, ''))) STORED,
	CONSTRAINT "bookmarks_user_id_tweet_id_pk" PRIMARY KEY("user_id","tweet_id")
);
--> statement-breakpoint
CREATE TABLE "import_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"tweet_id" text NOT NULL,
	"url" text NOT NULL,
	"domain" text,
	"title" text,
	"description" text,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"tweet_id" text NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"video_url" text,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"alt_text" text,
	"archived_url" text
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"pages" integer DEFAULT 0 NOT NULL,
	"received" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"removed" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text,
	"author_handle" text,
	"author_handle_lc" text,
	"author_name" text,
	"author_avatar_url" text,
	"author_verified" boolean DEFAULT false NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"lang" text,
	"created_at" timestamp with time zone,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"retweet_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer,
	"conversation_id" text,
	"in_reply_to_tweet_id" text,
	"in_reply_to_handle" text,
	"quoted_tweet_id" text,
	"is_article" boolean DEFAULT false NOT NULL,
	"article_title" text,
	"has_media" boolean DEFAULT false NOT NULL,
	"has_video" boolean DEFAULT false NOT NULL,
	"has_link" boolean DEFAULT false NOT NULL,
	"is_tombstone" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmark_tag_blocks" ADD CONSTRAINT "bookmark_tag_blocks_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_tags_tag_idx" ON "bookmark_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "bookmarks_search_tsv_idx" ON "bookmarks" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "bookmarks_search_en_idx" ON "bookmarks" USING gin ("search_en");--> statement-breakpoint
CREATE INDEX "bookmarks_search_text_trgm_idx" ON "bookmarks" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "bookmarks_user_sort_idx" ON "bookmarks" USING btree ("user_id","sort_key" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookmarks_user_tagged_idx" ON "bookmarks" USING btree ("user_id","tagged_at");--> statement-breakpoint
CREATE INDEX "bookmarks_active_idx" ON "bookmarks" USING btree ("user_id") WHERE "bookmarks"."removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "import_tokens_hash_idx" ON "import_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "links_tweet_url_idx" ON "links" USING btree ("tweet_id","url");--> statement-breakpoint
CREATE INDEX "links_domain_idx" ON "links" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "media_tweet_position_idx" ON "media" USING btree ("tweet_id","position");--> statement-breakpoint
CREATE INDEX "sync_runs_user_started_idx" ON "sync_runs" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_slug_idx" ON "tags" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "tweets_author_handle_lc_idx" ON "tweets" USING btree ("author_handle_lc");--> statement-breakpoint
CREATE INDEX "tweets_author_handle_trgm_idx" ON "tweets" USING gin ("author_handle_lc" gin_trgm_ops);