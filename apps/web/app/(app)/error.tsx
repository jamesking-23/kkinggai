"use client";

import { primaryButton, subtleButton } from "../../components/ui";

/** Shown when a page in the signed-in app throws. The message is never shown, only the digest for support. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <div className="orb mx-auto !h-20 !w-20 opacity-70" aria-hidden />
      <h1 className="mt-10 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        This page could not load. Your data is safe. Try again, or go back to the dashboard.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className={primaryButton}>
          Try again
        </button>
        <a href="/" className={subtleButton}>
          Dashboard
        </a>
      </div>
    </div>
  );
}
