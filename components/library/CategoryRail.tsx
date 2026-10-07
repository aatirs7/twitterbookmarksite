"use client";

import type { Facet } from "@/lib/bookmarks/types";
import { cn } from "@/lib/utils";

/** One-click category browsing: every category with bookmarks, largest first. */
export function CategoryRail({
  categories,
  selected,
  onSelect,
}: {
  categories: Facet[];
  selected: string[];
  onSelect: (slug: string | null) => void;
}) {
  const shown = categories.filter((c) => c.count > 0);
  if (shown.length === 0) return null;
  const total = shown.reduce((n, c) => n + c.count, 0);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="label-mono">Browse by category</span>
      <div className="flex max-w-4xl flex-wrap justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "etched inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground",
            selected.length === 0 && "border-brand/40 text-foreground",
          )}
        >
          All
          <span className="label-mono tabular">{total.toLocaleString()}</span>
        </button>
        {shown.map((c) => {
          const on = selected.includes(c.value);
          const color = c.color ?? "#9AA7B8";
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onSelect(on ? null : c.value)}
              aria-pressed={on}
              className={cn(
                "etched inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground",
                on && "text-foreground",
              )}
              style={on ? { borderColor: `${color}99`, backgroundColor: `${color}1a` } : undefined}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
              {c.label}
              <span className="label-mono tabular">{c.count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
