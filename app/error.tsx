"use client";

import { useEffect } from "react";
import {
  attemptRecoverFromClientRuntimeError,
  isRecoverableClientRuntimeError,
} from "@/lib/runtime/clientRecovery";

type ErrorWithRequestId = Error & { digest?: string; requestId?: string };

type ErrorProps = {
  error: ErrorWithRequestId;
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  const canRecoverWithReload = isRecoverableClientRuntimeError(error);

  useEffect(() => {
    if (canRecoverWithReload) {
      attemptRecoverFromClientRuntimeError(error);
    }

    // Log for server-side inspection; UI remains friendly.
    console.error(error);
  }, [canRecoverWithReload, error]);

  const requestId = error.requestId || error.digest;

  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-10 shadow-[0_22px_56px_rgba(15,23,42,0.09)]">
          <div className="text-xs uppercase tracking-wide text-[#64748B]">Mission Control</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A]">Something went wrong</h1>
          <p className="mt-3 text-sm text-[#334155]">
            {canRecoverWithReload
              ? "This page is out of date relative to the latest deploy. Reload the app to fetch the current release."
              : "We hit an unexpected error while loading Mission Control. Try again, or refresh in a moment."}
          </p>
          {requestId ? (
            <div className="mt-4 text-xs text-[#64748B]">
              Request ID: <span className="font-mono">{requestId}</span>
            </div>
          ) : null}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                if (canRecoverWithReload) {
                  window.location.reload();
                  return;
                }

                reset();
              }}
              className="rounded-xl border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              {canRecoverWithReload ? "Reload app" : "Try again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
