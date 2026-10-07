export interface LibraryParams {
  q: string;
  tags: string[];
  author: string[];
  domain: string[];
  from: string;
  to: string;
  media: "" | "any" | "photo" | "video" | "none";
  link: boolean;
  pinned: boolean;
  removed: "exclude" | "include" | "only";
  sort: "" | "relevance" | "newest" | "oldest" | "likes";
}

export const EMPTY_PARAMS: LibraryParams = {
  q: "",
  tags: [],
  author: [],
  domain: [],
  from: "",
  to: "",
  media: "",
  link: false,
  pinned: false,
  removed: "exclude",
  sort: "",
};

type RawParams = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function paramsFromRecord(r: RawParams): LibraryParams {
  const media = one(r.media);
  const removed = one(r.removed);
  const sort = one(r.sort);
  return {
    q: one(r.q),
    tags: list(r.tags),
    author: list(r.author),
    domain: list(r.domain),
    from: one(r.from),
    to: one(r.to),
    media: (["any", "photo", "video", "none"].includes(media) ? media : "") as LibraryParams["media"],
    link: one(r.link) === "1" || one(r.link) === "true",
    pinned: one(r.pinned) === "1" || one(r.pinned) === "true",
    removed: (removed === "include" || removed === "only" ? removed : "exclude") as LibraryParams["removed"],
    sort: (["relevance", "newest", "oldest", "likes"].includes(sort) ? sort : "") as LibraryParams["sort"],
  };
}

export function paramsToSearch(p: LibraryParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.tags.length) sp.set("tags", p.tags.join(","));
  if (p.author.length) sp.set("author", p.author.join(","));
  if (p.domain.length) sp.set("domain", p.domain.join(","));
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.media) sp.set("media", p.media);
  if (p.link) sp.set("link", "1");
  if (p.pinned) sp.set("pinned", "1");
  if (p.removed !== "exclude") sp.set("removed", p.removed);
  if (p.sort) sp.set("sort", p.sort);
  return sp;
}

export function activeFilterCount(p: LibraryParams): number {
  return (
    p.tags.length +
    p.author.length +
    p.domain.length +
    (p.from || p.to ? 1 : 0) +
    (p.media ? 1 : 0) +
    (p.link ? 1 : 0) +
    (p.pinned ? 1 : 0) +
    (p.removed !== "exclude" ? 1 : 0)
  );
}
