"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Library" },
  { href: "/tags", label: "Tags" },
  { href: "/authors", label: "Authors" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="etched flex items-stretch rounded-xl p-0.5 text-[13px]">
      {LINKS.map((l, i) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <div key={l.href} className="flex items-stretch">
            {i > 0 && <span aria-hidden className="my-1.5 w-px bg-hairline" />}
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-[9px] px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:px-3.5",
                active && "bg-raised text-foreground shadow-[inset_0_1px_0_0_var(--highlight)]",
              )}
            >
              {l.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
