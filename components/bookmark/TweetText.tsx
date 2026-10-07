import { Fragment, type ReactNode } from "react";
import { HL_END, HL_START } from "@/lib/bookmarks/types";
import { shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Segment {
  text: string;
  marked: boolean;
}

/** Splits text on highlight sentinels into marked and unmarked segments. */
function splitHighlights(input: string): Segment[] {
  const out: Segment[] = [];
  let marked = false;
  let buf = "";
  for (const ch of input) {
    if (ch === HL_START || ch === HL_END) {
      if (buf) out.push({ text: buf, marked });
      buf = "";
      marked = ch === HL_START;
    } else buf += ch;
  }
  if (buf) out.push({ text: buf, marked });
  return out;
}

const TOKEN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|(@[A-Za-z0-9_]{1,15})|(`[^`\n]+`)/g;

function linkify(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${m.index}`;
    if (m[1]) {
      nodes.push(
        <a key={key} href={m[1]} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
          {shortUrl(m[1])}
        </a>,
      );
    } else if (m[2]) {
      nodes.push(
        <a
          key={key}
          href={`https://x.com/${m[2].slice(1)}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand hover:underline"
         
        >
          {m[2]}
        </a>,
      );
    } else if (m[3]) {
      nodes.push(
        <code key={key} className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em]">
          {m[3].slice(1, -1)}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function TweetText({
  text,
  headline,
  clamp,
  className,
}: {
  text: string;
  headline?: string | null;
  clamp?: boolean;
  className?: string;
}) {
  const segments = splitHighlights(headline || text);
  return (
    <div className={cn("whitespace-pre-wrap break-words leading-relaxed", clamp && "line-clamp-8", className)}>
      {segments.map((seg, i) =>
        seg.marked ? (
          <mark key={i}>{seg.text}</mark>
        ) : (
          <Fragment key={i}>{linkify(seg.text, String(i))}</Fragment>
        ),
      )}
    </div>
  );
}
