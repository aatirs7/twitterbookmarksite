"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex w-full max-w-xs flex-col items-center gap-3">
      <input type="hidden" name="next" value={next} />
      <Input name="password" type="password" autoFocus required placeholder="Password" className="h-11 text-center" aria-label="Password" />
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Checking..." : "Enter"}
      </Button>
      <p className="h-5 text-sm text-destructive">{state?.error}</p>
    </form>
  );
}
