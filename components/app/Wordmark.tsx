import { cn } from "@/lib/utils";

/** XBookmarkVault wordmark: upright "XBookmark", italic muted "Vault", in the serif display face. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif leading-none tracking-[-0.02em] whitespace-nowrap", className)}>
      XBookmark<span className="text-muted-foreground italic">Vault</span>
    </span>
  );
}
