export interface ItemMedia {
  type: "photo" | "video" | "animated_gif";
  url: string;
  videoUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  altText: string | null;
}

export interface ItemLink {
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface ItemTweet {
  id: string;
  authorHandle: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorVerified: boolean;
  text: string;
  createdAt: string | null;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number | null;
  inReplyToHandle: string | null;
  isArticle: boolean;
  articleTitle: string | null;
  isTombstone: boolean;
  media: ItemMedia[];
  links: ItemLink[];
  quoted: ItemTweet | null;
}

export interface ItemTag {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  source: "ai" | "user";
}

export interface BookmarkItem {
  tweetId: string;
  bookmarkedAt: string;
  removedAt: string | null;
  note: string | null;
  pinned: boolean;
  aiSummary: string | null;
  /** Tweet text with matches wrapped in HL_START ... HL_END sentinels (rendered as <mark>). */
  headline: string | null;
  tweet: ItemTweet;
  tags: ItemTag[];
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface SearchResponse {
  items: BookmarkItem[];
  nextCursor: string | null;
  total: number;
  fuzzy: boolean;
  facets: { tags: Facet[]; authors: Facet[]; domains: Facet[] };
}

export const HL_START = String.fromCharCode(1);
export const HL_END = String.fromCharCode(2);
