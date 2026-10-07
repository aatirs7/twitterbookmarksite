import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "text" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90 px-5 py-2.5 font-semibold",
  secondary: "bg-raised text-fg border border-line hover:border-accent px-4 py-2 font-medium",
  text: "text-accent hover:underline px-2 py-1 font-medium",
  danger: "text-danger hover:underline px-2 py-1 font-medium",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`w-full rounded-xl border border-line bg-surface p-4 flex flex-col items-center gap-2 text-center ${className}`}>
      {children}
    </section>
  );
}

export function Dot({ tone }: { tone: "ok" | "warn" | "danger" | "muted" }) {
  const cls = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", muted: "bg-muted" }[tone];
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

/** Re-renders every `ms` so relative times and countdowns stay fresh. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} d ago`;
  return new Date(at).toLocaleDateString();
}

export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const fmt = (n: number) => n.toLocaleString();
export const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
