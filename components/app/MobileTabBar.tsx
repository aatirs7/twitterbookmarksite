"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, Settings2, Shapes, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Library", icon: LibraryBig },
  { href: "/tags", label: "Categories", icon: Shapes },
  { href: "/authors", label: "Authors", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

/** iOS style tab bar for phones. Sits above the home indicator via the bottom safe area inset. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <div className="mx-auto grid h-[52px] max-w-md grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide text-faint transition-colors active:opacity-60",
                active && "text-brand",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
