"use client";

import { useEffect } from "react";
import { attemptRecoverFromClientRuntimeError } from "@/lib/runtime/clientRecovery";

export default function StaleClientRecovery() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      attemptRecoverFromClientRuntimeError(event.error ?? event.message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      attemptRecoverFromClientRuntimeError(event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
