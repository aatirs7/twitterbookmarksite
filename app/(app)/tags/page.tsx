/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { listUserTags } from "@/lib/tags/queries";

export const metadata = { title: "Tags | Trove" };

export default async function TagsPage() {
  const userId = await requireUser();
  const tags = await listUserTags(userId);
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-sm text-muted-foreground">{tags.length} tags. Edit the taxonomy in Settings.</p>
      </div>
      {tags.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Tags appear after your first sync is tagged.</p>
      ) : (
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={`/?tags=${encodeURIComponent(t.value)}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-colors hover:bg-raised"
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color ?? "#9AA7B8" }} />
              <span className="font-medium">{t.label}</span>
              <span className="text-sm text-muted-foreground">{t.count.toLocaleString()}</span>
              <div className="flex h-6 -space-x-2">
                {t.avatars.map((a) => (
                  <img key={a} src={a} alt="" className="size-6 rounded-full border-2 border-surface bg-raised" loading="lazy" />
                ))}
              </div>
              {t.createdBy === "ai" && <span className="text-xs text-brand">Proposed by AI</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
