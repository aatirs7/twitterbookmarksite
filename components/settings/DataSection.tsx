"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/file", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      toast.success(`Imported ${json.received}: ${json.inserted} new, ${json.updated} updated${json.skipped ? `, ${json.skipped} skipped` : ""}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-2">
        <p className="max-w-md text-sm text-muted-foreground">
          Manual fallback: upload a JSON file of entries, or raw Bookmarks responses saved from your browser dev tools.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Importing..." : "Import JSON"}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">Download every bookmark with notes, tags and summaries.</p>
        <div className="flex gap-2">
          <a href="/api/export?format=json" className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-raised">
            Export JSON
          </a>
          <a href="/api/export?format=md" className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-raised">
            Export Markdown
          </a>
        </div>
      </div>
    </div>
  );
}
