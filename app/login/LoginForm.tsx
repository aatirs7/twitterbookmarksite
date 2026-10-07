"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex w-full flex-col items-center gap-3">
      <input type="hidden" name="next" value={next} />
      <div className="group relative w-full">
        <input
          name="password"
          type="password"
          autoFocus
          required
          placeholder="Password"
          aria-label="Password"
          aria-invalid={!!state?.error}
          className="well h-12 w-full rounded-xl px-12 text-center text-[15px] tracking-wide outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand/50 focus:shadow-[0_0_0_4px_var(--mark)] aria-invalid:border-destructive/60"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Sign in"
          className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_rgba(248,247,244,0.2)] transition-[filter,transform] hover:brightness-110 active:translate-y-[calc(-50%+1px)] disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </button>
      </div>
      <p className={state?.error ? "label-mono text-destructive" : "label-mono"}>{state?.error ?? "Session lasts 30 days"}</p>
    </form>
  );
}
