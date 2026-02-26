"use client";

import { useEffect } from "react";

type ErrorWithRequestId = Error & { digest?: string; requestId?: string };

type ErrorProps = {
  error: ErrorWithRequestId;
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log for server-side inspection; UI remains friendly.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const requestId = error.requestId || error.digest;

  return (
    <div className="min-h-screen bg-[#070a12] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl shadow-black/40">
          <div className="text-xs uppercase tracking-wide text-rose-200/80">Mission Control</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-3 text-sm text-zinc-300">
            We hit an unexpected error while loading Mission Control. Try again, or
            refresh in a moment.
          </p>
          {requestId ? (
            <div className="mt-4 text-xs text-zinc-400">
              Request ID: <span className="font-mono">{requestId}</span>
            </div>
          ) : null}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/15"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
