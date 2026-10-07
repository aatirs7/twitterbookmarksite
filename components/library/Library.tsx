"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookmarkCard, copyLink, togglePin, type CardDialog } from "@/components/bookmark/BookmarkCard";
import type { BookmarkItem, Facet, SearchResponse } from "@/lib/bookmarks/types";
import { tweetUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryRail } from "./CategoryRail";
import { ActiveFilters, FiltersButton } from "./FilterBar";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { activeFilterCount, paramsToSearch, type LibraryParams } from "./params";

const SORT_LABELS: Record<string, string> = {
  relevance: "Relevance",
  newest: "Newest",
  oldest: "Oldest",
  likes: "Most liked",
};

/** Zoom levels: 0 is the largest cards; each step out adds a column (up to the viewport's limit). */
const ZOOM_LEVELS = 4;
const ZOOM_KEY = "xbv:zoom";

function useColumnCount(zoom: number) {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1100px)");
    const update = () => {
      const base = lg.matches ? 3 : md.matches ? 2 : 1;
      const max = lg.matches ? 5 : md.matches ? 3 : 2;
      setCols(Math.min(max, Math.max(1, base + zoom - 1)));
    };
    update();
    md.addEventListener("change", update);
    lg.addEventListener("change", update);
    return () => {
      md.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, [zoom]);
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
  const [zoom, setZoomState] = useState(1);
  const cols = useColumnCount(zoom);
  const compact = cols >= 4;
  const setZoom = useCallback((z: number) => {
    const next = Math.min(ZOOM_LEVELS - 1, Math.max(0, z));
    setZoomState(next);
    try {
      localStorage.setItem(ZOOM_KEY, String(next));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ZOOM_KEY);
      const saved = raw === null ? NaN : Number(raw);
      // Restored after hydration on purpose: reading storage during render would mismatch the server HTML.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number.isInteger(saved) && saved >= 0 && saved < ZOOM_LEVELS) setZoomState(saved);
    } catch {}
  }, []);

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
        case "-":
          setZoom(zoom + 1);
          break;
        case "=":
        case "+":
          setZoom(zoom - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.items, focusIndex, focusCard, router, update, updateItem, zoom, setZoom]);

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
    <div className="flex flex-col items-center gap-6">
      <section className="rise flex flex-col items-center gap-3 pt-2 text-center">
        <h1 className="font-serif text-[40px] leading-none tracking-[-0.03em] sm:text-[56px]">
          Every bookmark, <span className="text-muted-foreground italic">findable.</span>
        </h1>
        <p className="label-mono tabular">
          <span className="text-foreground">{stats.bookmarks.toLocaleString()}</span> saved
          <span className="mx-2.5 text-hairline-strong">/</span>
          <span className="text-foreground">{stats.authors.toLocaleString()}</span> authors
          <span className="mx-2.5 text-hairline-strong">/</span>
          <span className="text-foreground">{stats.tags.toLocaleString()}</span> categories
        </p>
      </section>

      <div className="rise flex w-full flex-col items-center gap-3 [animation-delay:60ms]">
        <div className="group relative w-full max-w-2xl">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-[18px] -translate-y-1/2 text-faint transition-colors group-focus-within:text-brand" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text, people, links"
            aria-label="Search bookmarks"
            className="etched h-13 w-full rounded-2xl px-14 text-center text-[15.5px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand/50 focus:shadow-[inset_0_1px_0_0_var(--highlight),0_0_0_4px_var(--mark)]"
          />
          {loading ? (
            <Loader2 className="absolute top-1/2 right-5 size-[18px] -translate-y-1/2 animate-spin text-faint" />
          ) : (
            <kbd className="well absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-faint sm:block">/</kbd>
          )}
          {/* Operator hints only while typing, so the page stays calm. */}
          <p
            className={cn(
              "label-mono pointer-events-none absolute inset-x-0 top-full mt-2 hidden text-center opacity-0 transition-opacity duration-200 sm:block",
              query && "group-focus-within:opacity-100",
            )}
          >
            from:handle &nbsp; has:video &nbsp; site:github.com &nbsp; &quot;exact phrase&quot; &nbsp; -exclude
          </p>
        </div>

        <div className="mt-6 flex w-full justify-center">
          <CategoryRail categories={allTags} selected={params.tags} onSelect={(slug) => update({ tags: slug ? [slug] : [] })} />
        </div>
      </div>

      <div className="flex w-full items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <FiltersButton params={params} facets={facets} update={update} />
          <span className="h-3 w-px bg-hairline-strong" />
          <span className="label-mono tabular px-1.5 text-muted-foreground">
            {data.total.toLocaleString()} {data.total === 1 ? "result" : "results"}
          </span>
          <span className="h-3 w-px bg-hairline-strong" />
          <DropdownMenu>
            <DropdownMenuTrigger className="label-mono rounded-md px-2 py-1 transition-colors hover:bg-raised hover:text-foreground">
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
          <span className="h-3 w-px bg-hairline-strong" />
          <ZoomControl zoom={zoom} onChange={setZoom} />
          {data.fuzzy && (
            <>
              <span className="h-3 w-px bg-hairline-strong" />
              <span className="label-mono px-1.5 text-brand">Close matches</span>
            </>
          )}
        </div>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <ActiveFilters params={params} facets={facets} update={update} />

      {data.items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <span className="label-mono">{hasQueryOrFilters ? "No matches" : "Empty archive"}</span>
          <p className="font-serif text-3xl tracking-[-0.02em]">{hasQueryOrFilters ? "Nothing matches that." : "Nothing here yet."}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasQueryOrFilters
              ? "Try fewer words or clear a filter."
              : "Run a sync from the extension and your X bookmarks will show up here."}
          </p>
        </div>
      ) : (
        <div
          className={cn("card-grid grid w-full items-start transition-opacity duration-200", compact ? "gap-2" : "gap-3", loading && "opacity-50")}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {columns.map((col, ci) => (
            <div key={ci} className={cn("flex min-w-0 flex-col", compact ? "gap-2" : "gap-3")}>
              {col.map(({ item, index }) => (
                <BookmarkCard
                  key={item.tweetId}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  item={item}
                  index={index}
                  compact={compact}
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

function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const btn = "inline-flex size-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Card size">
      <button type="button" className={btn} disabled={zoom >= ZOOM_LEVELS - 1} onClick={() => onChange(zoom + 1)} aria-label="Zoom out (-)" title="Zoom out (-)">
        <Minus className="size-3" />
      </button>
      <span className="flex items-center gap-[3px] px-1" aria-hidden>
        {Array.from({ length: ZOOM_LEVELS }, (_, i) => (
          <span key={i} className={cn("h-2.5 w-[3px] rounded-full transition-colors", i <= zoom ? "bg-brand" : "bg-hairline-strong")} />
        ))}
      </span>
      <button type="button" className={btn} disabled={zoom <= 0} onClick={() => onChange(zoom - 1)} aria-label="Zoom in (=)" title="Zoom in (=)">
        <Plus className="size-3" />
      </button>
    </div>
  );
}
