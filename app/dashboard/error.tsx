"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
      <section className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">Unable to load the boards</h1>
        <p className="mt-2 text-sm text-slate-600">
          Check the local PostgreSQL connection, then try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#689f38] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#557f2f] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  );
}
