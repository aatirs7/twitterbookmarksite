import Link from "next/link";
import { LogoutButton } from "@/components/app/LogoutButton";
import { Wordmark } from "@/components/app/Wordmark";
import { Nav } from "@/components/app/Nav";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { requireUser } from "@/lib/auth/user";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="grid-canvas pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center border-x border-hairline px-4">
          <Link href="/" className="group flex items-baseline gap-2 justify-self-start">
            <Wordmark className="text-[22px]" />
            <span className="label-mono hidden transition-colors group-hover:text-muted-foreground lg:inline">Archive</span>
          </Link>
          <Nav />
          <div className="flex items-center gap-0.5 justify-self-end">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col border-x border-hairline px-3 pt-10 pb-16 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-center gap-3 border-x border-hairline">
          <span className="label-mono">XBookmarkVault</span>
          <span className="h-3 w-px bg-hairline" />
          <span className="label-mono">Press ? for shortcuts</span>
        </div>
      </footer>
    </div>
  );
}
