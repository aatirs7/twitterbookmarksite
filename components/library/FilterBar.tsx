"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Facet, SearchResponse } from "@/lib/bookmarks/types";
import { cn } from "@/lib/utils";
import type { LibraryParams } from "./params";

type Update = (patch: Partial<LibraryParams>) => void;

const chipBase =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:bg-raised hover:text-foreground";

function Chip({ active, children, ...rest }: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button type="button" {...rest} className={cn(chipBase, active && "bg-brand/10 text-foreground ring-1 ring-brand/35")}>
      {children}
    </button>
  );
}

function PopoverChip({ label, active, children, wide }: { label: string; active?: boolean; children: React.ReactNode; wide?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger className={cn(chipBase, active && "bg-brand/10 text-foreground ring-1 ring-brand/35")}>
        {label}
        <ChevronDown className="size-3 text-faint" />
      </PopoverTrigger>
      <PopoverContent className={cn("items-center text-center", wide ? "w-80" : "w-64")}>{children}</PopoverContent>
    </Popover>
  );
}

function FacetList({ facets, selected, onToggle, empty }: { facets: Facet[]; selected: string[]; onToggle: (v: string) => void; empty: string }) {
  if (facets.length === 0) return <p className="py-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex max-h-72 w-full flex-wrap justify-center gap-1.5 overflow-y-auto py-1">
      {facets.map((f) => {
        const on = selected.includes(f.value);
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onToggle(f.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
              on ? "border-brand/60 bg-brand/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={f.color && !on ? { color: f.color, borderColor: `${f.color}55` } : undefined}
          >
            {f.label}
            <span className="opacity-60">{f.count}</span>
          </button>
        );
      })}
    </div>
  );
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FilterBar({ params, facets, update }: { params: LibraryParams; facets: SearchResponse["facets"]; update: Update }) {
  const [authorQuery, setAuthorQuery] = useState("");
  const [domainQuery, setDomainQuery] = useState("");

  const active: { key: string; label: string; clear: () => void }[] = [
    ...params.tags.map((t) => ({
      key: `tag:${t}`,
      label: `#${facets.tags.find((f) => f.value === t)?.label ?? t}`,
      clear: () => update({ tags: params.tags.filter((x) => x !== t) }),
    })),
    ...params.author.map((a) => ({ key: `author:${a}`, label: `@${a}`, clear: () => update({ author: params.author.filter((x) => x !== a) }) })),
    ...params.domain.map((d) => ({ key: `domain:${d}`, label: d, clear: () => update({ domain: params.domain.filter((x) => x !== d) }) })),
    ...(params.from || params.to
      ? [{ key: "date", label: `${params.from || "start"} to ${params.to || "now"}`, clear: () => update({ from: "", to: "" }) }]
      : []),
    ...(params.media ? [{ key: "media", label: `Media: ${params.media}`, clear: () => update({ media: "" }) }] : []),
    ...(params.link ? [{ key: "link", label: "Has link", clear: () => update({ link: false }) }] : []),
    ...(params.pinned ? [{ key: "pinned", label: "Pinned", clear: () => update({ pinned: false }) }] : []),
    ...(params.removed !== "exclude"
      ? [{ key: "removed", label: params.removed === "only" ? "Removed only" : "Including removed", clear: () => update({ removed: "exclude" }) }]
      : []),
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="etched flex flex-wrap items-center justify-center gap-0.5 rounded-xl p-1">
        <PopoverChip label="Category" active={params.tags.length > 0} wide>
          <FacetList facets={facets.tags} selected={params.tags} onToggle={(v) => update({ tags: toggle(params.tags, v) })} empty="No tags yet" />
        </PopoverChip>

        <PopoverChip label="Author" active={params.author.length > 0}>
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              const v = authorQuery.trim().replace(/^@/, "").toLowerCase();
              if (v) update({ author: toggle(params.author, v) });
              setAuthorQuery("");
            }}
          >
            <Input value={authorQuery} onChange={(e) => setAuthorQuery(e.target.value)} placeholder="@handle" className="text-center" />
          </form>
          <FacetList
            facets={facets.authors.map((a) => ({ ...a, label: `@${a.value}` }))}
            selected={params.author}
            onToggle={(v) => update({ author: toggle(params.author, v) })}
            empty="No authors"
          />
        </PopoverChip>

        <PopoverChip label="Date" active={!!(params.from || params.to)}>
          <div className="flex w-full flex-col items-center gap-2 text-sm">
            <label className="flex w-full flex-col items-center gap-1">
              <span className="text-muted-foreground">From</span>
              <Input type="date" value={params.from} onChange={(e) => update({ from: e.target.value })} className="text-center" />
            </label>
            <label className="flex w-full flex-col items-center gap-1">
              <span className="text-muted-foreground">To</span>
              <Input type="date" value={params.to} onChange={(e) => update({ to: e.target.value })} className="text-center" />
            </label>
          </div>
        </PopoverChip>

        <PopoverChip label="Media" active={!!params.media}>
          <div className="flex flex-wrap justify-center gap-1.5">
            {(["", "any", "photo", "video", "none"] as const).map((m) => (
              <Chip key={m || "all"} active={params.media === m} onClick={() => update({ media: m })}>
                {m === "" ? "All" : m === "any" ? "Any media" : m === "none" ? "No media" : m === "photo" ? "Photos" : "Videos"}
              </Chip>
            ))}
          </div>
        </PopoverChip>

        <PopoverChip label="Links" active={params.link || params.domain.length > 0}>
          <Chip active={params.link} onClick={() => update({ link: !params.link })}>
            Has a link
          </Chip>
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              const v = domainQuery.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
              if (v) update({ domain: toggle(params.domain, v) });
              setDomainQuery("");
            }}
          >
            <Input value={domainQuery} onChange={(e) => setDomainQuery(e.target.value)} placeholder="domain.com" className="text-center" />
          </form>
          <FacetList facets={facets.domains} selected={params.domain} onToggle={(v) => update({ domain: toggle(params.domain, v) })} empty="No links" />
        </PopoverChip>

        <Chip active={params.pinned} onClick={() => update({ pinned: !params.pinned })}>
          Pinned
        </Chip>

        <PopoverChip label="Removed" active={params.removed !== "exclude"}>
          <p className="text-xs text-muted-foreground">Bookmarks you removed on X, found by a full resync</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {(["exclude", "include", "only"] as const).map((r) => (
              <Chip key={r} active={params.removed === r} onClick={() => update({ removed: r })}>
                {r === "exclude" ? "Hide" : r === "include" ? "Include" : "Only removed"}
              </Chip>
            ))}
          </div>
        </PopoverChip>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {active.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.clear}
              className="well inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-foreground hover:border-hairline-strong"
            >
              {a.label}
              <X className="size-3 opacity-60" />
            </button>
          ))}
          {active.length > 1 && (
            <button
              type="button"
              onClick={() => update({ tags: [], author: [], domain: [], from: "", to: "", media: "", link: false, pinned: false, removed: "exclude" })}
              className="label-mono px-2 hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
