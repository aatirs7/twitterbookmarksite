"use client";

import { useEffect, useRef, useState } from "react";
import type { Facet } from "@/lib/bookmarks/types";
import { cn } from "@/lib/utils";

/** Category tabs on one scrollable line, with fades where more tabs are hidden. */
export function CategoryRail({
  categories,
  selected,
  onSelect,
}: {
  categories: Facet[];
  selected: string[];
  onSelect: (slug: string | null) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Largest first, with the catch-all "Other" always last.
  const shown = categories
    .filter((c) => c.count > 0)
    .sort((a, b) => Number(a.value === "other") - Number(b.value === "other") || b.count - a.count);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [shown.length]);

  // Keep the active tab in view (scrolls only the rail, never the page).
  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!el || !active) return;
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selected]);

  if (shown.length === 0) return null;

  const tab = (key: string, label: React.ReactNode, on: boolean, onClick: () => void, color?: string, count?: number) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
        on && "bg-raised text-foreground shadow-[inset_0_1px_0_0_var(--highlight)]",
      )}
    >
      {color && <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      {count !== undefined && <span className="font-mono text-[10.5px] text-faint tabular">{count}</span>}
    </button>
  );

  return (
    <div className="etched relative w-full max-w-4xl rounded-xl">
      <div
        ref={scroller}
        className="flex items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: `linear-gradient(to right, ${edges.left ? "transparent" : "rgb(15 17 21)"}, rgb(15 17 21) 40px, rgb(15 17 21) calc(100% - 40px), ${edges.right ? "transparent" : "rgb(15 17 21)"})`,
        }}
      >
        {tab("all", "All", selected.length === 0, () => onSelect(null))}
        {shown.map((c) =>
          tab(c.value, c.label, selected.includes(c.value), () => onSelect(selected.includes(c.value) ? null : c.value), c.color ?? "#9AA7B8", c.count),
        )}
      </div>
    </div>
  );
}
