import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { importTokens, syncRuns } from "@/db/schema";
import { PageHeader } from "@/components/app/PageHeader";
import { AiSection } from "@/components/settings/AiSection";
import { DataSection } from "@/components/settings/DataSection";
import { Panel, SettingsTabs } from "@/components/settings/SettingsTabs";
import { TaxonomySection } from "@/components/settings/TaxonomySection";
import { TokensSection } from "@/components/settings/TokensSection";
import { getAnthropicKey } from "@/lib/ai/apiKey";
import { requireUser } from "@/lib/auth/user";
import { fullDate, relativeDate } from "@/lib/format";
import { ensureSeedTags } from "@/lib/tags/seed";
import { listUserTags } from "@/lib/tags/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings | XBookmarkVault" };
// Server actions on this page can kick off a full recategorize.
export const maxDuration = 300;

const STATUS_DOT: Record<string, string> = {
  done: "bg-[#6FC2B0]",
  running: "bg-brand",
  failed: "bg-destructive",
  cancelled: "bg-faint",
};

const STEPS = [
  "Download and unzip it somewhere permanent",
  "Open chrome://extensions and turn on Developer mode",
  "Click Load unpacked and pick the unzipped folder",
  "In its options, paste a token from above and test the connection",
  "Visit x.com/i/bookmarks once, then click Sync new",
];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const userId = await requireUser();
  await ensureSeedTags(userId);
  const { tab } = await searchParams;
  const [tokens, runs, tags, ai] = await Promise.all([
    db
      .select({ id: importTokens.id, name: importTokens.name, prefix: importTokens.prefix, createdAt: importTokens.createdAt, lastUsedAt: importTokens.lastUsedAt })
      .from(importTokens)
      .where(and(eq(importTokens.userId, userId), isNull(importTokens.revokedAt)))
      .orderBy(desc(importTokens.createdAt)),
    db.select().from(syncRuns).where(eq(syncRuns.userId, userId)).orderBy(desc(syncRuns.startedAt)).limit(8),
    listUserTags(userId),
    getAnthropicKey(userId),
  ]);

  const extension = (
    <>
      <Panel label="Import tokens" description="The extension uses a token to send bookmarks here. A new token is shown once.">
        <TokensSection
          tokens={tokens.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt?.toISOString() ?? null }))}
        />
      </Panel>

      <Panel label="Install" description="Reads your bookmarks through your logged-in X session. It only syncs when you click.">
        <a
          href="/trove-sync.zip"
          download="XBookmarkVault-extension.zip"
          className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_0_rgba(248,247,244,0.2)] hover:brightness-110"
        >
          Download the extension
        </a>
        <ol className="flex flex-col items-center gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              {s}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel label="Recent syncs">
        {runs.length === 0 ? (
          <p className="label-mono">No syncs yet</p>
        ) : (
          <div className="w-full max-w-lg divide-y divide-hairline">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-col items-center gap-0.5 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[r.status] ?? "bg-faint")} />
                  <span>{r.mode === "incremental" ? "Sync new" : r.mode === "full" ? "Full resync" : "File import"}</span>
                  <span className="text-faint" title={fullDate(r.startedAt.toISOString())}>
                    {relativeDate(r.startedAt.toISOString())}
                  </span>
                </div>
                <span className="label-mono tabular">
                  {r.received} received / {r.inserted} new{r.removed ? ` / ${r.removed} removed` : ""}
                  {r.status !== "done" ? ` / ${r.status}` : ""}
                </span>
                {r.error && (
                  <details className="w-full text-xs text-muted-foreground">
                    <summary className="label-mono cursor-pointer">Details</summary>
                    <pre className="mt-1 max-h-32 overflow-auto text-left whitespace-pre-wrap">{r.error}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );

  return (
    <div className="flex flex-col items-center gap-8">
      <PageHeader index="04" label="Settings" title={<>The <span className="text-muted-foreground italic">controls</span></>} />
      <SettingsTabs
        initial={typeof tab === "string" ? tab : "extension"}
        tabs={[
          { id: "extension", label: "Extension", content: extension },
          {
            id: "categories",
            label: "Categories",
            content: (
              <>
                <p className="max-w-md text-center text-[13px] text-muted-foreground">
                  Click a category to rename, recolor or edit its keywords. Sorting uses keywords for free, or Claude if you add a key under AI.
                </p>
                <TaxonomySection
                  tags={tags.map(({ id, value, label, description, keywords, color, count, createdBy }) => ({
                    id,
                    slug: value,
                    name: label,
                    description,
                    keywords,
                    color: color ?? null,
                    count,
                    createdBy,
                  }))}
                />
              </>
            ),
          },
          {
            id: "ai",
            label: "AI",
            content: (
              <Panel label="Anthropic API key" description="Optional. With a key, Claude Haiku sorts bookmarks into categories and writes one-line summaries. Without one, free keyword rules do the sorting.">
                <AiSection source={ai.source} hint={ai.hint} />
              </Panel>
            ),
          },
          {
            id: "data",
            label: "Data",
            content: (
              <Panel label="Import and export">
                <DataSection />
              </Panel>
            ),
          },
        ]}
      />
    </div>
  );
}
