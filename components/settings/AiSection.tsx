"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeAnthropicKeyAction, saveAnthropicKeyAction } from "@/app/(app)/settings/actions";
import type { TaggingStatus } from "@/lib/ai/recategorize";
import { RecategorizeButton } from "./RecategorizeButton";
import { cn } from "@/lib/utils";

export function AiSection({ source, hint, tagging }: { source: "user" | "env" | null; hint: string | null; tagging: TaggingStatus }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const status =
    source === "user"
      ? { dot: "bg-brand", text: "Claude Haiku 4.5", sub: `Your key ${hint ?? ""}`.trim() }
      : source === "env"
        ? { dot: "bg-brand", text: "Claude Haiku 4.5", sub: "Server key" }
        : { dot: "bg-faint", text: "Free keyword rules", sub: "No key saved" };

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="well flex items-center gap-3 rounded-xl px-4 py-2.5">
        <span className={cn("size-2 rounded-full", status.dot)} />
        <div className="flex flex-col items-center">
          <span className="text-[13px] font-medium">{status.text}</span>
          <span className="label-mono">{status.sub}</span>
        </div>
      </div>

      <form
        className="flex w-full max-w-md flex-col items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await saveAnthropicKeyAction(key);
            if (res.ok) {
              setKey("");
              toast.success("Key saved. New bookmarks will be sorted by Claude.");
            } else setError(res.error);
          });
        }}
      >
        <div className="relative w-full">
          <input
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={source === "user" ? "Paste a new key to replace it" : "sk-ant-..."}
            autoComplete="off"
            spellCheck={false}
            aria-label="Anthropic API key"
            className="well h-10 w-full rounded-xl px-10 text-center font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-faint focus:border-brand/50"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide key" : "Show key"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-faint hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button type="submit" disabled={!key.trim() || pending}>
          {pending ? "Checking key..." : "Test and save"}
        </Button>
        {error && <p className="label-mono text-destructive">{error}</p>}
      </form>

      <div className="flex flex-wrap items-center justify-center gap-1">
        {source === "user" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={pending}
            onClick={() => start(async () => {
              await removeAnthropicKeyAction();
              toast.success("Key removed. Back to free keyword rules.");
            })}
          >
            Remove key
          </Button>
        )}

      </div>

      <RecategorizeButton key={`${tagging.engine}-${tagging.cooldownUntil}`} initial={tagging} />

      <p className="max-w-md text-[12px] text-faint">
        Get a key at console.anthropic.com. It is stored encrypted and never shown again. Sorting 1,000 bookmarks with
        Claude Haiku costs well under a dollar.
      </p>
    </div>
  );
}
