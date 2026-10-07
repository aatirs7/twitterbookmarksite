"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/bookmark/TweetParts";
import type { AuthorSummary } from "@/lib/tags/queries";

export function AuthorGrid({ authors }: { authors: AuthorSummary[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase().replace(/^@/, "");
  const shown = needle
    ? authors.filter((a) => a.handle.includes(needle) || (a.name ?? "").toLowerCase().includes(needle))
    : authors;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find an author"
        className="etched h-12 w-full max-w-md rounded-xl px-4 text-center outline-none placeholder:text-faint focus:border-brand/50"
      />
      {shown.length === 0 ? (
        <p className="label-mono py-12">No authors found</p>
      ) : (
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.slice(0, 400).map((a) => (
            <Link
              key={a.handle}
              href={`/?author=${encodeURIComponent(a.handle)}`}
              className="etched group flex flex-col items-center gap-2 rounded-2xl p-5 text-center transition-colors hover:border-hairline-strong"
            >
              <Avatar src={a.avatar} name={a.name} size={48} />
              <span className="flex items-center gap-1 font-semibold tracking-[-0.01em] group-hover:text-brand">
                <span className="line-clamp-1">{a.name ?? a.handle}</span>
                {a.verified && <BadgeCheck className="size-3.5 shrink-0 text-brand" />}
              </span>
              <span className="text-xs text-muted-foreground">@{a.handle}</span>
              <span className="label-mono tabular">{a.count.toLocaleString()} saved</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
