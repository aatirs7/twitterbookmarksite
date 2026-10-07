"use client";

import { useState } from "react";
import type { BookmarkItem, Facet } from "@/lib/bookmarks/types";
import { BookmarkCard } from "./BookmarkCard";

export function RelatedGrid({ items: initial, allTags }: { items: BookmarkItem[]; allTags: Facet[] }) {
  const [items, setItems] = useState(initial);
  return (
    <div className="grid w-full items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <BookmarkCard
          key={item.tweetId}
          item={item}
          allTags={allTags}
          onUpdate={(next) => setItems((list) => list.map((i) => (i.tweetId === next.tweetId ? next : i)))}
        />
      ))}
    </div>
  );
}
