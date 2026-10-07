"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface SettingsTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Segmented tabs; the active tab is kept in the URL (?tab=) so reloads and links land on it. */
export function SettingsTabs({ tabs, initial }: { tabs: SettingsTab[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0].id);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", active);
    window.history.replaceState(null, "", url);
  }, [active]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div role="tablist" className="etched flex items-stretch rounded-xl p-0.5 text-[13px]">
        {tabs.map((t, i) => (
          <div key={t.id} className="flex items-stretch">
            {i > 0 && <span aria-hidden className="my-1.5 w-px bg-hairline" />}
            <button
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "rounded-[9px] px-4 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                active === t.id && "bg-raised text-foreground shadow-[inset_0_1px_0_0_var(--highlight)]",
              )}
            >
              {t.label}
            </button>
          </div>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="flex w-full flex-col items-center gap-4">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** A quiet settings panel: mono label, one-line explanation, content. */
export function Panel({ label, description, children }: { label: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="etched flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl p-6 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <span className="label-mono text-foreground">{label}</span>
        {description && <p className="max-w-md text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
