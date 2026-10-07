"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retagAllAction } from "@/app/(app)/settings/actions";
import type { TaggingStatus } from "@/lib/ai/recategorize";

const POLL_MS = 2000;
const STALL_MS = 90_000;

function hoursUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));
}

/**
 * Starts a full recategorize and shows live progress until every bookmark has a category.
 * The server refuses a second run while one is going, and Claude runs have a 24 hour cooldown.
 */
export function RecategorizeButton({ initial, label = "Recategorize everything now" }: { initial: TaggingStatus; label?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [running, setRunning] = useState(initial.pending > 0);
  const [starting, setStarting] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const lastProgress = useRef({ pending: -1, at: 0 });

  const fetchStatus = useCallback(async (): Promise<TaggingStatus | null> => {
    try {
      const res = await fetch("/api/tagging/status", { cache: "no-store" });
      if (!res.ok) return null;
      const s = (await res.json()) as TaggingStatus;
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    lastProgress.current = { pending: -1, at: Date.now() };
    const id = setInterval(async () => {
      const s = await fetchStatus();
      if (!s) return;
      if (s.pending !== lastProgress.current.pending) lastProgress.current = { pending: s.pending, at: Date.now() };
      setStalled(Date.now() - lastProgress.current.at > STALL_MS);
      if (s.pending === 0) {
        setRunning(false);
        setStalled(false);
        setJustFinished(true);
        toast.success(`Done. ${s.total.toLocaleString()} bookmarks sorted into categories.`, { id: "recategorize-done" });
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [running, fetchStatus, router]);

  // While a Claude run is in progress, keep it moving from here instead of waiting for the hourly job.
  // One request at a time; the server lease turns away extra workers, so nothing is processed twice.
  useEffect(() => {
    if (!running || status.engine !== "claude") return;
    let cancelled = false;
    void (async () => {
      while (!cancelled) {
        try {
          const res = await fetch("/api/tagging/continue", { method: "POST" });
          const body = res.ok ? ((await res.json()) as { done: number; busy: boolean }) : null;
          if (!body || body.busy || body.done === 0) await new Promise((r) => setTimeout(r, 5000));
        } catch {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [running, status.engine]);

  const start = async () => {
    setStarting(true);
    setJustFinished(false);
    try {
      const res = await retagAllAction();
      if (!res.ok) {
        toast.error(res.error);
        await fetchStatus();
        return;
      }
      await fetchStatus();
      setRunning(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (running) {
    const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-2" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-[13px]">
          <Loader2 className="size-3.5 animate-spin text-brand" />
          Sorting with {status.engine === "claude" ? "Claude" : "keyword rules"}
        </div>
        <div className="well h-2 w-full overflow-hidden rounded-full">
          <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
        <span className="label-mono tabular">
          {status.done.toLocaleString()} of {status.total.toLocaleString()} sorted / {pct}%
        </span>
        {stalled && (
          <p className="max-w-xs text-center text-[12px] text-muted-foreground">
            Still working in the background. The hourly job finishes anything left, so you can close this page.
          </p>
        )}
      </div>
    );
  }

  if (status.cooldownUntil) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        {justFinished && (
          <span className="label-mono inline-flex items-center gap-1 text-[#6FC2B0]">
            <Check className="size-3" /> All bookmarks sorted
          </span>
        )}
        <Button variant="secondary" size="sm" disabled>
          <Clock className="size-3.5" />
          Available again in {hoursUntil(status.cooldownUntil)} h
        </Button>
        <span className="max-w-xs text-center text-[12px] text-faint">
          A full Claude recategorize can run once a day. New bookmarks are still sorted as they sync.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button variant="secondary" size="sm" disabled={starting} onClick={start}>
        {starting ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {starting ? "Starting..." : label}
      </Button>
      {justFinished && (
        <span className="label-mono inline-flex items-center gap-1 text-[#6FC2B0]">
          <Check className="size-3" /> All bookmarks sorted
        </span>
      )}
      {status.engine === "claude" && !justFinished && (
        <span className="max-w-xs text-center text-[12px] text-faint">Uses Claude credits. Limited to once a day.</span>
      )}
    </div>
  );
}
