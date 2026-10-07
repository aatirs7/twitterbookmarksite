import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "text" | "danger";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`btn btn-${variant} ${className}`} {...props} />;
}

/** Etched panel with an optional catalog eyebrow such as "01 / STATUS". */
export function Card({ children, className = "", label }: { children: ReactNode; className?: string; label?: ReactNode }) {
  return (
    <section className={`panel w-full p-4 flex flex-col items-center gap-2.5 text-center ${className}`}>
      {label && <Label className="mb-0.5">{label}</Label>}
      {children}
    </section>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`label-mono ${className}`}>{children}</p>;
}

export function Dot({ tone, pulse }: { tone: "ok" | "warn" | "danger" | "muted" | "accent"; pulse?: boolean }) {
  return <span aria-hidden className={`dot dot-${tone} ${pulse ? "dot-pulse" : ""}`} />;
}

export function StatStrip({ stats }: { stats: { label: string; value: ReactNode; tone?: "ok" | "danger" }[] }) {
  return (
    <div className="stat-strip">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <span className={`stat-value ${s.tone === "ok" ? "text-ok" : s.tone === "danger" ? "text-danger" : ""}`}>{s.value}</span>
          <span className="label-mono">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ paused }: { paused?: boolean }) {
  return <div className={`progress ${paused ? "progress-paused" : ""}`} role="progressbar" aria-busy={!paused} />;
}

/** Version from the built manifest, for the "SYNC / v0.1.0" marking. */
export function extVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "";
  }
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
