import Link from "next/link";
import { LogoutButton } from "@/components/app/LogoutButton";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { Nav } from "@/components/app/Nav";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Wordmark } from "@/components/app/Wordmark";
import { requireUser } from "@/lib/auth/user";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="grid-canvas pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
      {/* The top safe area keeps the header clear of the notch when installed as an app. */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between border-hairline px-4 md:grid md:h-14 md:grid-cols-[1fr_auto_1fr] md:border-x">
          <Link href="/" className="group flex items-baseline gap-2 justify-self-start">
            <Wordmark className="text-[20px] md:text-[22px]" />
            <span className="label-mono hidden transition-colors group-hover:text-muted-foreground lg:inline">Archive</span>
          </Link>
          <Nav className="hidden md:flex" />
          <div className="flex items-center gap-0.5 justify-self-end">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pt-6 pb-[calc(76px+env(safe-area-inset-bottom))] sm:px-6 md:border-x md:border-hairline md:pt-10 md:pb-16">
        {children}
      </main>
      <footer className="hidden border-t border-hairline md:block">
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-center gap-3 border-x border-hairline">
          <span className="label-mono">XBookmarkVault</span>
          <span className="h-3 w-px bg-hairline" />
          <span className="label-mono">Press ? for shortcuts</span>
        </div>
      </footer>
      <MobileTabBar />
    </div>
  );
}
