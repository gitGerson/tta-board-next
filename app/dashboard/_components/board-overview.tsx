"use client";

import {
  ArrowRight,
  Columns3,
  LayoutDashboard,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { BoardSummaryDTO } from "@/app/lib/dal/boards";
import { BOARDS_CHANNEL } from "@/app/lib/realtime/protocol";
import { useRealtime } from "@/app/lib/realtime/use-realtime";
import {
  createBoardAction,
  deleteBoardAction,
  type KanbanActionResult,
} from "@/app/dashboard/boards/actions";
import { Modal } from "./modal";

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function ErrorMessage({ result }: { result: KanbanActionResult | null }) {
  if (!result || result.ok) {
    return null;
  }

  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {result.message}
    </p>
  );
}

export function BoardOverview({
  initialBoards,
  currentUserId,
}: {
  initialBoards: BoardSummaryDTO[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BoardSummaryDTO | null>(null);
  const [result, setResult] = useState<KanbanActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const refreshTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  // Debounced so a teammate filling in a new board does not refresh this list
  // once per keystroke of activity elsewhere.
  function onRemoteChange() {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => router.refresh(), 300);
  }

  useRealtime([BOARDS_CHANNEL], currentUserId, onRemoteChange);

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setResult(null);

    startTransition(async () => {
      const actionResult = await createBoardAction({
        name: String(form.get("name") || ""),
        description: String(form.get("description") || "") || null,
      });
      setResult(actionResult);
      if (actionResult.ok && actionResult.id) {
        setCreateOpen(false);
        router.push(`/dashboard/boards/${actionResult.id}`);
      }
    });
  }

  function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleteTarget) return;
    const form = new FormData(event.currentTarget);
    setResult(null);

    startTransition(async () => {
      const actionResult = await deleteBoardAction({
        boardId: deleteTarget.id,
        confirmation: String(form.get("confirmation") || ""),
      });
      setResult(actionResult);
      if (actionResult.ok) {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#689f38]">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Your boards
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Organize team work, move tasks through each stage, and keep the
            discussion in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#689f38] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-green-900/15 transition hover:bg-[#557f2f] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
        >
          <Plus size={18} aria-hidden="true" />
          New board
        </button>
      </section>

      {initialBoards.length === 0 ? (
        <section className="mt-10 rounded-2xl border border-dashed border-[#a8c98b] bg-white px-6 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#edf6e5] text-[#689f38]">
            <LayoutDashboard size={26} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-bold">Create your first board</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            A new board starts with To Do, In Progress, Review, and Done.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-6 rounded-xl bg-[#689f38] px-5 py-3 text-sm font-bold text-white hover:bg-[#557f2f]"
          >
            Create board
          </button>
        </section>
      ) : (
        <section
          className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Boards"
        >
          {initialBoards.map((board) => (
            <article
              key={board.id}
              className="group relative flex min-h-52 flex-col overflow-hidden rounded-2xl border border-green-950/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#a8c98b] hover:shadow-lg hover:shadow-green-950/8"
            >
              <div className="h-1.5 bg-gradient-to-r from-[#8bc34a] to-[#4f772d]" />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf6e5] text-[#5c8f32]">
                    <Columns3 size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold">{board.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">
                      {board.description || "No description yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setDeleteTarget(board);
                    }}
                    className="relative z-10 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-3 focus-visible:outline-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Delete ${board.name}`}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
                <dl className="mt-6 flex gap-5 text-sm">
                  <div>
                    <dt className="text-slate-500">Columns</dt>
                    <dd className="font-bold">{board.columnCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cards</dt>
                    <dd className="font-bold">{board.cardCount}</dd>
                  </div>
                  <div className="ml-auto text-right">
                    <dt className="text-slate-500">Updated</dt>
                    <dd className="font-semibold">{updatedLabel(board.updatedAt)}</dd>
                  </div>
                </dl>
                <Link
                  href={`/dashboard/boards/${board.id}`}
                  className="mt-5 inline-flex items-center gap-2 self-start text-sm font-bold text-[#5c8f32] after:absolute after:inset-0 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#689f38]"
                >
                  Open board
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      {createOpen && (
        <Modal
          title="Create a board"
          description="Four workflow columns will be added automatically."
          onClose={() => setCreateOpen(false)}
        >
          <form onSubmit={submitCreate} className="space-y-5 p-5 sm:p-6">
            <label className="block text-sm font-semibold">
              Board name
              <input
                name="name"
                required
                maxLength={100}
                autoFocus
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none transition focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
              />
            </label>
            <label className="block text-sm font-semibold">
              Description
              <textarea
                name="description"
                rows={3}
                maxLength={5000}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 outline-none transition focus:border-[#689f38] focus:ring-3 focus:ring-[#8bc34a]/20"
              />
            </label>
            <ErrorMessage result={result} />
            <footer className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-[#689f38] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#557f2f] disabled:cursor-wait disabled:opacity-60"
              >
                {isPending ? "Creating…" : "Create board"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Delete ${deleteTarget.name}?`}
          description="This permanently deletes every column, card, label, and comment in the board."
          onClose={() => setDeleteTarget(null)}
          size="sm"
        >
          <form onSubmit={submitDelete} className="space-y-5 p-5 sm:p-6">
            <label className="block text-sm font-semibold">
              Type <strong>{deleteTarget.name}</strong> to confirm
              <input
                name="confirmation"
                required
                autoComplete="off"
                autoFocus
                className="mt-2 w-full rounded-xl border border-red-200 px-3.5 py-3 outline-none focus:border-red-500 focus:ring-3 focus:ring-red-100"
              />
            </label>
            <ErrorMessage result={result} />
            <footer className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
