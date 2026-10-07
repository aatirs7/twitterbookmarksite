import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { importTokens, syncRuns } from "@/db/schema";
import { DataSection } from "@/components/settings/DataSection";
import { TaxonomySection } from "@/components/settings/TaxonomySection";
import { TokensSection } from "@/components/settings/TokensSection";
import { requireUser } from "@/lib/auth/user";
import { fullDate } from "@/lib/format";
import { ensureSeedTags } from "@/lib/tags/seed";
import { listUserTags } from "@/lib/tags/queries";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/PageHeader";

export const metadata = { title: "Settings | XBookmarkVault" };

function Section({ index, title, description, children }: { index: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="etched flex w-full max-w-3xl flex-col items-center gap-5 rounded-2xl p-6 text-center sm:p-8">
      <div className="flex flex-col items-center gap-2">
        <span className="label-mono">
          <span className="text-brand">{index}</span>
        </span>
        <h2 className="font-serif text-[30px] leading-none tracking-[-0.02em]">{title}</h2>
        {description && <p className="max-w-lg text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<string, string> = {
  done: "text-[#6FC2B0]",
  running: "text-brand",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

export default async function SettingsPage() {
  const userId = await requireUser();
  await ensureSeedTags(userId);
  const [tokens, runs, tags] = await Promise.all([
    db
      .select({ id: importTokens.id, name: importTokens.name, prefix: importTokens.prefix, createdAt: importTokens.createdAt, lastUsedAt: importTokens.lastUsedAt })
      .from(importTokens)
      .where(and(eq(importTokens.userId, userId), isNull(importTokens.revokedAt)))
      .orderBy(desc(importTokens.createdAt)),
    db.select().from(syncRuns).where(eq(syncRuns.userId, userId)).orderBy(desc(syncRuns.startedAt)).limit(12),
    listUserTags(userId),
  ]);

  return (
    <div className="flex flex-col items-center gap-8">
      <PageHeader index="04" label="Settings" title={<>The <span className="text-muted-foreground italic">controls</span></>} />

      <Section index="4.1" title="Import tokens" description="The XBookmarkVault extension uses a token to send bookmarks here. Tokens are shown once.">
        <TokensSection
          tokens={tokens.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt?.toISOString() ?? null }))}
        />
      </Section>

      <Section index="4.2" title="Extension" description="The extension reads your bookmarks through your logged-in X session and sends them here.">
        <a
          href="/trove-sync.zip"
          download="XBookmarkVault-extension.zip"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[inset_0_1px_0_0_rgba(248,247,244,0.2)] hover:brightness-110"
        >
          Download the extension
        </a>
        <ol className="flex max-w-md flex-col items-center gap-1.5 text-sm text-muted-foreground">
          <li>1. Unzip it somewhere permanent.</li>
          <li>2. Open chrome://extensions and turn on Developer mode.</li>
          <li>3. Click Load unpacked and pick the unzipped folder.</li>
          <li>4. Open the extension options, paste a token, and test the connection.</li>
          <li>5. Visit x.com/i/bookmarks once, then click Sync new.</li>
        </ol>
      </Section>

      <Section index="4.3" title="Sync history">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No syncs yet.</p>
        ) : (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {runs.map((r) => (
              <div key={r.id} className="well flex flex-col items-center gap-1.5 rounded-xl p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{r.mode === "incremental" ? "Sync new" : r.mode === "full" ? "Full resync" : "File import"}</span>
                  <span className={cn("text-xs capitalize", STATUS_STYLE[r.status])}>{r.status}</span>
                </div>
                <span className="label-mono">{fullDate(r.startedAt.toISOString())}</span>
                <span className="text-muted-foreground">
                  {r.pages} pages, {r.received} received, {r.inserted} new
                  {r.removed ? `, ${r.removed} removed` : ""}
                </span>
                {r.error && (
                  <details className="w-full text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Details</summary>
                    <pre className="mt-1 max-h-32 overflow-auto text-left whitespace-pre-wrap">{r.error}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section index="4.4" title="Categories" description="Bookmarks are sorted by each category's keywords for free. Add words, quoted phrases, site.com domains or @handles, separated by commas. With an Anthropic key set, Claude uses the descriptions instead.">
        <TaxonomySection tags={tags.map(({ id, value, label, description, keywords, color, count, createdBy }) => ({ id, slug: value, name: label, description, keywords, color: color ?? null, count, createdBy }))} />
      </Section>

      <Section index="4.5" title="Import and export">
        <DataSection />
      </Section>
    </div>
  );
}
