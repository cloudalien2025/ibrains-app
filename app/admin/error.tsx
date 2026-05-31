"use client";

export default function AdminError() {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" data-testid="admin-error-boundary">
      Admin console failed to render. Reload and retry.
    </div>
  );
}
