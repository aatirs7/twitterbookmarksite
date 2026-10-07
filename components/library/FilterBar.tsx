"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Facet, SearchResponse } from "@/lib/bookmarks/types";
import { cn } from "@/lib/utils";
import type { LibraryParams } from "./params";

type Update = (patch: Partial<LibraryParams>) => void;

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="well flex w-full items-stretch rounded-lg p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v || "all"}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground",
            value === v && "bg-surface text-foreground shadow-[inset_0_1px_0_0_var(--highlight),0_1px_2px_0_rgb(15_17_21/0.08)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FacetList({ facets, selected, onToggle, empty }: { facets: Facet[]; selected: string[]; onToggle: (v: string) => void; empty: string }) {
  if (facets.length === 0) return <p className="label-mono py-1">{empty}</p>;
  return (
    <div className="flex max-h-28 w-full flex-wrap justify-center gap-1 overflow-y-auto">
      {facets.map((f) => {
        const on = selected.includes(f.value);
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onToggle(f.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11.5px] transition-colors",
              on ? "border-brand/50 bg-brand/10 text-foreground" : "border-hairline text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            <span className="font-mono text-[10px] text-faint">{f.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5 border-t border-hairline pt-3 first:border-t-0 first:pt-0">
      <span className="label-mono">{label}</span>
      {children}
    </div>
  );
}

export function activeFilterCountOf(params: LibraryParams): number {
  return (
    params.author.length +
    params.domain.length +
    (params.from || params.to ? 1 : 0) +
    (params.media ? 1 : 0) +
    (params.link ? 1 : 0) +
    (params.pinned ? 1 : 0) +
    (params.removed !== "exclude" ? 1 : 0)
  );
}

/** One button that holds every filter except categories (those live in the category tabs). */
export function FiltersButton({ params, facets, update }: { params: LibraryParams; facets: SearchResponse["facets"]; update: Update }) {
  const [authorQuery, setAuthorQuery] = useState("");
  const [domainQuery, setDomainQuery] = useState("");
  const count = activeFilterCountOf(params);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "label-mono inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-raised hover:text-foreground",
          count > 0 && "text-brand",
        )}
      >
        <SlidersHorizontal className="size-3" />
        Filters{count > 0 ? ` / ${count}` : ""}
      </PopoverTrigger>
      <PopoverContent className="w-80 items-center gap-3 p-4 text-center">
        <Section label="Author">
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              const v = authorQuery.trim().replace(/^@/, "").toLowerCase();
              if (v) update({ author: toggle(params.author, v) });
              setAuthorQuery("");
            }}
          >
            <Input value={authorQuery} onChange={(e) => setAuthorQuery(e.target.value)} placeholder="@handle, then Enter" className="h-8 text-center text-[13px]" />
          </form>
          <FacetList
            facets={facets.authors.map((a) => ({ ...a, label: `@${a.value}` }))}
            selected={params.author}
            onToggle={(v) => update({ author: toggle(params.author, v) })}
            empty="No authors"
          />
        </Section>

        <Section label="Media">
          <Seg
            value={params.media}
            onChange={(media) => update({ media })}
            options={[
              ["", "All"],
              ["photo", "Photos"],
              ["video", "Videos"],
              ["any", "Any"],
              ["none", "None"],
            ]}
          />
        </Section>

        <Section label="Links">
          <Seg
            value={params.link ? "1" : ""}
            onChange={(v) => update({ link: v === "1" })}
            options={[
              ["", "Any"],
              ["1", "Has a link"],
            ]}
          />
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              const v = domainQuery.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
              if (v) update({ domain: toggle(params.domain, v) });
              setDomainQuery("");
            }}
          >
            <Input value={domainQuery} onChange={(e) => setDomainQuery(e.target.value)} placeholder="domain.com, then Enter" className="h-8 text-center text-[13px]" />
          </form>
          <FacetList facets={facets.domains} selected={params.domain} onToggle={(v) => update({ domain: toggle(params.domain, v) })} empty="No links" />
        </Section>

        <Section label="Posted">
          <div className="flex w-full items-center gap-1.5">
            <Input type="date" value={params.from} onChange={(e) => update({ from: e.target.value })} className="h-8 text-center text-[12px]" aria-label="From" />
            <span className="label-mono">to</span>
            <Input type="date" value={params.to} onChange={(e) => update({ to: e.target.value })} className="h-8 text-center text-[12px]" aria-label="To" />
          </div>
        </Section>

        <Section label="Show">
          <Seg
            value={params.pinned ? "pinned" : params.removed}
            onChange={(v) => update(v === "pinned" ? { pinned: true, removed: "exclude" } : { pinned: false, removed: v as LibraryParams["removed"] })}
            options={[
              ["exclude", "Saved"],
              ["pinned", "Pinned"],
              ["include", "With removed"],
              ["only", "Removed"],
            ]}
          />
        </Section>

        {count > 0 && (
          <button
            type="button"
            onClick={() => update({ author: [], domain: [], from: "", to: "", media: "", link: false, pinned: false, removed: "exclude" })}
            className="label-mono hover:text-foreground"
          >
            Reset filters
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Dismissible chips for whatever filters are on. Renders nothing when none are. */
export function ActiveFilters({ params, facets, update }: { params: LibraryParams; facets: SearchResponse["facets"]; update: Update }) {
  const active: { key: string; label: string; clear: () => void }[] = [
    ...params.tags.map((t) => ({
      key: `tag:${t}`,
      label: facets.tags.find((f) => f.value === t)?.label ?? t,
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
      ? [{ key: "removed", label: params.removed === "only" ? "Removed only" : "With removed", clear: () => update({ removed: "exclude" }) }]
      : []),
  ];
  if (active.length === 0) return null;
  return (
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
  );
}
