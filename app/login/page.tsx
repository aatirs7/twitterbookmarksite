import { LoginForm } from "./LoginForm";

export const metadata = { title: "Trove" };

const FEATURES = ["Full text search", "AI tagging", "Synced from X"];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="grid-canvas pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[18%] left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--mark), transparent)" }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col border-x border-hairline">
        <div className="flex h-12 items-center justify-center gap-3 border-b border-hairline">
          <span className="label-mono">Trove</span>
          <span className="h-3 w-px bg-hairline-strong" />
          <span className="label-mono">Private archive</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
          <div className="rise flex flex-col items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="label-mono text-brand">001</span>
              <span className="h-px w-8 bg-hairline-strong" />
              <span className="label-mono">Sign in</span>
            </div>
            <h1 className="font-serif text-[104px] leading-[0.8] tracking-[-0.045em] italic sm:text-[168px]">Trove</h1>
            <p className="max-w-sm text-[15px] text-muted-foreground">
              Your X bookmarks, <span className="font-serif text-[18px] text-foreground italic">indexed</span> and searchable.
            </p>
          </div>

          <div className="rise etched w-full max-w-sm rounded-2xl p-1.5 [animation-delay:120ms]">
            <div className="flex items-center justify-center gap-2 border-b border-hairline px-3 pt-2 pb-2.5">
              <span className="size-1.5 rounded-full bg-brand" />
              <span className="label-mono">Owner access</span>
            </div>
            <div className="p-3 pt-4">
              <LoginForm next={typeof next === "string" ? next : "/"} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch justify-center border-t border-hairline">
          {FEATURES.map((f, i) => (
            <div key={f} className="flex items-stretch">
              {i > 0 && <span className="w-px bg-hairline" />}
              <span className="label-mono flex h-12 items-center px-5 sm:px-8">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
