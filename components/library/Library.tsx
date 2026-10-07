"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookmarkCard, copyLink, togglePin, type CardDialog } from "@/components/bookmark/BookmarkCard";
import type { BookmarkItem, Facet, SearchResponse } from "@/lib/bookmarks/types";
import { tweetUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryRail } from "./CategoryRail";
import { FilterBar } from "./FilterBar";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { activeFilterCount, paramsToSearch, type LibraryParams } from "./params";

const SORT_LABELS: Record<string, string> = {
  relevance: "Relevance",
  newest: "Newest",
  oldest: "Oldest",
  likes: "Most liked",
};

function useColumnCount() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1100px)");
    const update = () => setCols(lg.matches ? 3 : md.matches ? 2 : 1);
    update();
    md.addEventListener("change", update);
    lg.addEventListener("change", update);
    return () => {
      md.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, []);
  return cols;
}

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

export function Library({
  initialParams,
  initial,
  allTags,
  stats,
}: {
  initialParams: LibraryParams;
  initial: SearchResponse;
  allTags: Facet[];
  stats: { bookmarks: number; authors: number; tags: number };
}) {
  const router = useRouter();
  const [params, setParams] = useState(initialParams);
  const [query, setQuery] = useState(initialParams.q);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [dialog, setDialog] = useState<{ index: number; kind: CardDialog }>({ index: -1, kind: null });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const firstRender = useRef(true);
  const cols = useColumnCount();

  const update = useCallback((patch: Partial<LibraryParams>) => setParams((p) => ({ ...p, ...patch })), []);

  // Debounce the search box into params.
  useEffect(() => {
    if (query === params.q) return;
    const t = setTimeout(() => update({ q: query }), 150);
    return () => clearTimeout(t);
  }, [query, params.q, update]);

  // Sync params to the URL and fetch.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const sp = paramsToSearch(params);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
    const id = ++requestId.current;
    setLoading(true);
    fetch(`/api/search?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Search failed (${r.status})`))))
      .then((res: SearchResponse) => {
        if (id !== requestId.current) return;
        setData(res);
        setFocusIndex(-1);
      })
      .catch(() => {})
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [params]);

  const loadMore = useCallback(async () => {
    if (!data.nextCursor || loadingMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const sp = paramsToSearch(params);
      sp.set("cursor", data.nextCursor);
      const res: SearchResponse = await fetch(`/api/search?${sp}`).then((r) => r.json());
      if (id !== requestId.current) return;
      setData((d) => ({ ...d, items: [...d.items, ...res.items], nextCursor: res.nextCursor }));
    } finally {
      setLoadingMore(false);
    }
  }, [data.nextCursor, loadingMore, params]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const updateItem = useCallback((item: BookmarkItem) => {
    setData((d) => ({ ...d, items: d.items.map((i) => (i.tweetId === item.tweetId ? item : i)) }));
  }, []);

  const focusCard = useCallback((i: number) => {
    const el = cardRefs.current[i];
    if (!el) return;
    setFocusIndex(i);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        update({ q: "" });
        return;
      }
      if (isTyping(e.target)) return;
      const item = focusIndex >= 0 ? data.items[focusIndex] : undefined;
      switch (e.key) {
        case "/":
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
          break;
        case "j":
          e.preventDefault();
          focusCard(Math.min(focusIndex + 1, data.items.length - 1));
          break;
        case "k":
          e.preventDefault();
          focusCard(Math.max(focusIndex - 1, 0));
          break;
        case "?":
          setShowShortcuts(true);
          break;
        case "o":
          if (item) window.open(tweetUrl(item.tweet.authorHandle, item.tweetId), "_blank", "noopener");
          break;
        case "Enter":
          if (item && e.target === cardRefs.current[focusIndex]) router.push(`/b/${item.tweetId}`);
          break;
        case "p":
          if (item) void togglePin(item, updateItem);
          break;
        case "n":
          if (item) {
            e.preventDefault();
            setDialog({ index: focusIndex, kind: "note" });
          }
          break;
        case "t":
          if (item) {
            e.preventDefault();
            setDialog({ index: focusIndex, kind: "tags" });
          }
          break;
        case "c":
          if (item) void copyLink(item);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.items, focusIndex, focusCard, router, update, updateItem]);

  const effectiveSort = params.sort || (params.q.trim() ? "relevance" : "newest");
  const tagFacets = data.facets.tags.length ? data.facets.tags : allTags;
  const facets = useMemo(() => ({ ...data.facets, tags: tagFacets }), [data.facets, tagFacets]);

  // Round-robin columns keep left-to-right reading order with stable placement on append.
  const columns = useMemo(() => {
    const out: { item: BookmarkItem; index: number }[][] = Array.from({ length: cols }, () => []);
    data.items.forEach((item, index) => out[index % cols].push({ item, index }));
    return out;
  }, [data.items, cols]);

  const hasQueryOrFilters = !!params.q.trim() || activeFilterCount(params) > 0;

  return (
    <div className="flex flex-col items-center gap-8">
      <section className="rise flex w-full flex-col items-center gap-6 pt-4 text-center">
        <div className="flex items-center gap-2">
          <span className="label-mono text-brand">01</span>
          <span className="h-px w-6 bg-hairline-strong" />
          <span className="label-mono">Library</span>
        </div>
        <h1 className="font-serif text-[56px] leading-[0.92] tracking-[-0.03em] sm:text-[84px]">
          Every bookmark,
          <br />
          <span className="text-muted-foreground italic">findable.</span>
        </h1>
        <div className="etched flex items-stretch rounded-xl">
          {[
            ["Bookmarks", stats.bookmarks],
            ["Authors", stats.authors],
            ["Categories", stats.tags],
          ].map(([label, value], i) => (
            <div key={label} className="flex items-stretch">
              {i > 0 && <span className="my-2 w-px bg-hairline" />}
              <div className="flex flex-col items-center gap-1 px-5 py-2.5 sm:px-7">
                <span className="tabular text-lg font-semibold tracking-[-0.02em]">{Number(value).toLocaleString()}</span>
                <span className="label-mono">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="rise flex w-full flex-col items-center gap-4 [animation-delay:80ms]">
        <div className="group relative w-full max-w-2xl">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-[18px] -translate-y-1/2 text-faint transition-colors group-focus-within:text-brand" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text, people, links, tags"
            aria-label="Search bookmarks"
            className="etched h-14 w-full rounded-2xl px-14 text-center text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand/50 focus:shadow-[inset_0_1px_0_0_var(--highlight),0_0_0_4px_var(--mark)]"
          />
          {loading ? (
            <Loader2 className="absolute top-1/2 right-5 size-[18px] -translate-y-1/2 animate-spin text-faint" />
          ) : (
            <kbd className="well absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-faint sm:block">/</kbd>
          )}
        </div>
        <p className="label-mono hidden sm:block">
          Try from:handle &nbsp; has:video &nbsp; site:github.com &nbsp; tag:design &nbsp; &quot;exact phrase&quot; &nbsp; -exclude
        </p>

        <FilterBar params={params} facets={facets} update={update} />

        <CategoryRail categories={allTags} selected={params.tags} onSelect={(slug) => update({ tags: slug ? [slug] : [] })} />
      </div>

      <div className="flex w-full items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="label-mono tabular text-muted-foreground">
            {data.total.toLocaleString()} {data.total === 1 ? "result" : "results"}
          </span>
          <span className="h-3 w-px bg-hairline-strong" />
          <DropdownMenu>
            <DropdownMenuTrigger className="label-mono rounded-md px-1.5 py-1 transition-colors hover:bg-raised hover:text-foreground">
              Sort / {SORT_LABELS[effectiveSort]}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(params.q.trim() ? ["relevance", "newest", "oldest", "likes"] : ["newest", "oldest", "likes"]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => update({ sort: s as LibraryParams["sort"] })} className="justify-center">
                  {SORT_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {data.fuzzy && (
            <>
              <span className="h-3 w-px bg-hairline-strong" />
              <span className="label-mono text-brand">Showing close matches</span>
            </>
          )}
        </div>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {data.items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <span className="label-mono">{hasQueryOrFilters ? "No matches" : "Empty archive"}</span>
          <p className="font-serif text-3xl tracking-[-0.02em]">{hasQueryOrFilters ? "Nothing matches that." : "Nothing here yet."}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasQueryOrFilters
              ? "Try fewer words or clear a filter."
              : "Run a sync from the Trove Sync extension and your X bookmarks will show up here."}
          </p>
        </div>
      ) : (
        <div
          className={cn("grid w-full items-start gap-3 transition-opacity duration-200", loading && "opacity-50")}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {columns.map((col, ci) => (
            <div key={ci} className="flex min-w-0 flex-col gap-3">
              {col.map(({ item, index }) => (
                <BookmarkCard
                  key={item.tweetId}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  item={item}
                  index={index}
                  allTags={allTags}
                  focused={focusIndex === index}
                  onFocus={() => setFocusIndex(index)}
                  onUpdate={updateItem}
                  dialog={dialog.index === index ? dialog.kind : null}
                  onDialogChange={(kind) => setDialog({ index: kind ? index : -1, kind })}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex h-10 items-center justify-center">
        {loadingMore ? (
          <Loader2 className="size-4 animate-spin text-faint" />
        ) : (
          !data.nextCursor && data.items.length > 0 && <span className="label-mono">End of archive</span>
        )}
      </div>

      <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}
