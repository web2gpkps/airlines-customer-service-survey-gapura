"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-1.5 text-sm font-semibold text-ink">
        Password
        <span className="relative block">
          <input
            type={show ? "text" : "password"}
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="min-h-11 w-full rounded-lg border border-line-strong bg-card py-0 pr-12 pl-3 text-base font-normal"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Sembunyikan password" : "Lihat password"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-ink"
          >
            {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        </span>
      </label>
      {state.error && <p role="alert" className="text-sm font-semibold text-crit">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
