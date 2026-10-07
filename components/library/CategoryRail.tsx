"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    // A normal mouse wheel scrolls the bar sideways while the pointer is over it.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
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

  const nudge = (dir: -1 | 1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };
  const arrow = (dir: -1 | 1, visible: boolean) => (
    <button
      type="button"
      onClick={() => nudge(dir)}
      aria-label={dir < 0 ? "Scroll categories left" : "Scroll categories right"}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "absolute top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg border border-hairline bg-surface text-muted-foreground shadow-[inset_0_1px_0_0_var(--highlight),0_2px_6px_0_rgb(15_17_21/0.12)] transition-[opacity,color] duration-200 hover:text-foreground",
        dir < 0 ? "left-1" : "right-1",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {dir < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );

  return (
    <div className="etched relative w-full max-w-4xl rounded-xl">
      {arrow(-1, edges.left)}
      {arrow(1, edges.right)}
      <div
        ref={scroller}
        className="flex items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: `linear-gradient(to right, ${edges.left ? "transparent" : "rgb(15 17 21)"}, rgb(15 17 21) 56px, rgb(15 17 21) calc(100% - 56px), ${edges.right ? "transparent" : "rgb(15 17 21)"})`,
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
