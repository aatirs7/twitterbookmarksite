import { LoginForm } from "./LoginForm";

export const metadata = { title: "Trove" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Trove</h1>
        <p className="text-sm text-muted-foreground">Your X bookmarks, searchable.</p>
      </div>
      <LoginForm next={typeof next === "string" ? next : "/"} />
    </main>
  );
}
