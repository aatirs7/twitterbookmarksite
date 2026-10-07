"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTokenAction, revokeTokenAction } from "@/app/(app)/settings/actions";
import { fullDate } from "@/lib/format";

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokensSection({ tokens }: { tokens: TokenRow[] }) {
  const [name, setName] = useState("Chrome");
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <form
        className="flex w-full max-w-md items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const { token } = await createTokenAction(name);
            setFresh(token);
          });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="text-center" />
        <Button type="submit" disabled={pending}>
          Create token
        </Button>
      </form>

      {fresh && (
        <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 p-4">
          <p className="text-sm">Copy this now. It will not be shown again.</p>
          <code className="w-full break-all rounded-lg bg-background/60 px-3 py-2 font-mono text-xs">{fresh}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(fresh);
              toast.success("Token copied");
            }}
          >
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {tokens.map((t) => (
            <div key={t.id} className="well flex flex-col items-center gap-1 rounded-xl p-3 text-sm">
              <span className="font-medium">{t.name}</span>
              <code className="label-mono">{t.prefix}...</code>
              <span className="text-xs text-muted-foreground">
                {t.lastUsedAt ? `Last used ${fullDate(t.lastUsedAt)}` : "Never used"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() => start(() => revokeTokenAction(t.id))}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
