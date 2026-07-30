import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function BoardNotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 pb-24">
      <section className="max-w-md rounded-2xl border border-green-950/10 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#edf6e5] text-[#689f38]">
          <SearchX aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">Board not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          It may have been permanently deleted or the link is incorrect.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#689f38] px-4 py-2.5 text-sm font-bold text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to boards
        </Link>
      </section>
    </main>
  );
}
