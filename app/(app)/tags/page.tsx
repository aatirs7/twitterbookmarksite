/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { requireUser } from "@/lib/auth/user";
import { listUserTags } from "@/lib/tags/queries";

export const metadata = { title: "Tags | XBookmarkVault" };

export default async function TagsPage() {
  const userId = await requireUser();
  const tags = await listUserTags(userId);
  return (
    <div className="flex flex-col items-center gap-8">
      <PageHeader
        index="02"
        label="Categories"
        title={<>The <span className="text-muted-foreground italic">categories</span></>}
        subtitle={`${tags.length} categories, sorted automatically by AI. Rename, merge and recolor them in Settings.`}
      />
      {tags.length === 0 ? (
        <p className="label-mono py-16 text-center">Categories fill in once the AI tagger has run.</p>
      ) : (
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={`/?tags=${encodeURIComponent(t.value)}`}
              className="etched group flex flex-col items-center gap-2.5 rounded-2xl p-5 text-center transition-colors hover:border-hairline-strong"
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color ?? "#9AA7B8" }} />
              <span className="font-serif text-[22px] leading-tight tracking-[-0.01em] group-hover:text-brand">{t.label}</span>
              <span className="label-mono tabular">{t.count.toLocaleString()} saved</span>
              <div className="flex h-6 -space-x-2">
                {t.avatars.map((a) => (
                  <img key={a} src={a} alt="" className="size-6 rounded-full border-2 border-[var(--surface)] bg-raised" loading="lazy" />
                ))}
              </div>
              {t.createdBy === "ai" && <span className="label-mono text-brand">Proposed by AI</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
